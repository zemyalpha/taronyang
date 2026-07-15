import { initDb, getDb } from '../database';
import { generateDailyHoroscope, generateAllHoroscopes } from '../dailyNotify';

jest.mock('../llm', () => ({
  callLlm: jest.fn(),
  RateLimitError: class RateLimitError extends Error {
    constructor(msg: string) { super(msg); this.name = 'RateLimitError'; }
  },
}));

const { callLlm } = require('../llm');

describe('generateDailyHoroscope', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM daily_horoscopes').run();
    callLlm.mockReset();
  });

  it('should call LLM and cache result when no cache exists', async () => {
    callLlm.mockResolvedValue('오늘은 좋은 날입니다.');

    const result = await generateDailyHoroscope('양자리', '2026-07-15');

    expect(result).toBe('오늘은 좋은 날입니다.');
    expect(callLlm).toHaveBeenCalledTimes(1);

    const db = getDb();
    const cached = db.prepare('SELECT full_reading FROM daily_horoscopes WHERE zodiac_sign = ? AND date = ?').get('양자리', '2026-07-15') as { full_reading?: string };
    expect(cached.full_reading).toBe('오늘은 좋은 날입니다.');
  });

  it('should return cached result without calling LLM', async () => {
    const db = getDb();
    db.prepare(
      'INSERT INTO daily_horoscopes (id, zodiac_sign, date, full_reading, summary, scores) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('test-id-1', '황소자리', '2026-07-15', '캐시된 운세', '캐시', '{}');

    const result = await generateDailyHoroscope('황소자리', '2026-07-15');

    expect(result).toBe('캐시된 운세');
    expect(callLlm).not.toHaveBeenCalled();
  });

  it('should return fallback message when LLM fails', async () => {
    callLlm.mockRejectedValue(new Error('API unavailable'));

    const result = await generateDailyHoroscope('쌍둥이자리', '2026-07-15');

    expect(result).toContain('가져오지 못했어요');
    expect(result).toContain('쌍둥이자리');
    expect(callLlm).toHaveBeenCalledTimes(1);
  });

  it('should cache fallback message on LLM failure', async () => {
    callLlm.mockRejectedValue(new Error('API unavailable'));

    await generateDailyHoroscope('게자리', '2026-07-15');

    const db = getDb();
    const cached = db.prepare('SELECT full_reading FROM daily_horoscopes WHERE zodiac_sign = ? AND date = ?').get('게자리', '2026-07-15') as { full_reading?: string };
    expect(cached.full_reading).toContain('가져오지 못했어요');
  });
});

describe('generateAllHoroscopes', () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM daily_horoscopes').run();
    callLlm.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate horoscopes for all 12 zodiac signs', async () => {
    callLlm.mockImplementation(() => Promise.resolve('운세 내용'));

    const promise = generateAllHoroscopes();
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    const result = await promise;

    const zodiacSigns = [
      '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
      '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
    ];

    expect(Object.keys(result)).toHaveLength(12);
    for (const sign of zodiacSigns) {
      expect(result[sign]).toBeDefined();
      expect(result[sign]).toBe('운세 내용');
    }
  });

  it('should use cache for signs that already have horoscopes', async () => {
    const db = getDb();
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.prepare(
      'INSERT INTO daily_horoscopes (id, zodiac_sign, date, full_reading, summary, scores) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('cached-1', '양자리', today, '캐시됨', '요약', '{}');

    callLlm.mockImplementation(() => Promise.resolve('새로 생성'));

    const promise = generateAllHoroscopes();
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result['양자리']).toBe('캐시됨');
    expect(callLlm).toHaveBeenCalledTimes(11);
  });
});
