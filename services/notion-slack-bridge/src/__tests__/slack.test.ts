import { SlackClient, SlackApiError } from '../slack';
import { SlackBlock } from '../types';

const blocks: SlackBlock[] = [
  { type: 'header', text: { type: 'plain_text', text: 'hi', emoji: true } },
];

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => (status === 429 ? '0' : null) },
    json: async () => body,
  } as unknown as Response;
}

describe('SlackClient.postBlocks', () => {
  it('posts blocks to webhook URL', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new SlackClient({
      webhookUrl: 'https://hooks.slack.com/services/T/B/X',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return makeResponse(200, 'ok');
      }) as unknown as typeof fetch,
    });

    await client.postBlocks(blocks);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hooks.slack.com/services/T/B/X');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ blocks });
  });

  it('posts via chat.postMessage with token and channel', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new SlackClient({
      botToken: 'xoxb-test',
      channel: '#clients',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return makeResponse(200, { ok: true });
      }) as unknown as typeof fetch,
    });

    await client.postBlocks(blocks);

    expect(calls[0].url).toBe('https://slack.com/api/chat.postMessage');
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer xoxb-test');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.channel).toBe('#clients');
    expect(body.blocks).toEqual(blocks);
  });

  it('throws SlackApiError on non-retryable failure', async () => {
    const client = new SlackClient({
      webhookUrl: 'https://hooks.slack.com/services/T/B/X',
      maxRetries: 0,
      fetchImpl: (async () => makeResponse(403, 'forbidden')) as unknown as typeof fetch,
    });

    await expect(client.postBlocks(blocks)).rejects.toThrow(SlackApiError);
    await expect(client.postBlocks(blocks)).rejects.toThrow(/403/);
  });
});
