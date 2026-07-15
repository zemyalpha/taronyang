import { config } from '../config';

describe('config', () => {
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
    expect(typeof config.smtpUser).toBe('string');
  });

  it('should have extraCorsOrigins as array', () => {
    expect(Array.isArray(config.extraCorsOrigins)).toBe(true);
  });

  it('frontendUrl should not have trailing slash', () => {
    expect(config.frontendUrl).not.toMatch(/\/$/);
  });
});
