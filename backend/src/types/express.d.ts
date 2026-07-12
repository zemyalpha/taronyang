import type { User } from '../database';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}
