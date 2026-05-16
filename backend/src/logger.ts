import winston from 'winston';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { config } from './config';

const logDir = config.logDir;
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  console.error(`Failed to create log directory "${logDir}". File transport logging may not work:`, err);
}

const commonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
);

const consoleFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, service: _service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${util.inspect(meta, { depth: 4, breakLength: Infinity })}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}${stack ? `\n${stack}` : ''}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? winston.format.json() : consoleFormat,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.json(),
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.json(),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }),
];

export const logger = winston.createLogger({
  level: config.logLevel,
  format: commonFormat,
  defaultMeta: { service: 'taronyang' },
  transports,
});

export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
