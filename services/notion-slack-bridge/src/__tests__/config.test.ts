import { loadConfig, ConfigError } from '../config';

const BASE_ENV = {
  NOTION_TOKEN: 'secret_x',
  NOTION_CLIENTS_DATABASE_ID: 'db123',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x',
};

describe('loadConfig', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...BASE_ENV } as NodeJS.ProcessEnv;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('loads config with defaults', () => {
    const config = loadConfig([]);
    expect(config.notionToken).toBe('secret_x');
    expect(config.notionDatabaseId).toBe('db123');
    expect(config.pollIntervalMs).toBe(60_000);
    expect(config.once).toBe(false);
    expect(config.dryRun).toBe(false);
    expect(config.backfill).toBe(false);
  });

  it('parses CLI flags', () => {
    const config = loadConfig(['--once', '--dry-run']);
    expect(config.once).toBe(true);
    expect(config.dryRun).toBe(true);
  });

  it('throws ConfigError when Notion credentials are missing', () => {
    delete process.env.NOTION_TOKEN;
    expect(() => loadConfig([])).toThrow(ConfigError);
    expect(() => loadConfig([])).toThrow(/NOTION_TOKEN/);
  });

  it('throws when no Slack target is configured', () => {
    delete process.env.SLACK_WEBHOOK_URL;
    expect(() => loadConfig([])).toThrow(/SLACK_WEBHOOK_URL/);
  });

  it('accepts bot token + channel instead of webhook', () => {
    delete process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-1';
    process.env.SLACK_CHANNEL = '#clients';
    expect(() => loadConfig([])).not.toThrow();
  });

  it('throws when bot token given without channel', () => {
    delete process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-1';
    expect(() => loadConfig([])).toThrow(/SLACK_CHANNEL/);
  });

  it('rejects invalid poll interval', () => {
    process.env.POLL_INTERVAL_MS = 'abc';
    expect(() => loadConfig([])).toThrow(/POLL_INTERVAL_MS/);
  });
});
