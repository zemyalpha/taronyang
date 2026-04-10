import dotenv from 'dotenv';
dotenv.config();
import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN || '';
const nodeEnv = process.env.NODE_ENV || 'development';

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: nodeEnv,
    tracesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
  });
}

export { Sentry };
