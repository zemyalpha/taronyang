describe('config', () => {
  let config: (typeof import('../config'))['config'];

  const testEnv: Record<string, string> = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key',
    ADMIN_EMAILS: 'admin-test@taronyang.com,root@taronyang.com',
    FREE_DAILY_LIMIT: '1',
    DATABASE_PATH: ':memory:',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
  };

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    Object.keys(testEnv).forEach((key) => {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    });
    jest.isolateModules(() => {
      ({ config } = require('../config'));
    });
  });

  afterEach(() => {
    Object.keys(testEnv).forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key] as string;
      }
    });
  });

  it('should have port as number', () => {
    expect(typeof config.port).toBe('number');
  });

  it('should have host as string', () => {
    expect(typeof config.host).toBe('string');
  });

  it('should have nodeEnv from NODE_ENV', () => {
    expect(config.nodeEnv).toBe('test');
  });

  it('should have jwtSecret from JWT_SECRET', () => {
    expect(config.jwtSecret).toBe('test-secret-key');
  });

  it('should have adminEmails as array from ADMIN_EMAILS', () => {
    expect(Array.isArray(config.adminEmails)).toBe(true);
    expect(config.adminEmails).toContain('admin-test@taronyang.com');
    expect(config.adminEmails).toContain('root@taronyang.com');
  });

  it('should have freeDailyLimit from FREE_DAILY_LIMIT', () => {
    expect(config.freeDailyLimit).toBe(1);
  });

  it('should have databasePath from DATABASE_PATH', () => {
    expect(config.databasePath).toBe(':memory:');
  });

  it('should have default smtpHost', () => {
    expect(config.smtpHost).toBe('smtp.gmail.com');
  });

  it('should have default smtpPort', () => {
    expect(config.smtpPort).toBe(587);
  });

  it('should have default premiumPrice', () => {
    expect(config.premiumPrice).toBe(9900);
  });

  it('should have empty smtp credentials when not set', () => {
    expect(config.smtpUser).toBe('');
    expect(config.smtpPassword).toBe('');
  });

  it('should have extraCorsOrigins as array', () => {
    expect(Array.isArray(config.extraCorsOrigins)).toBe(true);
  });

  it('frontendUrl should not have trailing slash', () => {
    expect(config.frontendUrl).not.toMatch(/\/$/);
  });
});
