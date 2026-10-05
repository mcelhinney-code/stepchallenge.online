import { Hono } from 'hono';
import type { AppEnv } from '../types';
import {
  createSession,
  deleteSession,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
} from '../auth';
import { createUser, getOrganizationByDomain, getUserByEmail, updateUserDisplayName } from '../db';
import {
  getEmailDomain,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
} from '../validation';
import { loginPage, profilePage, registerPage } from '../templates';

const auth = new Hono<AppEnv>();

auth.get('/register', (c) => c.html(registerPage(undefined, c.get('user'))));

auth.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const displayName = String(body.displayName ?? '').trim() || null;

  const currentUser = c.get('user');

  if (!isValidEmail(email)) {
    return c.html(registerPage('Please enter a valid email address.', currentUser), 400);
  }
  if (!isValidPassword(password)) {
    return c.html(registerPage('Password must be at least 8 characters.', currentUser), 400);
  }
  if (!isValidDisplayName(displayName)) {
    return c.html(registerPage('Display name must be 100 characters or fewer and cannot contain <, >, ", or \\.', currentUser), 400);
  }

  const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<number>('id');
  if (existingEmail) {
    return c.html(registerPage('This email is already registered.'), 409);
  }

  const domain = getEmailDomain(email);
  const organization = await getOrganizationByDomain(c.env.DB, domain);
  if (!organization) {
    return c.html(
      registerPage(`The @${domain} domain is not registered with an organization. Please contact an admin.`),
      400
    );
  }

  const { hash, salt } = await hashPassword(password);
  await createUser(c.env.DB, {
    email,
    passwordHash: hash,
    passwordSalt: salt,
    organizationId: organization.id,
    displayName,
  });

  return c.redirect('/login?registered=1');
});

auth.get('/login', (c) => {
  if (c.get('user')) return c.redirect('/dashboard');
  const registered = c.req.query('registered');
  const success = registered ? 'Registration successful. You can now log in.' : undefined;
  return c.html(loginPage(undefined, success, c.get('user')));
});

auth.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const currentUser = c.get('user');

  const user = await getUserByEmail(c.env.DB, email);
  if (!user) {
    return c.html(loginPage('Invalid email or password.', undefined, currentUser), 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    return c.html(loginPage('Invalid email or password.', undefined, currentUser), 401);
  }

  const token = await createSession(c.env.SESSIONS, {
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    organizationId: user.organization_id,
    role: user.role,
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
    return c.html(
      profilePage(user, { error: 'Display name must be 100 characters or fewer and cannot contain <, >, ", or \\.' }),
      400
    );
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
