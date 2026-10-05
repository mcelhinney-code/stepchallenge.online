import type { SessionUser } from './auth';

export type AppEnv = {
  Bindings: Env & {
    ADMIN_SECRET: string;
  };
  Variables: {
    user?: SessionUser;
  };
};
