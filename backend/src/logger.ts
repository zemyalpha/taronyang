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
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
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
    logger.http(message.trim());
  },
};
