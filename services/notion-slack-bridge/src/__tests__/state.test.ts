import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StateStore } from '../state';

function tmpStatePath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-state-')), 'state.json');
}

describe('StateStore', () => {
  it('returns now-cursor state when file missing (skips backlog)', () => {
    const fixed = new Date('2026-11-24T12:00:00.000Z');
    const store = new StateStore({
      statePath: tmpStatePath(),
      nowProvider: () => fixed,
    });
    const state = store.load(false);
    expect(state.cursor).toBe(fixed.toISOString());
    expect(state.processedIds).toEqual([]);
  });

  it('returns epoch cursor with backfill flag', () => {
    const store = new StateStore({ statePath: tmpStatePath() });
    expect(store.load(true).cursor).toBe(new Date(0).toISOString());
  });

  it('round-trips save and load', () => {
    const p = tmpStatePath();
    const store = new StateStore({ statePath: p });
    store.save({ cursor: '2026-11-24T10:00:00.000Z', processedIds: ['a', 'b'] });

    const loaded = store.load(false);
    expect(loaded.cursor).toBe('2026-11-24T10:00:00.000Z');
    expect(loaded.processedIds).toEqual(['a', 'b']);
  });

  it('trims processedIds to limit, keeping most recent', () => {
    const p = tmpStatePath();
    const store = new StateStore({ statePath: p, processedIdLimit: 3 });
    store.save({ cursor: 'c', processedIds: ['1', '2', '3', '4', '5'] });
    expect(store.load(false).processedIds).toEqual(['3', '4', '5']);
  });

  it('falls back to fresh state on corrupted file', () => {
    const p = tmpStatePath();
    fs.writeFileSync(p, '{not json', 'utf-8');
    const store = new StateStore({ statePath: p });
    const state = store.load(false);
    expect(Array.isArray(state.processedIds)).toBe(true);
    expect(state.processedIds).toEqual([]);
  });
});
