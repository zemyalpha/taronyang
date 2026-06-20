/** 구조화된 로깅 — JSON 형식 (프로덕션) / 가독성 형식 (개발) */
import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel = config.nodeEnv === 'production' ? 'info' : 'debug';

function formatLog(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const entry = { ...(meta || {}), timestamp, level, msg };
  if (config.nodeEnv === 'production') {
    try {
      return JSON.stringify(entry);
    } catch (err) {
      return JSON.stringify({
        timestamp,
        level: 'error',
        msg: 'Failed to serialize log message: ' + msg,
        error: String(err),
      });
    }
  }
  let metaStr = '';
  if (meta) {
    try {
      metaStr = ' ' + JSON.stringify(meta);
    } catch (err) {
      metaStr = ' [Serialization Failed: ' + String(err) + ']';
    }
  }
  return '[' + timestamp + '] ' + level.toUpperCase() + ': ' + msg + metaStr;
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level('debug')] >= LEVEL_PRIORITY[minLevel]) {
      console.debug(formatLog('debug', msg, meta));
    }
  },
  info(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level('info')] >= LEVEL_PRIORITY[minLevel]) {
      console.log(formatLog('info', msg, meta));
    }
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level('warn')] >= LEVEL_PRIORITY[minLevel]) {
      console.warn(formatLog('warn', msg, meta));
    }
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level('error')] >= LEVEL_PRIORITY[minLevel]) {
      console.error(formatLog('error', msg, meta));
    }
  },
};

function level(l: LogLevel): LogLevel {
  return l;
}
