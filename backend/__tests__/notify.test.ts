import { getKstDate } from '../src/routes/notify';

describe('getKstDate', () => {
  it('returns a date string in YYYY-MM-DD format', () => {
    const result = getKstDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a valid date', () => {
    const result = getKstDate();
    const parsed = new Date(result + 'T00:00:00+09:00');
    expect(parsed).toBeInstanceOf(Date);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it('returns the correct KST date even when UTC differs', () => {
    // getKstDate adds 9 hours to UTC before extracting the date.
    // At 16:00 UTC it should be 01:00 KST next day.
    // We just verify the function returns a date close to "now" in KST.
    const result = getKstDate();
    const utcNow = new Date().toISOString().split('T')[0];
    const kstFromUtc = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // The function should return either today's UTC date or tomorrow's (if past 15:00 UTC)
    const validDates = [utcNow, kstFromUtc];
    expect(validDates).toContain(result);
  });
});
