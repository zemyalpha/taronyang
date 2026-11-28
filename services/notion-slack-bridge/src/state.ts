/**
 * 중복 알림 방지 상태 저장소.
 * cursor(마지막 처리 created_time) + 처리 완료 페이지 ID 버퍼를 JSON 파일로 유지.
 * 저장은 tmp 파일 작성 후 rename으로 원자적 수행한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { BridgeState } from './types';

export interface StateStoreOptions {
  statePath: string;
  processedIdLimit?: number;
  nowProvider?: () => Date;
}

export class StateStore {
  private readonly statePath: string;
  private readonly processedIdLimit: number;
  private readonly nowProvider: () => Date;

  constructor(options: StateStoreOptions) {
    this.statePath = options.statePath;
    this.processedIdLimit = options.processedIdLimit ?? 500;
    this.nowProvider = options.nowProvider || (() => new Date());
  }

  /**
   * 상태 파일을 읽어온다. 파일이 없으면 초기 상태를 반환한다:
   * 기본적으로 현재 시각이 커서(기존 항목 스킵), backfill이면 epoch.
   */
  load(backfill: boolean): BridgeState {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<BridgeState>;
      if (typeof parsed.cursor !== 'string') {
        throw new Error('state file missing cursor');
      }
      return {
        cursor: parsed.cursor,
        processedIds: Array.isArray(parsed.processedIds)
          ? parsed.processedIds.filter((id) => typeof id === 'string')
          : [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.initialState(backfill);
      }
      // 손상된 상태 파일: 안전하게 초기화하되 기존 항목을 다시 알리지 않도록 now부터 시작
      return this.initialState(false);
    }
  }

  private initialState(backfill: boolean): BridgeState {
    return {
      cursor: backfill
        ? new Date(0).toISOString()
        : this.nowProvider().toISOString(),
      processedIds: [],
    };
  }

  save(state: BridgeState): void {
    const trimmed: BridgeState = {
      cursor: state.cursor,
      processedIds: state.processedIds.slice(-this.processedIdLimit),
    };
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    const tmpPath = `${this.statePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(trimmed, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.statePath);
  }
}
