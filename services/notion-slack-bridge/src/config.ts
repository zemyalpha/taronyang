/**
 * 환경 변수 설정 및 검증.
 * 필수 값이 누락되면 시작 시 즉시 실패한다(침묵하는 미작동 방지).
 */

export interface BridgeConfig {
  notionToken: string;
  notionDatabaseId: string;
  notionApiBase: string;
  notionVersion: string;
  slackWebhookUrl: string;
  slackBotToken: string;
  slackChannel: string;
  pollIntervalMs: number;
  statePath: string;
  processedIdLimit: number;
  once: boolean;
  dryRun: boolean;
  backfill: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DEFAULT_STATE_PATH =
  process.env.BRIDGE_STATE_PATH || './data/bridge-state.json';

function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): BridgeConfig {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const config: BridgeConfig = {
    notionToken: process.env.NOTION_TOKEN || '',
    notionDatabaseId: process.env.NOTION_CLIENTS_DATABASE_ID || '',
    notionApiBase:
      process.env.NOTION_API_BASE || 'https://api.notion.com/v1',
    notionVersion: process.env.NOTION_VERSION || '2022-06-28',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackChannel: process.env.SLACK_CHANNEL || '',
    pollIntervalMs: parseIntEnv('POLL_INTERVAL_MS', 60_000),
    statePath: DEFAULT_STATE_PATH,
    processedIdLimit: parseIntEnv('PROCESSED_ID_LIMIT', 500),
    once: flags.has('--once'),
    dryRun: flags.has('--dry-run'),
    backfill: flags.has('--backfill'),
  };

  const missing: string[] = [];
  if (!config.notionToken) missing.push('NOTION_TOKEN');
  if (!config.notionDatabaseId) missing.push('NOTION_CLIENTS_DATABASE_ID');

  const hasWebhook = Boolean(config.slackWebhookUrl);
  const hasBotToken = Boolean(config.slackBotToken);
  const hasChannel = Boolean(config.slackChannel);
  const hasTokenPost = hasBotToken && hasChannel;

  if (!hasWebhook && !hasTokenPost) {
    missing.push(
      'SLACK_WEBHOOK_URL (또는 SLACK_BOT_TOKEN + SLACK_CHANNEL 조합)'
    );
  }
  if (hasBotToken && !hasChannel) {
    missing.push('SLACK_CHANNEL (SLACK_BOT_TOKEN 사용 시 필수)');
  }

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return config;
}
