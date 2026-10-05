import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { approveUser, getAllUsers, getPendingUsers, updateUserPassword } from '../db';
import { hashPassword } from '../auth';
import { isValidPassword } from '../validation';
import { adminPage, unauthorizedPage } from '../templates';

const admin = new Hono<AppEnv>();

admin.use('*', async (c, next) => {
  const secret = c.req.query('secret');
  if (secret !== c.env.ADMIN_SECRET) {
    return c.html(unauthorizedPage(), 401);
  }
  await next();
});

admin.get('/', async (c) => {
  const secret = c.req.query('secret')!;
  const pending = await getPendingUsers(c.env.DB);
  const users = await getAllUsers(c.env.DB);
  return c.html(adminPage(pending, users, secret));
});

admin.post('/users/:id/approve', async (c) => {
  const secret = c.req.query('secret')!;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    const pending = await getPendingUsers(c.env.DB);
    const users = await getAllUsers(c.env.DB);
    return c.html(adminPage(pending, users, secret, { error: 'Invalid user ID.' }), 400);
  }
  await approveUser(c.env.DB, id);
  const pending = await getPendingUsers(c.env.DB);
  const users = await getAllUsers(c.env.DB);
  return c.html(adminPage(pending, users, secret, { flash: 'User approved.' }));
});

admin.post('/users/:id/reset-password', async (c) => {
  const secret = c.req.query('secret')!;
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const newPassword = String(body.newPassword ?? '');

  const pending = await getPendingUsers(c.env.DB);
  const users = await getAllUsers(c.env.DB);

  if (!Number.isInteger(id) || id <= 0) {
    return c.html(adminPage(pending, users, secret, { error: 'Invalid user ID.' }), 400);
  }
  if (!isValidPassword(newPassword)) {
    return c.html(adminPage(pending, users, secret, { error: 'Password must be at least 8 characters.' }), 400);
  }

  const { hash, salt } = await hashPassword(newPassword);
  await updateUserPassword(c.env.DB, id, hash, salt);
  return c.html(adminPage(pending, users, secret, { flash: 'Password reset.' }));
});

export default admin;
