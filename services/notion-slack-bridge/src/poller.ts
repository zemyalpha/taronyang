/**
 * 폴링 오케스트레이션.
 * 1회 사이클: Notion 조회 → 미처리 페이지 필터 → Slack 전송 → 상태 저장.
 * 전송 실패 페이지가 있으면 그 뒤 커서를 진행하지 않아 다음 사이클에 재시도한다.
 */
import { BridgeConfig } from './config';
import { formatNewClientMessage } from './format';
import { NotionClient } from './notion';
import { SlackClient } from './slack';
import { StateStore } from './state';
import { BridgeState, NotionPageSummary } from './types';

export interface PollerDeps {
  notion: NotionClient;
  slack: SlackClient;
  stateStore: StateStore;
  config: Pick<BridgeConfig, 'dryRun' | 'backfill'>;
  log?: (message: string) => void;
  onError?: (err: Error) => void;
}

export class Poller {
  private readonly notion: NotionClient;
  private readonly slack: SlackClient;
  private readonly stateStore: StateStore;
  private readonly config: Pick<BridgeConfig, 'dryRun' | 'backfill'>;
  private readonly log: (message: string) => void;
  private readonly onError: (err: Error) => void;

  constructor(deps: PollerDeps) {
    this.notion = deps.notion;
    this.slack = deps.slack;
    this.stateStore = deps.stateStore;
    this.config = deps.config;
    this.log = deps.log || (() => {});
    this.onError = deps.onError || (() => {});
  }

  /** 1회 폴링 사이클. 신규 처리 건수를 반환한다. */
  async pollOnce(): Promise<number> {
    const state = this.stateStore.load(this.config.backfill);
    const pages = await this.notion.queryPagesCreatedAfter(state.cursor);
    const processed = new Set(state.processedIds);
    const fresh = pages.filter((p) => !processed.has(p.id));

    if (fresh.length === 0) {
      this.log(`no new pages since ${state.cursor}`);
      return 0;
    }

    const nextState: BridgeState = {
      cursor: state.cursor,
      processedIds: [...state.processedIds],
    };

    let succeeded = 0;
    for (const page of fresh) {
      try {
        if (this.config.dryRun) {
          this.log(`[dry-run] would post: ${page.title} (${page.url})`);
        } else {
          await this.slack.postBlocks(formatNewClientMessage(page));
          this.log(`posted: ${page.title} (${page.id})`);
        }
        nextState.processedIds.push(page.id);
        nextState.cursor = maxIso(nextState.cursor, page.createdTime);
        succeeded++;
      } catch (err) {
        // 이 페이지 전송 실패: 커서를 진행하지 않고 중단 → 다음 사이클에 재시도
        this.onError(err as Error);
        this.log(
          `failed to post page ${page.id}, will retry next cycle: ${
            (err as Error).message
          }`
        );
        break;
      }
    }

    if (succeeded > 0) {
      this.stateStore.save(nextState);
    }
    return succeeded;
  }
}

export function maxIso(a: string, b: string): string {
  return b > a ? b : a;
}

/** 사이클 사이 실행 간격만큼 대기 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { NotionPageSummary };
