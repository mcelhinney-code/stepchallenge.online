import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createSession, deleteSession, hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, getSessionToken, randomToken } from '../auth';
import { createUser, getAllTeams, getTeamById, getUserByEmail, updateUserDisplayName } from '../db';
import { isAllowedDomain, isValidDisplayName, isValidEmail, isValidPassword, parseAllowedDomains } from '../validation';
import { loginPage, profilePage, registerPage, registerTeamPage } from '../templates';

const REGISTRATION_TTL_SECONDS = 60 * 15; // 15 minutes

interface RegistrationPayload {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string | null;
}

function registrationKey(token: string): string {
  return `reg:${token}`;
}

async function storeRegistration(
  sessions: KVNamespace,
  payload: RegistrationPayload
): Promise<string> {
  const token = randomToken();
  await sessions.put(registrationKey(token), JSON.stringify(payload), {
    expirationTtl: REGISTRATION_TTL_SECONDS,
  });
  return token;
}

async function getRegistration(sessions: KVNamespace, token: string): Promise<RegistrationPayload | null> {
  const data = await sessions.get(registrationKey(token));
  if (!data) return null;
  try {
    return JSON.parse(data) as RegistrationPayload;
  } catch {
    return null;
  }
}

async function deleteRegistration(sessions: KVNamespace, token: string): Promise<void> {
  await sessions.delete(registrationKey(token));
}

const auth = new Hono<AppEnv>();

auth.get('/register', (c) => c.html(registerPage()));

auth.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const displayName = String(body.displayName ?? '').trim() || null;

  if (!isValidEmail(email)) {
    return c.html(registerPage('Please enter a valid email address.'), 400);
  }
  if (!isValidPassword(password)) {
    return c.html(registerPage('Password must be at least 8 characters.'), 400);
  }
  if (!isValidDisplayName(displayName)) {
    return c.html(registerPage('Display name must be 100 characters or fewer and cannot contain <, >, ", or \\.'), 400);
  }

  const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<number>('id');
  if (existingEmail) {
    return c.html(registerPage('This email is already registered.'), 409);
  }

  const allTeams = await getAllTeams(c.env.DB);
  const matchingTeams = allTeams.filter((team) => {
    const domains = parseAllowedDomains(team.allowed_domains);
    return isAllowedDomain(email, domains);
  });

  if (matchingTeams.length === 0) {
    const domain = email.split('@')[1] ?? email;
    return c.html(
      registerPage(`No teams are set up for the @${domain} domain. Please contact an admin.`),
      400
    );
  }

  const { hash, salt } = await hashPassword(password);
  const token = await storeRegistration(c.env.SESSIONS, {
    email,
    passwordHash: hash,
    passwordSalt: salt,
    displayName,
  });

  return c.html(registerTeamPage(email, matchingTeams, undefined, token));
});

auth.get('/register/team', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.redirect('/register');
  const payload = await getRegistration(c.env.SESSIONS, token);
  if (!payload) return c.html(registerPage('Your registration session expired. Please start again.'), 400);

  const allTeams = await getAllTeams(c.env.DB);
  const matchingTeams = allTeams.filter((team) => {
    const domains = parseAllowedDomains(team.allowed_domains);
    return isAllowedDomain(payload.email, domains);
  });

  return c.html(registerTeamPage(payload.email, matchingTeams, undefined, token));
});

auth.post('/register/team', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '');
  const teamId = Number(body.teamId);

  const payload = await getRegistration(c.env.SESSIONS, token);
  if (!payload) {
    return c.html(registerPage('Your registration session expired. Please start again.'), 400);
  }

  const team = await getTeamById(c.env.DB, teamId);
  if (!team) {
    const allTeams = await getAllTeams(c.env.DB);
    const matchingTeams = allTeams.filter((t) => {
      const domains = parseAllowedDomains(t.allowed_domains);
      return isAllowedDomain(payload.email, domains);
    });
    return c.html(registerTeamPage(payload.email, matchingTeams, 'Please select a valid team.', token), 400);
  }

  const allowedDomains = parseAllowedDomains(team.allowed_domains);
  if (!isAllowedDomain(payload.email, allowedDomains)) {
    const allTeams = await getAllTeams(c.env.DB);
    const matchingTeams = allTeams.filter((t) => {
      const domains = parseAllowedDomains(t.allowed_domains);
      return isAllowedDomain(payload.email, domains);
    });
    return c.html(registerTeamPage(payload.email, matchingTeams, 'Selected team does not match your email domain.', token), 400);
  }

  await createUser(c.env.DB, {
    email: payload.email,
    passwordHash: payload.passwordHash,
    passwordSalt: payload.passwordSalt,
    teamId: team.id,
    displayName: payload.displayName,
  });
  await deleteRegistration(c.env.SESSIONS, token);

  return c.redirect('/login?registered=1');
});

auth.get('/login', (c) => {
  if (c.get('user')) return c.redirect('/dashboard');

  const registered = c.req.query('registered');
  const denied = c.req.query('denied');
  let success: string | undefined;
  let error: string | undefined;
  if (registered) success = 'Registration successful. Please wait for admin approval before logging in.';
  if (denied) error = 'Your account is pending approval.';
  return c.html(loginPage(error, success));
});

auth.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const user = await getUserByEmail(c.env.DB, email);
  if (!user) {
    return c.html(loginPage('Invalid email or password.'), 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    return c.html(loginPage('Invalid email or password.'), 401);
  }

  if (user.status !== 'approved') {
    return c.redirect('/login?denied=1');
  }

  const token = await createSession(c.env.SESSIONS, {
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    teamId: user.team_id,
    role: user.role,
    status: user.status,
  });
  setSessionCookie(c, token);
  return c.redirect('/dashboard');
});

auth.get('/profile', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');
  return c.html(profilePage(user));
});

auth.post('/profile', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');

  const body = await c.req.parseBody();
  const displayName = String(body.displayName ?? '').trim() || null;

  if (!isValidDisplayName(displayName)) {
    return c.html(profilePage(user, { error: 'Display name must be 100 characters or fewer and cannot contain <, >, ", or \\.' }), 400);
  }

  await updateUserDisplayName(c.env.DB, user.userId, displayName);
  user.displayName = displayName;
  return c.html(profilePage(user, { flash: 'Profile updated.' }));
});

auth.post('/logout', async (c) => {
  const token = getSessionToken(c);
  if (token) {
    await deleteSession(c.env.SESSIONS, token);
  }
  clearSessionCookie(c);
  return c.redirect('/');
});

export default auth;
