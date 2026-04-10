import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const logDir = config.logDir;
let logDirReady = false;
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  logDirReady = true;
} catch (err) {
  console.error('Failed to create log directory — file transports disabled:', err);
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
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, service: _service, ...meta } = info;
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return timestamp + ' [' + level + ']: ' + message + metaStr + (stack ? '\n' + stack : '');
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? logFormat : consoleFormat,
  }),
];

if (logDirReady) {
  transports.push(
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
  );
}

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
