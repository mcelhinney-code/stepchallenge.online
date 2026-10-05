export interface Team {
  id: number;
  slug: string;
  name: string;
  allowed_domains: string;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  team_id: number;
  status: 'pending' | 'approved' | 'rejected';
  role: 'user' | 'admin';
  display_name: string | null;
  created_at: string;
}

export interface StepEntry {
  id: number;
  user_id: number;
  team_id: number;
  entry_date: string;
  steps: number;
  image_key: string | null;
  created_at: string;
}

export async function getAllTeams(db: D1Database): Promise<Team[]> {
  const { results } = await db.prepare('SELECT * FROM teams ORDER BY name').all<Team>();
  return results ?? [];
}

export async function getTeamById(db: D1Database, id: number): Promise<Team | null> {
  return await db.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first<Team>();
}

export async function getTeamBySlug(db: D1Database, slug: string): Promise<Team | null> {
  return await db.prepare('SELECT * FROM teams WHERE slug = ?').bind(slug).first<Team>();
}

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
    teamId: number;
    displayName?: string | null;
  }
): Promise<number> {
  const displayName = input.displayName?.trim() || null;
  const result = await db
    .prepare(
      'INSERT INTO users (email, password_hash, password_salt, team_id, status, role, display_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(input.email, input.passwordHash, input.passwordSalt, input.teamId, 'pending', 'user', displayName)
    .run();
  return result.meta.last_row_id as number;
}

export async function updateUserDisplayName(db: D1Database, id: number, displayName: string | null): Promise<void> {
  await db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, id).run();
}

export async function getPendingUsers(db: D1Database): Promise<Array<User & { team_name: string }>> {
  const { results } = await db
    .prepare(
      `SELECT users.*, teams.name as team_name
       FROM users
       JOIN teams ON users.team_id = teams.id
       WHERE users.status = 'pending'
       ORDER BY users.created_at`
    )
    .all<User & { team_name: string }>();
  return results ?? [];
}

export async function approveUser(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").bind(id).run();
}

export async function createStepEntry(
  db: D1Database,
  input: {
    userId: number;
    teamId: number;
    entryDate: string;
    steps: number;
    imageKey: string | null;
  }
): Promise<number> {
  const result = await db
    .prepare('INSERT INTO step_entries (user_id, team_id, entry_date, steps, image_key) VALUES (?, ?, ?, ?, ?)')
    .bind(input.userId, input.teamId, input.entryDate, input.steps, input.imageKey)
    .run();
  return result.meta.last_row_id as number;
}

export async function getUserStepEntries(db: D1Database, userId: number, limit = 10): Promise<StepEntry[]> {
  const { results } = await db
    .prepare('SELECT * FROM step_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT ?')
    .bind(userId, limit)
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
