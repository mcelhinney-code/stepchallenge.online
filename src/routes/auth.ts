import { Hono } from 'hono';
import type { AppEnv } from '../types';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  deleteSession,
  getPasswordResetToken,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
} from '../auth';
import {
  createUser,
  getOrganizationByDomain,
  getUserByEmail,
  getUserById,
  updateUserDisplayName,
  updateUserPassword,
} from '../db';
import { sendPasswordResetEmail } from '../email';
import {
  getEmailDomain,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
} from '../validation';
import { forgotPasswordPage, loginPage, profilePage, registerPage, resetPasswordPage } from '../templates';

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

// Forgot password

const FORGOT_PASSWORD_RATE_LIMIT_SECONDS = 60;

auth.get('/forgot-password', (c) => {
  if (c.get('user')) return c.redirect('/profile');
  const flashSuccess = c.req.query('flash-success') ?? undefined;
  const flashError = c.req.query('flash-error') ?? undefined;
  return c.html(forgotPasswordPage(undefined, flashSuccess, flashError, c.get('user')));
});

auth.post('/forgot-password', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const currentUser = c.get('user');

  if (!isValidEmail(email)) {
    return c.html(forgotPasswordPage('Please enter a valid email address.', undefined, undefined, currentUser), 400);
  }

  const rateLimitKey = `rate-limit:forgot-password:${email}`;
  const limited = await c.env.PASSWORD_RESET.get(rateLimitKey);
  if (limited) {
    return c.html(forgotPasswordPage('Please wait before requesting another reset.', undefined, undefined, currentUser), 429);
  }

  const user = await getUserByEmail(c.env.DB, email);
  if (!user) {
    await c.env.PASSWORD_RESET.put(rateLimitKey, '1', { expirationTtl: FORGOT_PASSWORD_RATE_LIMIT_SECONDS });
    return c.html(forgotPasswordPage('No account found for that email.', undefined, undefined, currentUser), 400);
  }

  await c.env.PASSWORD_RESET.put(rateLimitKey, '1', { expirationTtl: FORGOT_PASSWORD_RATE_LIMIT_SECONDS });

  const token = await createPasswordResetToken(c.env.PASSWORD_RESET, user.id);
  const origin = new URL(c.req.url).origin;
  const sent = await sendPasswordResetEmail(user.email, token, origin, c.env);

  if (!sent) {
    return c.html(forgotPasswordPage('Unable to send reset email. Please try again later.', undefined, undefined, currentUser), 500);
  }

  return c.redirect(`/forgot-password?flash-success=${encodeURIComponent('Check your email for a reset link.')}`);
});

auth.get('/forgot-password/:token', async (c) => {
  const token = c.req.param('token');

  const userId = await getPasswordResetToken(c.env.PASSWORD_RESET, token);
  if (!userId) {
    return c.redirect(`/forgot-password?flash-error=${encodeURIComponent('This reset link is invalid or has expired.')}`);
  }

  return c.html(resetPasswordPage(token, undefined, c.get('user')));
});

auth.post('/forgot-password/:token', async (c) => {
  const token = c.req.param('token');
  const body = await c.req.parseBody();
  const password = String(body.password ?? '');
  const currentUser = c.get('user');

  if (!isValidPassword(password)) {
    return c.html(resetPasswordPage(token, 'Password must be at least 8 characters.', currentUser), 400);
  }

  const userId = await consumePasswordResetToken(c.env.PASSWORD_RESET, token);
  if (!userId) {
    return c.html(resetPasswordPage(token, 'This reset link is invalid or has expired.', currentUser), 400);
  }

  const user = await getUserById(c.env.DB, userId);
  if (!user) {
    return c.html(resetPasswordPage(token, 'Unable to reset password. Please request a new link.', currentUser), 400);
  }

  const { hash, salt } = await hashPassword(password);
  await updateUserPassword(c.env.DB, user.id, hash, salt);

  const sessionToken = await createSession(c.env.SESSIONS, {
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    organizationId: user.organization_id,
    role: user.role,
  });
  setSessionCookie(c, sessionToken);
  return c.redirect(`/profile?flash=${encodeURIComponent('Password successfully reset')}`);
});

auth.get('/profile', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login');
  const flash = c.req.query('flash') ?? undefined;
  return c.html(profilePage(user, { flash }));
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
