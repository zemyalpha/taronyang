import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Poller } from '../poller';
import { NotionClient } from '../notion';
import { SlackClient, SlackApiError } from '../slack';
import { StateStore } from '../state';
import { NotionPageSummary } from '../types';

function page(id: string, createdTime: string): NotionPageSummary {
  return {
    id,
    url: `https://notion.so/${id}`,
    createdTime,
    title: `Client ${id}`,
    properties: [{ name: 'Email', value: `${id}@x.com` }],
  };
}

function makeFetch(pages: NotionPageSummary[]): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ results: pages.map(serializePage), has_more: false }),
    }) as unknown as Response) as typeof fetch;
}

function serializePage(p: NotionPageSummary): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: { name: 'Name', type: 'title', title: [{ plain_text: p.title }] },
  };
  for (const prop of p.properties) {
    props[prop.name] = { name: prop.name, type: 'email', email: prop.value };
  }
  return {
    id: p.id,
    url: p.url,
    created_time: p.createdTime,
    properties: props,
  };
}

function makeEnv(pages: NotionPageSummary[], slackFail = false) {
  const statePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-poller-')),
    'state.json'
  );
  const posted: string[] = [];
  const slackFetch = (async () => {
    if (slackFail) return {
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: 'internal_error' }),
    } as unknown as Response;
    posted.push('sent');
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => 'ok' } as unknown as Response;
  }) as unknown as typeof fetch;

  const poller = new Poller({
    notion: new NotionClient({
      token: 't',
      databaseId: 'd',
      fetchImpl: makeFetch(pages),
    }),
    slack: new SlackClient({
      webhookUrl: 'https://hooks.slack.test/x',
      maxRetries: 0,
      fetchImpl: slackFetch,
    }),
    stateStore: new StateStore({ statePath }),
    config: { dryRun: false, backfill: true },
    onError: () => {},
  });
  return { poller, statePath, postedCount: () => posted.length };
}

describe('Poller.pollOnce', () => {
  it('posts new pages and advances cursor', async () => {
    const { poller, statePath, postedCount } = makeEnv([
      page('p1', '2026-11-24T10:00:00.000Z'),
      page('p2', '2026-11-24T11:00:00.000Z'),
    ]);

    const count = await poller.pollOnce();

    expect(count).toBe(2);
    expect(postedCount()).toBe(2);
    const saved = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(saved.cursor).toBe('2026-11-24T11:00:00.000Z');
    expect(saved.processedIds).toEqual(['p1', 'p2']);
  });

  it('does not repost already-processed pages', async () => {
    const { poller, postedCount } = makeEnv([page('p1', '2026-11-24T10:00:00.000Z')]);

    await poller.pollOnce();
    await poller.pollOnce();

    expect(postedCount()).toBe(1);
  });

  it('keeps cursor on Slack failure so failed page is retried', async () => {
    const { poller, statePath } = makeEnv(
      [page('p1', '2026-11-24T10:00:00.000Z')],
      true
    );

    const count = await poller.pollOnce();

    expect(count).toBe(0);
    // 전송 실패 시 상태를 저장하지 않는다 → 다음 사이클에 같은 페이지 재시도
    expect(fs.existsSync(statePath)).toBe(false);
  });

  it('dry-run posts nothing and returns count', async () => {
    const statePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-poller-')),
      'state.json'
    );
    const poller = new Poller({
      notion: new NotionClient({
        token: 't',
        databaseId: 'd',
        fetchImpl: makeFetch([page('p1', '2026-11-24T10:00:00.000Z')]),
      }),
      slack: new SlackClient({
        webhookUrl: 'https://hooks.slack.test/x',
        maxRetries: 0,
        fetchImpl: makeFetch([]),
      }),
      stateStore: new StateStore({ statePath }),
      config: { dryRun: true, backfill: true },
    });

    const count = await poller.pollOnce();

    expect(count).toBe(1);
    expect(fs.existsSync(statePath)).toBe(true);
  });

  it('surfaces slack failures as SlackApiError', async () => {
    const { poller } = makeEnv([page('px', '2026-11-24T10:00:00.000Z')], true);
    await poller.pollOnce().catch(() => fail('pollOnce must not throw'));
  });
});

describe('SlackApiError shape', () => {
  it('carries status', () => {
    const err = new SlackApiError('boom', 500);
    expect(err.status).toBe(500);
    expect(err.name).toBe('SlackApiError');
  });
});
