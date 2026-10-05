export interface Organization {
  id: number;
  name: string;
  allowed_domain: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  organization_id: number;
  role: 'user' | 'admin';
  display_name: string | null;
  created_at: string;
}

export interface Event {
  id: number;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: 'accepting_participants' | 'active' | 'closed';
  started_at: string | null;
  created_at: string;
}

export interface Team {
  id: number;
  event_id: number;
  name: string;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: number;
  team_id: number | null;
  status: 'joined' | 'assigned_team';
  created_at: string;
}

export interface StepEntry {
  id: number;
  event_id: number;
  user_id: number;
  team_id: number;
  entry_date: string;
  steps: number;
  image_key: string | null;
  created_at: string;
}

// Organizations

export async function getOrganizationByDomain(
  db: D1Database,
  domain: string
): Promise<Organization | null> {
  return await db
    .prepare('SELECT * FROM organizations WHERE LOWER(allowed_domain) = LOWER(?)')
    .bind(domain)
    .first<Organization>();
}

export async function getOrganizationById(
  db: D1Database,
  id: number
): Promise<Organization | null> {
  return await db.prepare('SELECT * FROM organizations WHERE id = ?').bind(id).first<Organization>();
}

// Users

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
}

export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
}

export async function createUser(
  db: D1Database,
  input: {
    email: string;
    passwordHash: string;
    passwordSalt: string;
    organizationId: number;
    displayName?: string | null;
  }
): Promise<number> {
  const displayName = input.displayName?.trim() || null;
  const result = await db
    .prepare(
      'INSERT INTO users (email, password_hash, password_salt, organization_id, display_name) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(input.email, input.passwordHash, input.passwordSalt, input.organizationId, displayName)
    .run();
  return result.meta.last_row_id as number;
}

export async function updateUserDisplayName(
  db: D1Database,
  id: number,
  displayName: string | null
): Promise<void> {
  await db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, id).run();
}

export async function updateUserPassword(
  db: D1Database,
  id: number,
  passwordHash: string,
  passwordSalt: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(passwordHash, passwordSalt, id)
    .run();
}

export async function updateUserRole(
  db: D1Database,
  id: number,
  role: 'user' | 'admin'
): Promise<void> {
  await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
}

export async function getAllUsers(
  db: D1Database
): Promise<Array<User & { organization_name: string }>> {
  const { results } = await db
    .prepare(
      `SELECT users.*, organizations.name as organization_name
       FROM users
       JOIN organizations ON users.organization_id = organizations.id
       ORDER BY users.created_at DESC`
    )
    .all<User & { organization_name: string }>();
  return results ?? [];
}

// Events

export async function createEvent(
  db: D1Database,
  input: {
    name: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  }
): Promise<number> {
  const result = await db
    .prepare('INSERT INTO events (name, description, starts_at, ends_at) VALUES (?, ?, ?, ?)')
    .bind(input.name, input.description ?? null, input.startsAt ?? null, input.endsAt ?? null)
    .run();
  return result.meta.last_row_id as number;
}

export async function getEventById(db: D1Database, id: number): Promise<Event | null> {
  return await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<Event>();
}

export async function getAllEvents(db: D1Database): Promise<Event[]> {
  const { results } = await db
    .prepare('SELECT * FROM events ORDER BY created_at DESC')
    .all<Event>();
  return results ?? [];
}

export async function getEventsAcceptingParticipants(db: D1Database): Promise<Event[]> {
  const { results } = await db
    .prepare("SELECT * FROM events WHERE status = 'accepting_participants' ORDER BY created_at DESC")
    .all<Event>();
  return results ?? [];
}

export async function startEvent(db: D1Database, eventId: number): Promise<void> {
  await db
    .prepare("UPDATE events SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(eventId)
    .run();
}

// Teams

export async function createTeam(
  db: D1Database,
  input: { eventId: number; name: string }
): Promise<number> {
  const result = await db
    .prepare('INSERT INTO teams (event_id, name) VALUES (?, ?)')
    .bind(input.eventId, input.name)
    .run();
  return result.meta.last_row_id as number;
}

export async function getTeamById(db: D1Database, id: number): Promise<Team | null> {
  return await db.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first<Team>();
}

export async function getTeamsByEvent(db: D1Database, eventId: number): Promise<Team[]> {
  const { results } = await db
    .prepare('SELECT * FROM teams WHERE event_id = ? ORDER BY name')
    .bind(eventId)
    .all<Team>();
  return results ?? [];
}

export async function deleteTeamsByEvent(db: D1Database, eventId: number): Promise<void> {
  await db.prepare('DELETE FROM teams WHERE event_id = ?').bind(eventId).run();
}

export async function countParticipantsPerTeam(
  db: D1Database,
  eventId: number
): Promise<{ team_id: number; count: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT team_id, COUNT(*) as count
       FROM event_participants
       WHERE event_id = ? AND team_id IS NOT NULL
       GROUP BY team_id`
    )
    .bind(eventId)
    .all<{ team_id: number; count: number }>();
  return results ?? [];
}

export async function countParticipantsByStatus(
  db: D1Database,
  eventId: number,
  status: EventParticipant['status']
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM event_participants WHERE event_id = ? AND status = ?')
    .bind(eventId, status)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function getParticipantsByTeam(
  db: D1Database,
  teamId: number
): Promise<Array<EventParticipant & { user_email: string; user_display_name: string | null }>> {
  const { results } = await db
    .prepare(
      `SELECT event_participants.*, users.email as user_email, users.display_name as user_display_name
       FROM event_participants
       JOIN users ON event_participants.user_id = users.id
       WHERE event_participants.team_id = ?
       ORDER BY users.display_name, users.email`
    )
    .bind(teamId)
    .all<EventParticipant & { user_email: string; user_display_name: string | null }>();
  return results ?? [];
}

// Event participants

export async function createEventParticipant(
  db: D1Database,
  input: { eventId: number; userId: number; teamId?: number | null }
): Promise<number> {
  const teamId = input.teamId ?? null;
  const status = teamId ? 'assigned_team' : 'joined';
  const result = await db
    .prepare('INSERT INTO event_participants (event_id, user_id, team_id, status) VALUES (?, ?, ?, ?)')
    .bind(input.eventId, input.userId, teamId, status)
    .run();
  return result.meta.last_row_id as number;
}

export async function updateParticipantTeam(
  db: D1Database,
  participantId: number,
  teamId: number | null
): Promise<void> {
  const status = teamId ? 'assigned_team' : 'joined';
  await db
    .prepare('UPDATE event_participants SET team_id = ?, status = ? WHERE id = ?')
    .bind(teamId, status, participantId)
    .run();
}

export async function resetParticipantTeams(db: D1Database, eventId: number): Promise<void> {
  await db
    .prepare("UPDATE event_participants SET team_id = NULL, status = 'joined' WHERE event_id = ?")
    .bind(eventId)
    .run();
}

export async function getParticipantByUserAndEvent(
  db: D1Database,
  eventId: number,
  userId: number
): Promise<(EventParticipant & { team_name: string | null; status: EventParticipant['status'] }) | null> {
  return await db
    .prepare(
      `SELECT event_participants.*, teams.name as team_name
       FROM event_participants
       LEFT JOIN teams ON event_participants.team_id = teams.id
       WHERE event_participants.event_id = ? AND event_participants.user_id = ?`
    )
    .bind(eventId, userId)
    .first<EventParticipant & { team_name: string | null }>();
}

export async function getParticipantsByEvent(
  db: D1Database,
  eventId: number
): Promise<Array<EventParticipant & { user_email: string; user_display_name: string | null; team_name: string | null; status: EventParticipant['status'] }>> {
  const { results } = await db
    .prepare(
      `SELECT event_participants.*, users.email as user_email, users.display_name as user_display_name, teams.name as team_name
       FROM event_participants
       JOIN users ON event_participants.user_id = users.id
       LEFT JOIN teams ON event_participants.team_id = teams.id
       WHERE event_participants.event_id = ?
       ORDER BY users.display_name, users.email`
    )
    .bind(eventId)
    .all<EventParticipant & { user_email: string; user_display_name: string | null; team_name: string | null }>();
  return results ?? [];
}

export async function getUsersNotInEvent(db: D1Database, eventId: number): Promise<User[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM users
       WHERE id NOT IN (SELECT user_id FROM event_participants WHERE event_id = ?)
       ORDER BY display_name, email`
    )
    .bind(eventId)
    .all<User>();
  return results ?? [];
}

export async function getUserEvents(
  db: D1Database,
  userId: number
): Promise<Array<Event & { team_id: number | null; team_name: string | null; participant_status: EventParticipant['status'] }>> {
  const { results } = await db
    .prepare(
      `SELECT events.*, event_participants.team_id, event_participants.status as participant_status, teams.name as team_name
       FROM event_participants
       JOIN events ON event_participants.event_id = events.id
       LEFT JOIN teams ON event_participants.team_id = teams.id
       WHERE event_participants.user_id = ?
       ORDER BY events.created_at DESC`
    )
    .bind(userId)
    .all<Event & { team_id: number | null; team_name: string | null; participant_status: EventParticipant['status'] }>();
  return results ?? [];
}

// Step entries

export async function createStepEntry(
  db: D1Database,
  input: {
    eventId: number;
    userId: number;
    teamId: number;
    entryDate: string;
    steps: number;
    imageKey: string | null;
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO step_entries (event_id, user_id, team_id, entry_date, steps, image_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id, entry_date)
       DO UPDATE SET steps = excluded.steps, image_key = COALESCE(excluded.image_key, step_entries.image_key)`
    )
    .bind(input.eventId, input.userId, input.teamId, input.entryDate, input.steps, input.imageKey)
    .run();
  return result.meta.last_row_id as number;
}

export async function getStepEntriesByUserAndEvent(
  db: D1Database,
  userId: number,
  eventId: number,
  limit = 10
): Promise<StepEntry[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM step_entries WHERE user_id = ? AND event_id = ? ORDER BY entry_date DESC LIMIT ?'
    )
    .bind(userId, eventId, limit)
    .all<StepEntry>();
  return results ?? [];
}

export async function getStepEntryById(db: D1Database, id: number): Promise<StepEntry | null> {
  return await db.prepare('SELECT * FROM step_entries WHERE id = ?').bind(id).first<StepEntry>();
}

export async function updateStepEntry(
  db: D1Database,
  id: number,
  input: {
    entryDate: string;
    steps: number;
    imageKey: string | null;
  }
): Promise<void> {
  await db
    .prepare('UPDATE step_entries SET entry_date = ?, steps = ?, image_key = ? WHERE id = ?')
    .bind(input.entryDate, input.steps, input.imageKey, id)
    .run();
}

export async function getUserStepSummary(
  db: D1Database,
  userId: number,
  eventId: number
): Promise<{ total_steps: number; days_logged: number }> {
  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(steps), 0) as total_steps, COUNT(*) as days_logged
       FROM step_entries
       WHERE user_id = ? AND event_id = ?`
    )
    .bind(userId, eventId)
    .first<{ total_steps: number; days_logged: number }>();
  return result ?? { total_steps: 0, days_logged: 0 };
}

export async function getTeamStepTotals(
  db: D1Database,
  eventId: number
): Promise<Array<{ team_name: string; total_steps: number }>> {
  const { results } = await db
    .prepare(
      `SELECT teams.name as team_name, COALESCE(SUM(step_entries.steps), 0) as total_steps
       FROM teams
       LEFT JOIN step_entries ON teams.id = step_entries.team_id AND step_entries.event_id = ?
       WHERE teams.event_id = ?
       GROUP BY teams.id, teams.name
       ORDER BY teams.name`
    )
    .bind(eventId, eventId)
    .all<{ team_name: string; total_steps: number }>();
  return results ?? [];
}

export async function getEventLeaderboard(
  db: D1Database,
  eventId: number
): Promise<Array<{ display_name: string; team_name: string; total_steps: number }>> {
  const { results } = await db
    .prepare(
      `SELECT users.display_name as display_name, teams.name as team_name, COALESCE(SUM(step_entries.steps), 0) as total_steps
       FROM event_participants
       JOIN users ON event_participants.user_id = users.id
       JOIN teams ON event_participants.team_id = teams.id
       LEFT JOIN step_entries ON step_entries.event_id = event_participants.event_id AND step_entries.user_id = users.id
       WHERE event_participants.event_id = ?
       GROUP BY users.id, teams.id
       ORDER BY total_steps DESC`
    )
    .bind(eventId)
    .all<{ display_name: string; team_name: string; total_steps: number }>();
  return results ?? [];
}

export async function getEventStats(
  db: D1Database,
  eventId: number
): Promise<{ total_steps: number; participant_count: number; entry_count: number }> {
  const result = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(steps), 0) FROM step_entries WHERE event_id = ?) as total_steps,
         (SELECT COUNT(*) FROM event_participants WHERE event_id = ?) as participant_count,
         (SELECT COUNT(*) FROM step_entries WHERE event_id = ?) as entry_count`
    )
    .bind(eventId, eventId, eventId)
    .first<{ total_steps: number; participant_count: number; entry_count: number }>();
  return result ?? { total_steps: 0, participant_count: 0, entry_count: 0 };
}

export async function getEventMemberTotals(
  db: D1Database,
  eventId: number
): Promise<Array<{ user_id: number; display_name: string; team_id: number; team_name: string; total_steps: number }>> {
  const { results } = await db
    .prepare(
      `SELECT
         users.id as user_id,
         users.display_name as display_name,
         teams.id as team_id,
         teams.name as team_name,
         COALESCE(SUM(step_entries.steps), 0) as total_steps
       FROM event_participants
       JOIN users ON event_participants.user_id = users.id
       JOIN teams ON event_participants.team_id = teams.id
       LEFT JOIN step_entries ON step_entries.event_id = event_participants.event_id AND step_entries.user_id = users.id
       WHERE event_participants.event_id = ?
       GROUP BY users.id, teams.id
       ORDER BY total_steps DESC`
    )
    .bind(eventId)
    .all<{ user_id: number; display_name: string; team_id: number; team_name: string; total_steps: number }>();
  return results ?? [];
}

export async function getDailyStepTotals(
  db: D1Database,
  eventId: number
): Promise<Array<{ entry_date: string; total_steps: number }>> {
  const { results } = await db
    .prepare(
      `SELECT entry_date, COALESCE(SUM(steps), 0) as total_steps
       FROM step_entries
       WHERE event_id = ?
       GROUP BY entry_date
       ORDER BY entry_date ASC`
    )
    .bind(eventId)
    .all<{ entry_date: string; total_steps: number }>();
  return results ?? [];
}

export async function getStepEntryImageKeysByEvent(
  db: D1Database,
  eventId: number
): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT image_key FROM step_entries WHERE event_id = ? AND image_key IS NOT NULL')
    .bind(eventId)
    .all<{ image_key: string }>();
  return (results ?? []).map((r) => r.image_key);
}

export async function deleteStepEntriesByEvent(db: D1Database, eventId: number): Promise<void> {
  await db.prepare('DELETE FROM step_entries WHERE event_id = ?').bind(eventId).run();
}

export async function deleteEvent(db: D1Database, eventId: number): Promise<void> {
  await db.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();
}

export async function updateTeamName(
  db: D1Database,
  teamId: number,
  name: string
): Promise<void> {
  await db.prepare('UPDATE teams SET name = ? WHERE id = ?').bind(name, teamId).run();
}

export async function deleteEventParticipant(
  db: D1Database,
  eventId: number,
  userId: number
): Promise<void> {
  await db.prepare('DELETE FROM event_participants WHERE event_id = ? AND user_id = ?').bind(eventId, userId).run();
}
