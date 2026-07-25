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

/** DB 연결 안전하게 종료 (graceful shutdown) */
export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider, provider_id) WHERE provider_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id);
    CREATE INDEX IF NOT EXISTS idx_readings_created ON readings(created_at);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_horoscopes(date, zodiac_sign);
    CREATE INDEX IF NOT EXISTS idx_daily_user ON daily_horoscopes(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON processed_payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_name_created ON analytics_events(name, created_at);
    CREATE INDEX IF NOT EXISTS idx_readings_user_created ON readings(user_id, created_at);

    CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      last_failed_at TEXT,
      locked_until TEXT
    );
  `);

  db.exec(`
    DELETE FROM daily_horoscopes
    WHERE rowid NOT IN (
      SELECT MIN(rowid) FROM daily_horoscopes GROUP BY date, zodiac_sign
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_unique_date_sign
      ON daily_horoscopes(date, zodiac_sign);
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — expected on subsequent inits
  }
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(email: string): { locked: boolean; lockedUntil: string | null } {
  const db = getDb();
  const row = db.prepare('SELECT locked_until FROM login_attempts WHERE email = ?').get(email.toLowerCase()) as { locked_until: string | null } | undefined;
  if (!row || !row.locked_until) return { locked: false, lockedUntil: null };
  const lockedUntil = new Date(row.locked_until);
  if (lockedUntil > new Date()) {
    return { locked: true, lockedUntil: row.locked_until };
  }
  return { locked: false, lockedUntil: null };
}

export function recordFailedLogin(email: string): { locked: boolean; lockedUntil: string | null } {
  const db = getDb();
  const normalizedEmail = email.toLowerCase();
  const now = new Date().toISOString();
  const row = db.prepare('SELECT failed_count FROM login_attempts WHERE email = ?').get(normalizedEmail) as { failed_count: number } | undefined;
  const newCount = (row?.failed_count ?? 0) + 1;

  if (newCount >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    db.prepare(
      'INSERT INTO login_attempts (email, failed_count, last_failed_at, locked_until) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(email) DO UPDATE SET failed_count = excluded.failed_count, last_failed_at = excluded.last_failed_at, locked_until = excluded.locked_until'
    ).run(normalizedEmail, newCount, now, lockedUntil);
    return { locked: true, lockedUntil };
  }

  db.prepare(
    'INSERT INTO login_attempts (email, failed_count, last_failed_at, locked_until) VALUES (?, ?, ?, NULL) ' +
    'ON CONFLICT(email) DO UPDATE SET failed_count = excluded.failed_count, last_failed_at = excluded.last_failed_at'
  ).run(normalizedEmail, newCount, now);
  return { locked: false, lockedUntil: null };
}

export function clearLoginAttempts(email: string): void {
  const db = getDb();
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email.toLowerCase());
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
  token_version: number;
}

/** 이메일 사용자 생성 */
export function createUser(email: string, password: string, nickname?: string): User | null {
  const db = getDb();
  const userId = randomUUID();
  const hashed = bcrypt.hashSync(password, 12);
  const normalizedEmail = email.trim().toLowerCase();
  const nick = nickname || normalizedEmail.split('@')[0];
  const isAdmin = isAdminEmail(normalizedEmail) ? 1 : 0;

  try {
    db.prepare(
      'INSERT INTO users (id, provider, email, password_hash, nickname, is_admin) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'email', normalizedEmail, hashed, nick, isAdmin);
    return getUserById(userId);
  } catch (err) {
    logger.error('사용자 생성 실패', { error: String(err) });
    return null;
  }
}

/** 이메일/비밀번호 확인 (timing-safe) */
export function verifyUser(email: string, password: string): User | null {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND provider = ?').get(normalizedEmail, 'email') as User | undefined;

  if (!row || !row.password_hash) {
    bcrypt.compareSync(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
    return null;
  }
  if (bcrypt.compareSync(password, row.password_hash)) return row;
  return null;
}

/** ID로 사용자 조회 */
export function getUserById(id: string): User | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User) || null;
}

/** ID로 사용자 조회 (password_hash 제외 — 미들웨어/응답용) */
export function getUserByIdSafe(id: string): Omit<User, 'password_hash'> | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, provider, provider_id, email, nickname, birth_date, zodiac_sign, ' +
    'created_at, free_count_today, free_reset_date, subscription_status, ' +
    'subscription_expires_at, settings, is_admin FROM users WHERE id = ?'
  ).get(id) as Omit<User, 'password_hash'> | undefined;
  return row || null;
}

/** 이메일로 사용자 조회 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  return (db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User) || null;
}

/** 소셜 계정으로 찾기 또는 생성 */
export function findOrCreateOAuthUser(info: { provider: string; provider_id: string; email?: string; nickname?: string }): User {
  const db = getDb();

  // provider + provider_id로 찾기
  const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(info.provider, info.provider_id) as User | undefined;
  if (existing) return existing;

  // 이메일로 기존 계정 찾기 (병합) — 보안: password_hash가 있는 계정은 병합하지 않음
  // 사전 계정 탈취 공격 방지: 공격자가 피해자 이메일로 가입 후 OAuth 병합 시 비밀번호 접근 유지
  let emailConflict = false;
  if (info.email) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(info.email) as User | undefined;
    if (byEmail && !byEmail.password_hash) {
      db.prepare('UPDATE users SET provider = ?, provider_id = ? WHERE id = ?').run(info.provider, info.provider_id, byEmail.id);
      return getUserById(byEmail.id)!;
    }
    if (byEmail) {
      emailConflict = true;
    }
  }

  // 새 사용자 생성 — 이메일 충돌 시 null 처리
  const userId = randomUUID();
  const nickname = info.nickname || info.email?.split('@')[0] || '사용자';
  const email = emailConflict ? null : (info.email || null);
  const isAdmin = info.email ? (isAdminEmail(info.email) ? 1 : 0) : 0;
  db.prepare('INSERT INTO users (id, provider, provider_id, email, nickname, is_admin) VALUES (?, ?, ?, ?, ?, ?)').run(userId, info.provider, info.provider_id, email, nickname, isAdmin);
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

/** Check if user has active premium (status + not expired). Lazily downgrades expired. */
export function isPremiumUser(user: User): boolean {
  if (user.subscription_status !== 'premium' && user.subscription_status !== 'cancelling') return false;
  if (!user.subscription_expires_at) return true;
  if (new Date(user.subscription_expires_at) > new Date()) return true;
  const db = getDb();
  db.prepare("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?").run(user.id);
  user.subscription_status = 'free';
  user.subscription_expires_at = null;
  return false;
}

/** 무료 월터 사용량 확인 및 증가 — true면 허용, false면 초과 */
export function checkAndIncrementFreeQuota(user: User): boolean {
  const db = getDb();
  const today = todayString();

  if (isPremiumUser(user)) return true;

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
  if (isPremiumUser(user)) return -1;
  const today = todayString();
  if (user.free_reset_date !== today) return config.freeDailyLimit;
  return Math.max(0, config.freeDailyLimit - user.free_count_today);
}

/** LLM 호출 실패 시 무료 할당량 롤백 (사용자가 서버 오류로 인해 할당량을 잃지 않도록) */
export function rollbackFreeQuota(user: User): void {
  if (user.subscription_status === 'premium') return;
  const db = getDb();
  db.prepare(
    'UPDATE users SET free_count_today = MAX(0, free_count_today - 1) WHERE id = ? AND free_count_today > 0'
  ).run(user.id);
  const updated = getUserById(user.id);
  if (updated) {
    user.free_count_today = updated.free_count_today;
  }
}

export function invalidateUserTokens(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
}
