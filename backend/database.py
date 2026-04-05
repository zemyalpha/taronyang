"""
SQLite 데이터베이스 관리
"""
import aiosqlite
import config
import logging

logger = logging.getLogger(__name__)


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(config.DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """데이터베이스 초기화"""
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                nickname TEXT DEFAULT '',
                password_hash TEXT,
                zodiac_sign TEXT DEFAULT '',
                birth_date TEXT DEFAULT '',
                oauth_provider TEXT DEFAULT '',
                oauth_id TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                plan TEXT DEFAULT 'free',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                imp_uid TEXT,
                active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                category TEXT NOT NULL,
                question TEXT DEFAULT '',
                cards TEXT NOT NULL,
                interpretation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                enabled INTEGER DEFAULT 1,
                notify_time TEXT DEFAULT '07:00',
                channel TEXT DEFAULT 'email',
                last_sent_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_horoscopes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zodiac_sign TEXT NOT NULL,
                date TEXT NOT NULL,
                horoscope TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(zodiac_sign, date)
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id);
            CREATE INDEX IF NOT EXISTS idx_daily_notif_user ON daily_notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_daily_horo_sign_date ON daily_horoscopes(zodiac_sign, date);
        """)
        await db.commit()
        logger.info("데이터베이스 초기화 완료")
    finally:
        await db.close()


async def fetch_one(query: str, params: tuple = ()):
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def fetch_all(query: str, params: tuple = ()):
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def execute(query: str, params: tuple = ()):
    db = await get_db()
    try:
        await db.execute(query, params)
        await db.commit()
    finally:
        await db.close()
