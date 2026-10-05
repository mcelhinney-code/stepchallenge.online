import type { SessionUser } from './auth';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user?: SessionUser;
  };
};
