/**
 * Slack 클라이언트. 두 가지 전송 방식 지원:
 *  1) Incoming Webhook (SLACK_WEBHOOK_URL)
 *  2) chat.postMessage (SLACK_BOT_TOKEN + SLACK_CHANNEL)
 * 429 rate limit은 Retry-After를 존중해 재시도한다.
 */
import { SlackBlock } from './types';

export class SlackApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}

export interface SlackClientOptions {
  webhookUrl?: string;
  botToken?: string;
  channel?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class SlackClient {
  private readonly webhookUrl: string;
  private readonly botToken: string;
  private readonly channel: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(options: SlackClientOptions) {
    this.webhookUrl = options.webhookUrl || '';
    this.botToken = options.botToken || '';
    this.channel = options.channel || '';
    this.fetchImpl = options.fetchImpl || fetch;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async postBlocks(blocks: SlackBlock[]): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.send(blocks);
        if (res.ok) return;

        // 429는 Retry-After 후 재시도, 그 외 4xx/5xx는 재시도 불가로 판단해 즉시 실패
        if (res.status === 429) {
          const retryAfter = Number.parseInt(
            res.headers.get('Retry-After') || '1',
            10
          );
          const waitMs = (Number.isFinite(retryAfter) ? retryAfter : 1) * 1000;
          lastError = new SlackApiError(
            `Slack rate limited (429), attempt ${attempt + 1}`,
            429
          );
          await sleep(waitMs);
          continue;
        }

        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new SlackApiError(
          `Slack API error ${res.status}: ${body.error || 'unknown'}`,
          res.status
        );
      } catch (err) {
        if (err instanceof SlackApiError && err.status !== 429) throw err;
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          await sleep(2 ** attempt * 500);
          continue;
        }
      }
    }

    throw lastError || new SlackApiError('Slack post failed', 0);
  }

  private async send(blocks: SlackBlock[]): Promise<FetchResponseLike> {
    if (this.webhookUrl) {
      return this.fetchImpl(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
    }

    return this.fetchImpl('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: this.channel,
        blocks,
      }),
    });
  }
}
