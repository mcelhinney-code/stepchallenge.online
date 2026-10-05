import { Hono } from 'hono';
import type { AppEnv } from '../types';
import {
  countParticipantsByStatus,
  countParticipantsPerTeam,
  createEvent,
  createEventParticipant,
  createTeam,
  deleteEvent,
  deleteEventParticipant,
  deleteStepEntriesByEvent,
  deleteTeamsByEvent,
  getAllEvents,
  getAllUsers,
  getEventById,
  getEventLeaderboard,
  getEventStats,
  getParticipantByUserAndEvent,
  getParticipantsByEvent,
  getParticipantsByTeam,
  getStepEntryImageKeysByEvent,
  getTeamById,
  getTeamsByEvent,
  getUserById,
  getUsersNotInEvent,
  resetParticipantTeams,
  startEvent,
  updateParticipantTeam,
  updateTeamName,
  updateUserPassword,
  updateUserRole,
} from '../db';
import { hashPassword } from '../auth';
import {
  isValidEventName,
  isValidPassword,
  isValidTeamCount,
  isValidTeamName,
} from '../validation';
import { pickTeamNames } from '../teamNames';
import { adminEventDetailPage, adminEventsPage, adminUsersPage, unauthorizedPage } from '../templates';

const admin = new Hono<AppEnv>();

admin.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.html(unauthorizedPage(user), 403);
  }
  await next();
});

admin.get('/', (c) => c.redirect('/admin/users'));

// Events list & create

admin.get('/events', async (c) => {
  const user = c.get('user')!;
  const events = await getAllEvents(c.env.DB);
  const flash = c.req.query('flash') ?? undefined;
  const error = c.req.query('error') ?? undefined;
  return c.html(adminEventsPage(user, events, { flash, error }));
});

admin.post('/events', async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim() || null;
  const startsAt = String(body.startsAt ?? '').trim() || null;
  const endsAt = String(body.endsAt ?? '').trim() || null;

  if (!isValidEventName(name)) {
    const user = c.get('user')!;
    const events = await getAllEvents(c.env.DB);
    return c.html(adminEventsPage(user, events, { error: 'Event name is required.' }), 400);
  }

  const id = await createEvent(c.env.DB, { name, description, startsAt, endsAt });
  return c.redirect(`/admin/events/${id}`);
});

// Event detail

admin.get('/events/:id', async (c) => {
  const user = c.get('user')!;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.html(unauthorizedPage(user), 400);
  }
  const event = await getEventById(c.env.DB, id);
  if (!event) return c.notFound();

  const [teams, participants, usersNotInEvent, report, stats, pendingCount] = await Promise.all([
    getTeamsByEvent(c.env.DB, id),
    getParticipantsByEvent(c.env.DB, id),
    getUsersNotInEvent(c.env.DB, id),
    getEventLeaderboard(c.env.DB, id),
    getEventStats(c.env.DB, id),
    countParticipantsByStatus(c.env.DB, id, 'joined'),
  ]);

  const teamMembers = new Map<number, Array<{ id: number; user_email: string; user_display_name: string | null }>>();
  for (const p of participants) {
    if (p.team_id) {
      const list = teamMembers.get(p.team_id) ?? [];
      list.push({ id: p.id, user_email: p.user_email, user_display_name: p.user_display_name });
      teamMembers.set(p.team_id, list);
    }
  }

  const flash = c.req.query('flash') ?? undefined;
  const error = c.req.query('error') ?? undefined;
  return c.html(adminEventDetailPage(user, event, teams, participants, usersNotInEvent, report, stats, pendingCount, teamMembers, { flash, error }));
});

admin.post('/events/:id/teams', async (c) => {
  const eventId = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const name = String(body.name ?? '').trim();

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (!isValidTeamName(name)) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Team name is required.')}`);
  }

  await createTeam(c.env.DB, { eventId, name });
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Team created.')}`);
});

admin.post('/events/:id/participants', async (c) => {
  const eventId = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const userId = Number(body.userId);
  const teamIdRaw = Number(body.teamId);
  const teamId = Number.isInteger(teamIdRaw) && teamIdRaw > 0 ? teamIdRaw : null;

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Event has already started.')}`);
  }

  const [user, existing] = await Promise.all([
    getUserById(c.env.DB, userId),
    getParticipantByUserAndEvent(c.env.DB, eventId, userId),
  ]);

  if (!user || existing) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Invalid participant selection.')}`);
  }

  if (teamId) {
    const team = await getTeamById(c.env.DB, teamId);
    if (!team || team.event_id !== eventId) {
      return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Invalid team selection.')}`);
    }
  }

  await createEventParticipant(c.env.DB, { eventId, userId, teamId });
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Participant added.')}`);
});

admin.post('/events/:id/participants/:participantId/team', async (c) => {
  const eventId = Number(c.req.param('id'));
  const participantId = Number(c.req.param('participantId'));
  const body = await c.req.parseBody();
  const teamId = Number(body.teamId);

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Teams are locked once the event has started.')}`);
  }

  const participants = await getParticipantsByEvent(c.env.DB, eventId);
  const participant = participants.find((p) => p.id === participantId);
  const team = await getTeamById(c.env.DB, teamId);

  if (!participant || !team || team.event_id !== eventId) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Invalid team change.')}`);
  }

  await updateParticipantTeam(c.env.DB, participantId, teamId);
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Team updated.')}`);
});

admin.post('/events/:id/participants/:participantId/remove', async (c) => {
  const eventId = Number(c.req.param('id'));
  const participantId = Number(c.req.param('participantId'));

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Participants cannot be removed once the event has started.')}`);
  }

  const participants = await getParticipantsByEvent(c.env.DB, eventId);
  const participant = participants.find((p) => p.id === participantId);
  if (!participant) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Participant not found.')}`);
  }

  await deleteEventParticipant(c.env.DB, eventId, participant.user_id);
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Participant removed.')}`);
});

admin.post('/events/:id/teams/:teamId', async (c) => {
  const eventId = Number(c.req.param('id'));
  const teamId = Number(c.req.param('teamId'));
  const body = await c.req.parseBody();
  const name = String(body.name ?? '').trim();
  const addUserId = Number(body.addUserId ?? 0);

  const [event, team] = await Promise.all([
    getEventById(c.env.DB, eventId),
    getTeamById(c.env.DB, teamId),
  ]);
  if (!event || !team || team.event_id !== eventId) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Team not found.')}`);
  }

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Teams are locked once the event has started.')}`);
  }

  if (name && isValidTeamName(name) && name !== team.name) {
    await updateTeamName(c.env.DB, teamId, name);
  }

  if (Number.isInteger(addUserId) && addUserId > 0) {
    const [user, existing] = await Promise.all([
      getUserById(c.env.DB, addUserId),
      getParticipantByUserAndEvent(c.env.DB, eventId, addUserId),
    ]);
    if (user && !existing) {
      await createEventParticipant(c.env.DB, { eventId, userId: addUserId, teamId });
    }
  }

  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Team updated.')}`);
});

admin.post('/events/:id/generate-teams', async (c) => {
  const eventId = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const count = Number(body.numberOfTeams);

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Event has already started.')}`);
  }

  if (!isValidTeamCount(count)) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Team count must be between 1 and 100.')}`);
  }

  const participants = await getParticipantsByEvent(c.env.DB, eventId);
  if (participants.length === 0) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('No participants to assign.')}`);
  }

  if (count > participants.length) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Cannot have more teams than participants.')}`);
  }

  // Wipe existing assignments first so deleting teams does not cascade to participants
  await resetParticipantTeams(c.env.DB, eventId);
  await deleteTeamsByEvent(c.env.DB, eventId);

  const existingTeams = await getTeamsByEvent(c.env.DB, eventId);
  const usedNames = new Set(existingTeams.map((t) => t.name));
  const teamNames = pickTeamNames(count, usedNames);

  const teamIds: number[] = [];
  for (const name of teamNames) {
    const id = await createTeam(c.env.DB, { eventId, name });
    teamIds.push(id);
  }

  // Shuffle participants and assign round-robin to teams
  const shuffled = participants.map((p) => p.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 0; i < shuffled.length; i++) {
    const teamId = teamIds[i % teamIds.length];
    await updateParticipantTeam(c.env.DB, shuffled[i], teamId);
  }

  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent(`Generated ${count} teams.`)}`);
});

admin.post('/events/:id/shuffle-teams', async (c) => {
  const eventId = Number(c.req.param('id'));

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Event has already started.')}`);
  }

  const teams = await getTeamsByEvent(c.env.DB, eventId);
  if (teams.length === 0) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('No teams to shuffle.')}`);
  }

  const participants = await getParticipantsByEvent(c.env.DB, eventId);
  if (participants.length === 0) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('No participants to shuffle.')}`);
  }

  // Keep existing teams but reshuffle all participants across them
  await resetParticipantTeams(c.env.DB, eventId);

  const teamIds = teams.map((t) => t.id);
  const shuffled = participants.map((p) => p.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 0; i < shuffled.length; i++) {
    const teamId = teamIds[i % teamIds.length];
    await updateParticipantTeam(c.env.DB, shuffled[i], teamId);
  }

  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Teams shuffled.')}`);
});

admin.post('/events/:id/assign-pending', async (c) => {
  const eventId = Number(c.req.param('id'));

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Event has already started.')}`);
  }

  const teams = await getTeamsByEvent(c.env.DB, eventId);
  if (teams.length === 0) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Create teams before assigning participants.')}`);
  }

  const pending = await getParticipantsByEvent(c.env.DB, eventId).then((list) =>
    list.filter((p) => p.status === 'joined')
  );
  if (pending.length === 0) {
    return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('No pending participants.')}`);
  }

  // Load-balance: assign each pending participant to the current smallest team
  for (const participant of pending) {
    const counts = await countParticipantsPerTeam(c.env.DB, eventId);
    const countMap = new Map(counts.map((c) => [c.team_id, c.count]));
    const smallest = teams.reduce((a, b) => {
      const aCount = countMap.get(a.id) ?? 0;
      const bCount = countMap.get(b.id) ?? 0;
      return aCount <= bCount ? a : b;
    });
    await updateParticipantTeam(c.env.DB, participant.id, smallest.id);
  }

  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent(`Assigned ${pending.length} pending participants to teams.`)}`);
});

admin.post('/events/:id/participants/:participantId/remove-from-team', async (c) => {
  const eventId = Number(c.req.param('id'));
  const participantId = Number(c.req.param('participantId'));

  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Teams are locked once the event has started.')}`);
  }

  const participants = await getParticipantsByEvent(c.env.DB, eventId);
  const participant = participants.find((p) => p.id === participantId);
  if (!participant || !participant.team_id) {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Participant is not on a team.')}`);
  }

  await updateParticipantTeam(c.env.DB, participantId, null);
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Participant removed from team.')}`);
});

admin.post('/events/:id/start', async (c) => {
  const eventId = Number(c.req.param('id'));
  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  if (event.status !== 'accepting_participants') {
    return c.redirect(`/admin/events/${eventId}?error=${encodeURIComponent('Event has already started.')}`);
  }

  await startEvent(c.env.DB, eventId);
  return c.redirect(`/admin/events/${eventId}?flash=${encodeURIComponent('Event started. Good luck!')}`);
});

admin.post('/events/:id/delete', async (c) => {
  const eventId = Number(c.req.param('id'));
  const event = await getEventById(c.env.DB, eventId);
  if (!event) return c.notFound();

  const imageKeys = await getStepEntryImageKeysByEvent(c.env.DB, eventId);
  await Promise.all(imageKeys.map((key) => c.env.IMAGES.delete(key)));
  await deleteStepEntriesByEvent(c.env.DB, eventId);
  await deleteEvent(c.env.DB, eventId);

  return c.redirect(`/admin/events?flash=${encodeURIComponent(`Event "${event.name}" deleted.`)}`);
});

// Users

admin.get('/users', async (c) => {
  const user = c.get('user')!;
  const users = await getAllUsers(c.env.DB);
  const flash = c.req.query('flash') ?? undefined;
  const error = c.req.query('error') ?? undefined;
  return c.html(adminUsersPage(user, users, { flash, error }));
});

admin.post('/users/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const newPassword = String(body.newPassword ?? '');

  const user = await getUserById(c.env.DB, id);
  if (!user) return c.notFound();

  const adminUser = c.get('user')!;

  if (!isValidPassword(newPassword)) {
    const users = await getAllUsers(c.env.DB);
    return c.html(adminUsersPage(adminUser, users, { error: 'Password must be at least 8 characters.' }), 400);
  }

  const { hash, salt } = await hashPassword(newPassword);
  await updateUserPassword(c.env.DB, id, hash, salt);

  const users = await getAllUsers(c.env.DB);
  return c.html(adminUsersPage(adminUser, users, { flash: `Password reset for ${user.email}.` }));
});

admin.post('/users/:id/role', async (c) => {
  const adminUser = c.get('user')!;
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const role = String(body.role ?? 'user');

  const user = await getUserById(c.env.DB, id);
  if (!user) return c.notFound();

  if (role !== 'user' && role !== 'admin') {
    const users = await getAllUsers(c.env.DB);
    return c.html(adminUsersPage(adminUser, users, { error: 'Invalid role.' }), 400);
  }

  await updateUserRole(c.env.DB, id, role as 'user' | 'admin');

  const users = await getAllUsers(c.env.DB);
  return c.html(adminUsersPage(adminUser, users, { flash: `${user.email} is now ${role}.` }));
});

export default admin;
