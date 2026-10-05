import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import type { Event } from '../db';
import {
  countParticipantsPerTeam,
  createEventParticipant,
  createStepEntry,
  deleteEventParticipant,
  getEventById,
  getEventsAcceptingParticipants,
  getParticipantByUserAndEvent,
  getStepEntriesByUserAndEvent,
  getStepEntryById,
  getTeamsByEvent,
  getTeamStepTotals,
  getUserEvents,
  getUserStepSummary,
  updateStepEntry,
} from '../db';
import { isValidDate, isValidSteps } from '../validation';
import { dashboardPage, eventsListPage, noEventsPage } from '../templates';

const entries = new Hono<AppEnv>();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function imageExtension(type: string): string {
  return type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
}

async function storeUserImage(
  bucket: R2Bucket,
  userId: number,
  eventId: number,
  entryDate: string,
  file: File
): Promise<string> {
  const ext = imageExtension(file.type);
  const uuid = crypto.randomUUID();
  const key = `uploads/${eventId}/${userId}/${entryDate}-${uuid}.${ext}`;
  await bucket.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `inline; filename="${file.name}"`,
    },
  });
  return key;
}

function validateImage(image: unknown): { ok: true; file: File } | { ok: false; error: string } {
  if (!image || !(image instanceof File) || image.size === 0) {
    return { ok: false, error: '' }; // no image is fine
  }
  if (!image.type.startsWith('image/')) {
    return { ok: false, error: 'Uploaded file must be an image.' };
  }
  if (image.size > MAX_IMAGE_SIZE) {
    return { ok: false, error: 'Image must be smaller than 5 MB.' };
  }
  return { ok: true, file: image };
}

// Dashboard

entries.get('/dashboard', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const flash = c.req.query('flash') ?? undefined;
  const [userEvents, acceptingEvents] = await Promise.all([
    getUserEvents(c.env.DB, user.userId),
    getEventsAcceptingParticipants(c.env.DB),
  ]);
  const joinedIds = new Set(userEvents.map((e) => e.id));
  const joinableEvents = acceptingEvents.filter((e) => !joinedIds.has(e.id));
  if (userEvents.length === 0) {
    return c.html(noEventsPage(user, joinableEvents, { flash }));
  }
  if (userEvents.length === 1) {
    const url = flash
      ? `/dashboard/${userEvents[0].id}?flash=${encodeURIComponent(flash)}`
      : `/dashboard/${userEvents[0].id}`;
    return c.redirect(url);
  }
  return c.html(eventsListPage(user, userEvents, { flash, joinableEvents }));
});

entries.get('/dashboard/:eventId', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const eventId = Number(c.req.param('eventId'));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return c.redirect('/dashboard');
  }

  const [event, participant] = await Promise.all([
    getEventById(c.env.DB, eventId),
    getParticipantByUserAndEvent(c.env.DB, eventId, user.userId),
  ]);

  if (!event || !participant) {
    return c.redirect('/dashboard');
  }

  const flash = c.req.query('flash') ?? undefined;
  return renderDashboard(c, user, event, participant, { flash });
});

entries.post('/dashboard/:eventId/leave', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const eventId = Number(c.req.param('eventId'));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return c.redirect('/dashboard');
  }

  const [event, participant] = await Promise.all([
    getEventById(c.env.DB, eventId),
    getParticipantByUserAndEvent(c.env.DB, eventId, user.userId),
  ]);

  if (!event || !participant) {
    return c.redirect('/dashboard');
  }

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/dashboard/${eventId}?error=${encodeURIComponent('You cannot leave an event that has already started.')}`);
  }

  await deleteEventParticipant(c.env.DB, eventId, user.userId);
  return c.redirect('/dashboard?flash=' + encodeURIComponent('You have left the event.'));
});

entries.post('/dashboard/:eventId/join', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const eventId = Number(c.req.param('eventId'));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return c.redirect('/dashboard');
  }

  const [event, existing] = await Promise.all([
    getEventById(c.env.DB, eventId),
    getParticipantByUserAndEvent(c.env.DB, eventId, user.userId),
  ]);

  if (!event || event.status !== 'accepting_participants') {
    return c.redirect('/dashboard?error=' + encodeURIComponent('This event is not open for joining.'));
  }

  if (existing) {
    return c.redirect(`/dashboard/${eventId}?flash=${encodeURIComponent('You are already in this event.')}`);
  }

  // If teams already exist, assign to the smallest team
  const teamCounts = await countParticipantsPerTeam(c.env.DB, eventId);
  const teams = await getTeamsByEvent(c.env.DB, eventId);
  let teamId: number | null = null;
  if (teams.length > 0) {
    const counts = new Map(teamCounts.map((t) => [t.team_id, t.count]));
    const smallest = teams.reduce((a, b) => {
      const aCount = counts.get(a.id) ?? 0;
      const bCount = counts.get(b.id) ?? 0;
      return aCount <= bCount ? a : b;
    });
    teamId = smallest.id;
  }

  await createEventParticipant(c.env.DB, { eventId, userId: user.userId, teamId });
  return c.redirect(`/dashboard/${eventId}?flash=${encodeURIComponent(`Joined ${event.name}.`)}`);
});

async function renderDashboard(
  c: Context<AppEnv>,
  user: NonNullable<AppEnv['Variables']['user']>,
  event: Event,
  participant: Awaited<ReturnType<typeof getParticipantByUserAndEvent>>,
  options: { flash?: string; error?: string } = {}
) {
  const eventId = event.id;
  const teamName = participant?.team_name ?? null;

  if (event.status !== 'active') {
    return c.html(
      dashboardPage(user, event, teamName, [], { total_steps: 0, days_logged: 0 }, [], options)
    );
  }

  const [recentEntries, userStats, teamStats] = await Promise.all([
    getStepEntriesByUserAndEvent(c.env.DB, user.userId, eventId, 10),
    getUserStepSummary(c.env.DB, user.userId, eventId),
    getTeamStepTotals(c.env.DB, eventId),
  ]);
  return c.html(
    dashboardPage(user, event, teamName, recentEntries, userStats, teamStats, options)
  );
}

entries.post('/entries', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const body = await c.req.parseBody({ all: true });
  const eventId = Number(body.eventId);
  const entryDate = String(body.entryDate ?? '');
  const steps = String(body.steps ?? '');
  const image = body.image;

  const [event, participant] = await Promise.all([
    getEventById(c.env.DB, eventId),
    getParticipantByUserAndEvent(c.env.DB, eventId, user.userId),
  ]);

  if (!event || !participant) {
    return c.redirect('/dashboard');
  }

  if (event.status !== 'active' || !participant.team_id) {
    return renderDashboard(c, user, event, participant, {
      error: 'Step entries can only be added to an active event with assigned teams.',
    });
  }

  if (!isValidDate(entryDate)) {
    return renderDashboard(c, user, event, participant, {
      error: 'Please select a valid date (not in the future).',
    });
  }

  if (!isValidSteps(steps)) {
    return renderDashboard(c, user, event, participant, {
      error: 'Steps must be a whole number between 1 and 1,000,000.',
    });
  }

  const imageCheck = validateImage(image);
  if (!imageCheck.ok && imageCheck.error) {
    return renderDashboard(c, user, event, participant, { error: imageCheck.error });
  }

  let imageKey: string | null = null;
  if (imageCheck.ok) {
    imageKey = await storeUserImage(c.env.IMAGES, user.userId, eventId, entryDate, imageCheck.file);
  }

  try {
    await createStepEntry(c.env.DB, {
      eventId,
      userId: user.userId,
      teamId: participant.team_id,
      entryDate,
      steps: Number(steps),
      imageKey,
    });
  } catch (err) {
    // Likely a unique constraint violation for this event/user/date
    return renderDashboard(c, user, event, participant, {
      error: 'You have already logged steps for this date in this event.',
    });
  }

  return renderDashboard(c, user, event, participant, { flash: 'Entry saved.' });
});

entries.post('/entries/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.redirect('/dashboard');
  }

  const entry = await getStepEntryById(c.env.DB, id);
  if (!entry || entry.user_id !== user.userId) {
    return c.redirect('/dashboard');
  }

  const eventId = entry.event_id;
  const participant = await getParticipantByUserAndEvent(c.env.DB, eventId, user.userId);
  if (!participant) {
    return c.redirect('/dashboard');
  }

  const event = await getEventById(c.env.DB, eventId);
  if (!event) {
    return c.redirect('/dashboard');
  }

  if (event.status !== 'active' || !participant.team_id) {
    return renderDashboard(c, user, event, participant, {
      error: 'Step entries can only be updated in an active event with assigned teams.',
    });
  }

  const body = await c.req.parseBody({ all: true });
  const entryDate = String(body.entryDate ?? '');
  const steps = String(body.steps ?? '');
  const image = body.image;

  if (!isValidDate(entryDate)) {
    return renderDashboard(c, user, event, participant, {
      error: 'Please select a valid date (not in the future).',
    });
  }

  if (!isValidSteps(steps)) {
    return renderDashboard(c, user, event, participant, {
      error: 'Steps must be a whole number between 1 and 1,000,000.',
    });
  }

  const imageCheck = validateImage(image);
  if (!imageCheck.ok && imageCheck.error) {
    return renderDashboard(c, user, event, participant, { error: imageCheck.error });
  }

  let imageKey = entry.image_key;
  if (imageCheck.ok) {
    imageKey = await storeUserImage(c.env.IMAGES, user.userId, eventId, entryDate, imageCheck.file);
  }

  try {
    await updateStepEntry(c.env.DB, id, {
      entryDate,
      steps: Number(steps),
      imageKey,
    });
  } catch {
    return renderDashboard(c, user, event, participant, {
      error: 'You have already logged steps for this date in this event.',
    });
  }

  return renderDashboard(c, user, event, participant, { flash: 'Entry updated.' });
});

entries.get('/uploads/*', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const key = c.req.path.replace('/uploads/', '');
  const segments = key.split('/');
  // Expected: uploads/{eventId}/{userId}/{filename}
  if (segments.length < 4 || segments[2] !== String(user.userId)) {
    return new Response('Forbidden', { status: 403 });
  }

  const obj = await c.env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  return c.body(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

export default entries;
