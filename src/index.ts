import { Hono } from 'hono';
import type { AppEnv } from './types';
import { getSession, getSessionToken } from './auth';
import authRoutes from './routes/auth';
import entriesRoutes from './routes/entries';
import adminRoutes from './routes/admin';
import { homePage, notFoundPage } from './templates';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const token = getSessionToken(c);
  if (token) {
    const user = await getSession(c.env.SESSIONS, token);
    if (user) {
      c.set('user', user);
    }
  }
  await next();
});

app.get('/', (c) => {
  const user = c.get('user');
  if (user) return c.redirect('/dashboard');
  return c.html(homePage());
});
app.route('/', authRoutes);
app.route('/', entriesRoutes);
app.route('/admin', adminRoutes);

app.notFound((c) => c.html(notFoundPage(c.get('user')), 404));

app.onError((err, c) => {
  console.error(err);
  return c.text('Something went wrong.', 500);
});

export default app;
