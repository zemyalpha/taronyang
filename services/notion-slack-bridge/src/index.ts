/**
 * 엔트리포인트.
 * 기본: POLL_INTERVAL_MS 간격 데몬. `--once`면 1회 실행 후 종료(cron용).
 * SIGINT/SIGTERM에서 안전하게 종료한다.
 */
import { loadConfig } from './config';
import { Poller, sleep } from './poller';
import { NotionClient } from './notion';
import { SlackClient } from './slack';
import { StateStore } from './state';

function log(message: string): void {
  // 프로덕션 로그 수집 용이성을 위해 단일 라인 JSON으로 출력
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: message }));
}

function logError(message: string, err: Error): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      msg: message,
      error: err.message,
    })
  );
}

async function main(): Promise<void> {
  const config = loadConfig();
  const poller = new Poller({
    notion: new NotionClient({
      token: config.notionToken,
      databaseId: config.notionDatabaseId,
      apiBase: config.notionApiBase,
      notionVersion: config.notionVersion,
    }),
    slack: new SlackClient({
      webhookUrl: config.slackWebhookUrl || undefined,
      botToken: config.slackBotToken || undefined,
      channel: config.slackChannel || undefined,
    }),
    stateStore: new StateStore({
      statePath: config.statePath,
      processedIdLimit: config.processedIdLimit,
    }),
    config,
    log,
    onError: (err) => logError('slack post error', err),
  });

  let running = true;
  const shutdown = (signal: string): void => {
    log(`received ${signal}, shutting down`);
    running = false;
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log(
    `notion-slack-bridge started (interval=${config.pollIntervalMs}ms, once=${config.once}, dryRun=${config.dryRun})`
  );

  while (running) {
    try {
      const count = await poller.pollOnce();
      if (count > 0) log(`cycle complete: ${count} new client(s) notified`);
    } catch (err) {
      logError('poll cycle failed', err as Error);
    }

    if (config.once) break;
    const deadline = Date.now() + config.pollIntervalMs;
    while (running && Date.now() < deadline) {
      await sleep(Math.min(1000, deadline - Date.now()));
    }
  }

  log('notion-slack-bridge stopped');
}

if (require.main === module) {
  main().catch((err) => {
    logError('fatal', err as Error);
    process.exitCode = 1;
  });
}
