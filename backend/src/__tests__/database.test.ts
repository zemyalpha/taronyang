import { initDb, getDb, createUser, verifyUser, getUserById, getUserByEmail, findOrCreateOAuthUser, checkAndIncrementFreeQuota, getRemainingFreeCount, User } from '../database';
import { getKstDateString } from '../datetime';

function makeFreeUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    provider: 'email',
    provider_id: null,
    email: `user-${Date.now()}-${Math.random()}@test.com`,
    password_hash: null,
    nickname: 'tester',
    birth_date: null,
    zodiac_sign: null,
    created_at: new Date().toISOString(),
    free_count_today: 0,
    free_reset_date: null,
    subscription_status: 'free',
    subscription_expires_at: null,
    settings: '{}',
    is_admin: 0,
    ...overrides,
  };
}

function insertUser(user: User): User {
  const db = getDb();
  db.prepare(
    'INSERT INTO users (id, provider, email, password_hash, nickname, birth_date, zodiac_sign, created_at, free_count_today, free_reset_date, subscription_status, subscription_expires_at, settings, is_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    user.id, user.provider, user.email, user.password_hash, user.nickname,
    user.birth_date, user.zodiac_sign, user.created_at,
    user.free_count_today, user.free_reset_date, user.subscription_status,
    user.subscription_expires_at, user.settings, user.is_admin
  );
  return getUserById(user.id)!;
}

describe('checkAndIncrementFreeQuota', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('free user first read — should allow (returns true) and increment count', () => {
    const user = insertUser(makeFreeUser({ free_count_today: 0 }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(true);
    expect(user.free_count_today).toBe(1);

    const dbUser = getUserById(user.id);
    expect(dbUser!.free_count_today).toBe(1);
  });

  it('free user second read after exhausting limit — should deny (returns false)', () => {
    const todayStr = getKstDateString();

    const user = insertUser(makeFreeUser({ free_count_today: 1, free_reset_date: todayStr }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(false);
    expect(user.free_count_today).toBe(1);
  });

  it('premium user — should always allow regardless of count', () => {
    const todayStr = getKstDateString();

    const user = insertUser(makeFreeUser({
      subscription_status: 'premium',
      free_count_today: 99,
      free_reset_date: todayStr,
    }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(true);
    expect(user.free_count_today).toBe(99);
  });

  it('free user with stale reset_date — should reset counter then allow', () => {
    const user = insertUser(makeFreeUser({
      free_count_today: 5,
      free_reset_date: '2020-01-01',
    }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(true);
    expect(user.free_count_today).toBe(1);

    const dbUser = getUserById(user.id);
    const todayStr = getKstDateString();
    expect(dbUser!.free_reset_date).toBe(todayStr);
    expect(dbUser!.free_count_today).toBe(1);
  });

  it('free user at limit with stale date — should reset and allow one more', () => {
    const user = insertUser(makeFreeUser({
      free_count_today: 10,
      free_reset_date: '2020-01-01',
    }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(true);
    expect(user.free_count_today).toBe(1);
  });

  it('free user at limit with today date — should deny and not increment', () => {
    const todayStr = getKstDateString();

    const user = insertUser(makeFreeUser({
      free_count_today: 1,
      free_reset_date: todayStr,
    }));
    const result = checkAndIncrementFreeQuota(user);
    expect(result).toBe(false);

    const dbUser = getUserById(user.id);
    expect(dbUser!.free_count_today).toBe(1);
  });
});

describe('FIX (ZEMA-3023): free_reset_date updated in user object after reset', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('user.free_reset_date is set to today after quota check', () => {
    const user = insertUser(makeFreeUser({ free_count_today: 0, free_reset_date: null }));

    checkAndIncrementFreeQuota(user);

    const dbUser = getUserById(user.id);
    const todayStr = getKstDateString();

    expect(dbUser!.free_reset_date).toBe(todayStr);
    expect(user.free_count_today).toBe(1);
    expect(user.free_reset_date).toBe(todayStr);
  });

  it('getRemainingFreeCount returns 0 after first read (not full limit)', () => {
    const user = insertUser(makeFreeUser({ free_count_today: 0, free_reset_date: null }));

    checkAndIncrementFreeQuota(user);

    const remaining = getRemainingFreeCount(user);

    expect(remaining).toBe(0);
  });
});

describe('getRemainingFreeCount', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('premium user — should return -1 (unlimited)', () => {
    const user = insertUser(makeFreeUser({ subscription_status: 'premium' }));
    expect(getRemainingFreeCount(user)).toBe(-1);
  });

  it('free user fresh (no reset_date) — should return freeDailyLimit', () => {
    const user = insertUser(makeFreeUser({ free_count_today: 0, free_reset_date: null }));
    expect(getRemainingFreeCount(user)).toBe(1);
  });

  it('free user used all today — should return 0', () => {
    const todayStr = getKstDateString();

    const user = insertUser(makeFreeUser({ free_count_today: 1, free_reset_date: todayStr }));
    expect(getRemainingFreeCount(user)).toBe(0);
  });

  it('free user with stale date — should return full limit (counter resets)', () => {
    const user = insertUser(makeFreeUser({ free_count_today: 5, free_reset_date: '2020-01-01' }));
    expect(getRemainingFreeCount(user)).toBe(1);
  });

  it('free user with negative-ish overflow — should not go below 0', () => {
    const todayStr = getKstDateString();

    const user = insertUser(makeFreeUser({ free_count_today: 99, free_reset_date: todayStr }));
    expect(getRemainingFreeCount(user)).toBe(0);
  });
});

describe('createUser — admin bootstrap', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('regular email — should create user with is_admin=0', () => {
    const user = createUser('normal@test.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.is_admin).toBe(0);
  });

  it('configured admin email — should create user with is_admin=1', () => {
    const user = createUser('admin-test@taronyang.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.is_admin).toBe(1);
  });

  it('second configured admin email — should also get is_admin=1', () => {
    const user = createUser('root@taronyang.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.is_admin).toBe(1);
  });

  it('email with different case — should still match (case-insensitive check)', () => {
    const user = createUser('Admin-Test@taronyang.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.is_admin).toBe(1);
  });

  it('email that partially matches admin — should NOT get admin', () => {
    const user = createUser('notadmin-test@taronyang.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.is_admin).toBe(0);
  });
});

describe('findOrCreateOAuthUser — admin bootstrap', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('OAuth with admin email — should create user with is_admin=1', () => {
    const user = findOrCreateOAuthUser({
      provider: 'kakao',
      provider_id: 'kakao-123',
      email: 'admin-test@taronyang.com',
      nickname: 'AdminUser',
    });
    expect(user.is_admin).toBe(1);
  });

  it('OAuth with regular email — should create user with is_admin=0', () => {
    const user = findOrCreateOAuthUser({
      provider: 'google',
      provider_id: 'google-456',
      email: 'regular@test.com',
      nickname: 'RegularUser',
    });
    expect(user.is_admin).toBe(0);
  });

  it('OAuth without email — should create user with is_admin=0', () => {
    const user = findOrCreateOAuthUser({
      provider: 'naver',
      provider_id: 'naver-789',
      email: undefined,
      nickname: 'NoEmailUser',
    });
    expect(user.is_admin).toBe(0);
  });

  it('OAuth with admin email (second admin) — should get is_admin=1', () => {
    const user = findOrCreateOAuthUser({
      provider: 'kakao',
      provider_id: 'kakao-admin2',
      email: 'root@taronyang.com',
      nickname: 'RootUser',
    });
    expect(user.is_admin).toBe(1);
  });
});

describe('createUser — error and edge cases', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('duplicate email — should return null', () => {
    createUser('dup@test.com', 'password123');
    const second = createUser('dup@test.com', 'different456');
    expect(second).toBeNull();
  });

  it('with nickname — should use provided nickname', () => {
    const user = createUser('nick@test.com', 'password123', 'MyNick');
    expect(user).not.toBeNull();
    expect(user!.nickname).toBe('MyNick');
  });

  it('without nickname — should use email prefix as nickname', () => {
    const user = createUser('alice@example.com', 'password123');
    expect(user).not.toBeNull();
    expect(user!.nickname).toBe('alice');
  });
});

describe('verifyUser', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('correct email and password — should return user', () => {
    createUser('verify@test.com', 'mypassword');
    const user = verifyUser('verify@test.com', 'mypassword');
    expect(user).not.toBeNull();
    expect(user!.email).toBe('verify@test.com');
  });

  it('correct email but wrong password — should return null', () => {
    createUser('verify2@test.com', 'mypassword');
    const user = verifyUser('verify2@test.com', 'wrongpassword');
    expect(user).toBeNull();
  });

  it('non-existent email — should return null', () => {
    const user = verifyUser('nobody@test.com', 'password123');
    expect(user).toBeNull();
  });

  it('OAuth-only user — should not be found by verifyUser (queries email provider only)', () => {
    findOrCreateOAuthUser({
      provider: 'kakao',
      provider_id: 'kakao-nopass',
      email: 'oauth-only@test.com',
      nickname: 'OAuthUser',
    });
    const user = verifyUser('oauth-only@test.com', 'anything');
    expect(user).toBeNull();
  });
});

describe('getUserById', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('existing user — should return user', () => {
    const created = createUser('byid@test.com', 'password123');
    const found = getUserById(created!.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe('byid@test.com');
  });

  it('non-existent ID — should return null', () => {
    const found = getUserById('non-existent-uuid');
    expect(found).toBeNull();
  });
});

describe('getUserByEmail', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('existing email — should return user', () => {
    createUser('byemail@test.com', 'password123');
    const found = getUserByEmail('byemail@test.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('byemail@test.com');
  });

  it('non-existent email — should return null', () => {
    const found = getUserByEmail('notfound@test.com');
    expect(found).toBeNull();
  });
});

describe('findOrCreateOAuthUser — merge and existing-match paths', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('existing provider+provider_id — should return existing user without duplicate', () => {
    const first = findOrCreateOAuthUser({
      provider: 'google',
      provider_id: 'google-merge-1',
      email: 'merge1@test.com',
      nickname: 'FirstUser',
    });
    const second = findOrCreateOAuthUser({
      provider: 'google',
      provider_id: 'google-merge-1',
      email: 'different@test.com',
      nickname: 'SecondUser',
    });
    expect(second.id).toBe(first.id);
    expect(second.email).toBe('merge1@test.com');
  });

  it('existing email with different provider — should merge (update provider + provider_id)', () => {
    createUser('merge2@test.com', 'password123');
    const oauthUser = findOrCreateOAuthUser({
      provider: 'kakao',
      provider_id: 'kakao-merge-2',
      email: 'merge2@test.com',
      nickname: 'OAuthMerged',
    });
    const byEmail = getUserByEmail('merge2@test.com');
    expect(byEmail!.id).toBe(oauthUser.id);
    expect(byEmail!.provider).toBe('kakao');
    expect(byEmail!.provider_id).toBe('kakao-merge-2');
  });

  it('no nickname, no email — should default nickname to "사용자"', () => {
    const user = findOrCreateOAuthUser({
      provider: 'naver',
      provider_id: 'naver-noname',
    });
    expect(user.nickname).toBe('사용자');
  });

  it('no nickname but has email — should use email prefix as nickname', () => {
    const user = findOrCreateOAuthUser({
      provider: 'kakao',
      provider_id: 'kakao-nickless',
      email: 'bob@domain.com',
    });
    expect(user.nickname).toBe('bob');
  });

  it('new OAuth user — should be persisted and retrievable by ID', () => {
    const user = findOrCreateOAuthUser({
      provider: 'google',
      provider_id: 'google-new-1',
      email: 'newoauth@test.com',
      nickname: 'NewOAuth',
    });
    const found = getUserById(user.id);
    expect(found).not.toBeNull();
    expect(found!.provider).toBe('google');
  });
});
