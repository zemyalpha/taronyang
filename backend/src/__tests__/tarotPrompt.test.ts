import { buildReadingPrompt, SYSTEM_PROMPT, READING_PROMPT, DAILY_PROMPT } from '../tarotPrompt';

describe('buildReadingPrompt', () => {
  const validCards = [
    { name: 'The Fool', is_upright: true, keywords_up: ['new beginnings', 'adventure'], keywords_down: ['reckless', 'risk'] },
    { name: 'The Magician', is_upright: false, keywords_up: ['power', 'skill'], keywords_down: ['manipulation', 'untapped'] },
    { name: 'The Star', is_upright: true, keywords_up: ['hope', 'renewal'], keywords_down: ['despair', 'discouragement'] },
  ];

  it('should fill in all placeholders with card data', () => {
    const result = buildReadingPrompt('love', 'Will I find love?', validCards);

    expect(result).toContain('love');
    expect(result).toContain('Will I find love?');
    expect(result).toContain('The Fool');
    expect(result).toContain('정위치');
    expect(result).toContain('new beginnings, adventure');
    expect(result).toContain('The Magician');
    expect(result).toContain('역위치');
    expect(result).toContain('manipulation, untapped');
    expect(result).toContain('The Star');
    expect(result).toContain('hope, renewal');
  });

  it('should use keywords_down for reversed cards', () => {
    const result = buildReadingPrompt('career', 'test', [
      { name: 'The Sun', is_upright: false, keywords_up: ['joy'], keywords_down: ['pessimism'] },
      { name: 'The Moon', is_upright: true, keywords_up: ['intuition'], keywords_down: ['confusion'] },
      { name: 'The World', is_upright: true, keywords_up: ['completion'], keywords_down: ['incomplete'] },
    ]);

    expect(result).toContain('pessimism');
    expect(result).not.toContain('joy, ');
    expect(result).toContain('intuition');
    expect(result).toContain('completion');
  });

  it('should default question to 종합적인 운세 when empty', () => {
    const result = buildReadingPrompt('general', '', validCards);
    expect(result).toContain('종합적인 운세');
  });

  it('should handle fewer than 3 cards without crashing', () => {
    const result = buildReadingPrompt('love', 'test', [validCards[0]]);

    expect(result).toContain('The Fool');
    expect(result).toContain('정위치');
    expect(result).toContain('new beginnings, adventure');
  });

  it('should handle empty cards array', () => {
    const result = buildReadingPrompt('love', 'test', []);

    expect(result).toContain('love');
    expect(result).toContain('test');
  });

  it('should produce output containing the category', () => {
    const result = buildReadingPrompt('재물운', 'question', validCards);
    expect(result).toContain('재물운');
  });

  it('should not contain unresolved placeholders', () => {
    const result = buildReadingPrompt('love', 'test', validCards);
    expect(result).not.toMatch(/\{card[123]_/);
    expect(result).not.toMatch(/\{category\}/);
    expect(result).not.toMatch(/\{question\}/);
  });
});

describe('exported prompt constants', () => {
  it('SYSTEM_PROMPT should be a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(SYSTEM_PROMPT).toContain('타로냥');
  });

  it('READING_PROMPT should contain placeholders', () => {
    expect(READING_PROMPT).toContain('{category}');
    expect(READING_PROMPT).toContain('{question}');
    expect(READING_PROMPT).toContain('{card1_name}');
    expect(READING_PROMPT).toContain('{card2_name}');
    expect(READING_PROMPT).toContain('{card3_name}');
  });

  it('DAILY_PROMPT should contain zodiac and date placeholders', () => {
    expect(DAILY_PROMPT).toContain('{zodiac}');
    expect(DAILY_PROMPT).toContain('{date}');
  });
});
