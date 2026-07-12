/** SQLite 데이터베이스 초기화 및 사용자 CRUD */
import Database from 'better-sqlite3';
import { config } from './config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from './logger';

let db: Database.Database;

/** DB 연결 반환 */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** 테이블 생성 */
export function initDb(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'email',
      provider_id TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      nickname TEXT,
      birth_date TEXT,
      zodiac_sign TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      free_count_today INTEGER NOT NULL DEFAULT 0,
      free_reset_date TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'free',
      subscription_expires_at TEXT,
      settings TEXT NOT NULL DEFAULT '{}',
      is_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category TEXT NOT NULL,
      question TEXT,
      cards_drawn TEXT NOT NULL,
      card_positions TEXT NOT NULL,
      interpretation TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      rating INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_horoscopes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      date TEXT NOT NULL,
      zodiac_sign TEXT NOT NULL,
      card_name TEXT,
      summary TEXT,
      scores TEXT,
      lucky_color TEXT,
      lucky_number INTEGER,
      full_reading TEXT,
      email_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS processed_payments (
      imp_uid TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      props TEXT NOT NULL DEFAULT '{}',
      path TEXT,
      referrer TEXT,
      session_id TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id);
    CREATE INDEX IF NOT EXISTS idx_readings_created ON readings(created_at);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_horoscopes(date, zodiac_sign);
    CREATE INDEX IF NOT EXISTS idx_daily_user ON daily_horoscopes(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON processed_payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
  `);
}

// --- 사용자 타입 ---
export interface User {
  id: string;
  provider: string;
  provider_id: string | null;
  email: string | null;
  password_hash: string | null;
  nickname: string | null;
  birth_date: string | null;
  zodiac_sign: string | null;
  created_at: string;
  free_count_today: number;
  free_reset_date: string | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  settings: string;
  is_admin: number;
}

/** 이메일 사용자 생성 */
export function createUser(email: string, password: string, nickname?: string): User | null {
  const db = getDb();
  const userId = randomUUID();
  const hashed = bcrypt.hashSync(password, 10);
  const nick = nickname || email.split('@')[0];
  const isAdmin = isAdminEmail(email) ? 1 : 0;

  try {
    db.prepare(
      'INSERT INTO users (id, provider, email, password_hash, nickname, is_admin) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'email', email, hashed, nick, isAdmin);
    return getUserById(userId);
  } catch (err) {
    logger.error('사용자 생성 실패', { error: String(err) });
    return null;
  }
}

/** 이메일/비밀번호 확인 */
export function verifyUser(email: string, password: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND provider = ?').get(email, 'email') as User | undefined;
  if (!row) return null;
  if (bcrypt.compareSync(password, row.password_hash || '')) return row;
  return null;
}

/** ID로 사용자 조회 */
export function getUserById(id: string): User | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User) || null;
}

/** 이메일로 사용자 조회 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User) || null;
}

/** 소셜 계정으로 찾기 또는 생성 */
export function findOrCreateOAuthUser(info: { provider: string; provider_id: string; email?: string; nickname?: string }): User {
  const db = getDb();

  // provider + provider_id로 찾기
  const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(info.provider, info.provider_id) as User | undefined;
  if (existing) return existing;

  // 이메일로 기존 계정 찾기 (병합)
  if (info.email) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(info.email) as User | undefined;
    if (byEmail) {
      db.prepare('UPDATE users SET provider = ?, provider_id = ? WHERE id = ?').run(info.provider, info.provider_id, byEmail.id);
      return getUserById(byEmail.id)!;
    }
  }

  // 새 사용자 생성
  const userId = randomUUID();
  const nickname = info.nickname || info.email?.split('@')[0] || '사용자';
  const isAdmin = info.email ? (isAdminEmail(info.email) ? 1 : 0) : 0;
  db.prepare('INSERT INTO users (id, provider, provider_id, email, nickname, is_admin) VALUES (?, ?, ?, ?, ?, ?)').run(userId, info.provider, info.provider_id, info.email || null, nickname, isAdmin);
  return getUserById(userId)!;
}

function randomUUID(): string {
  return crypto.randomUUID();
}

/** 관리자 이메일 확인 */
function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}

/** 오늘 날짜 (KST 기준 YYYY-MM-DD) — UTC epoch 기반으로 timezone 독립적 */
function todayString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 무료 월터 사용량 확인 및 증가 — true면 허용, false면 초과 */
export function checkAndIncrementFreeQuota(user: User): boolean {
  const db = getDb();
  const today = todayString();

  if (user.subscription_status === 'premium') return true;

  const result = db.prepare(
    "UPDATE users " +
    "SET free_count_today = CASE WHEN free_reset_date = ? THEN free_count_today + 1 ELSE 1 END, " +
    "    free_reset_date = ? " +
    "WHERE id = ? AND (free_reset_date IS NULL OR free_reset_date != ? OR free_count_today < ?)"
  ).run(today, today, user.id, today, config.freeDailyLimit);

  if (result.changes === 0) return false;

  const updated = getUserById(user.id);
  if (updated) {
    user.free_count_today = updated.free_count_today;
    user.free_reset_date = updated.free_reset_date;
  }
  return true;
}

/** 사용자의 남은 무료 월터 횟수 */
export function getRemainingFreeCount(user: User): number {
  if (user.subscription_status === 'premium') return -1;
  const today = todayString();
  if (user.free_reset_date !== today) return config.freeDailyLimit;
  return Math.max(0, config.freeDailyLimit - user.free_count_today);
}
