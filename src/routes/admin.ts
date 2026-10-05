import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { approveUser, getPendingUsers } from '../db';
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
  return c.html(adminPage(pending, secret));
});

admin.post('/users/:id/approve', async (c) => {
  const secret = c.req.query('secret')!;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    const pending = await getPendingUsers(c.env.DB);
    return c.html(adminPage(pending, secret, { error: 'Invalid user ID.' }), 400);
  }
  await approveUser(c.env.DB, id);
  const pending = await getPendingUsers(c.env.DB);
  return c.html(adminPage(pending, secret, { flash: 'User approved.' }));
});

export default admin;
