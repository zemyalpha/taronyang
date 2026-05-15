import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const logDir = config.logDir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, service: _service, ...meta }) => {
    const safeMeta: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        safeMeta[key] = { message: value.message, stack: value.stack };
      } else {
        safeMeta[key] = value;
      }
    }
    let metaStr = '';
    try {
      metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
    } catch {
      metaStr = ' [meta serialization failed]';
    }
    return `${timestamp} [${level}]: ${message}${metaStr}${stack ? `\n${stack}` : ''}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? logFormat : consoleFormat,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }),
];

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'taronyang' },
  transports,
});

export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
