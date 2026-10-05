import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import {
  getUserStepEntries,
  createStepEntry,
  getTeamById,
  getStepEntryById,
  updateStepEntry,
  getUserStepSummary,
  getTeamStepTotals,
} from '../db';
import { isValidDate, isValidSteps } from '../validation';
import { dashboardPage } from '../templates';

const entries = new Hono<AppEnv>();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function imageExtension(type: string): string {
  return type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
}

async function storeUserImage(
  bucket: R2Bucket,
  userId: number,
  entryDate: string,
  file: File
): Promise<string> {
  const ext = imageExtension(file.type);
  const uuid = crypto.randomUUID();
  const key = `uploads/${userId}/${entryDate}-${uuid}.${ext}`;
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

async function renderDashboard(
  c: Context<AppEnv>,
  user: NonNullable<AppEnv['Variables']['user']>,
  options: { flash?: string; error?: string } = {}
) {
  const [team, recentEntries, userStats, teamStats] = await Promise.all([
    getTeamById(c.env.DB, user.teamId),
    getUserStepEntries(c.env.DB, user.userId, 10),
    getUserStepSummary(c.env.DB, user.userId),
    getTeamStepTotals(c.env.DB),
  ]);
  return c.html(dashboardPage(user, team?.name ?? 'Unknown team', recentEntries, userStats, teamStats, options));
}

entries.get('/dashboard', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');
  return renderDashboard(c, user);
});

entries.post('/entries', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const body = await c.req.parseBody({ all: true });
  const teamId = Number(body.teamId);
  const entryDate = String(body.entryDate ?? '');
  const steps = String(body.steps ?? '');
  const image = body.image;

  const team = await getTeamById(c.env.DB, teamId);
  if (!team || team.id !== user.teamId) {
    return renderDashboard(c, user, { error: 'Invalid team selected.' });
  }

  if (!isValidDate(entryDate)) {
    return renderDashboard(c, user, { error: 'Please select a valid date (not in the future).' });
  }

  if (!isValidSteps(steps)) {
    return renderDashboard(c, user, { error: 'Steps must be a whole number between 1 and 1,000,000.' });
  }

  const imageCheck = validateImage(image);
  if (!imageCheck.ok && imageCheck.error) {
    return renderDashboard(c, user, { error: imageCheck.error });
  }

  let imageKey: string | null = null;
  if (imageCheck.ok) {
    imageKey = await storeUserImage(c.env.IMAGES, user.userId, entryDate, imageCheck.file);
  }

  await createStepEntry(c.env.DB, {
    userId: user.userId,
    teamId: team.id,
    entryDate,
    steps: Number(steps),
    imageKey,
  });

  return renderDashboard(c, user, { flash: 'Entry saved.' });
});

entries.post('/entries/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return renderDashboard(c, user, { error: 'Invalid entry ID.' });
  }

  const entry = await getStepEntryById(c.env.DB, id);
  if (!entry || entry.user_id !== user.userId) {
    return renderDashboard(c, user, { error: 'Entry not found.' });
  }

  const body = await c.req.parseBody({ all: true });
  const entryDate = String(body.entryDate ?? '');
  const steps = String(body.steps ?? '');
  const image = body.image;

  if (!isValidDate(entryDate)) {
    return renderDashboard(c, user, { error: 'Please select a valid date (not in the future).' });
  }

  if (!isValidSteps(steps)) {
    return renderDashboard(c, user, { error: 'Steps must be a whole number between 1 and 1,000,000.' });
  }

  const imageCheck = validateImage(image);
  if (!imageCheck.ok && imageCheck.error) {
    return renderDashboard(c, user, { error: imageCheck.error });
  }

  let imageKey = entry.image_key;
  if (imageCheck.ok) {
    imageKey = await storeUserImage(c.env.IMAGES, user.userId, entryDate, imageCheck.file);
  }

  await updateStepEntry(c.env.DB, id, {
    entryDate,
    steps: Number(steps),
    imageKey,
  });

  return renderDashboard(c, user, { flash: 'Entry updated.' });
});

entries.get('/uploads/*', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const key = c.req.path.replace('/uploads/', '');
  if (!key.startsWith(`uploads/${user.userId}/`)) {
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
