import { buildReadingPrompt, READING_PROMPT } from '../src/tarotPrompt';

describe('tarotPrompt', () => {
  const mockCards = [
    { name: '바보', is_upright: true, keywords_up: ['새시작', '자유'], keywords_down: ['무모함'] },
    { name: '마법사', is_upright: false, keywords_up: ['창조'], keywords_down: ['조작', '기만'] },
    { name: '여사제', is_upright: true, keywords_up: ['직관', '지혜'], keywords_down: ['비밀'] },
  ];

  describe('buildReadingPrompt', () => {
    it('fills in all template placeholders', () => {
      const result = buildReadingPrompt('연애운', '새 연애가 있을까요?', mockCards);

      expect(result).toContain('연애운');
      expect(result).toContain('새 연애가 있을까요?');
      expect(result).toContain('바보');
      expect(result).toContain('마법사');
      expect(result).toContain('여사제');
    });

    it('uses upright keywords when is_upright is true', () => {
      const cards = [
        { name: '바보', is_upright: true, keywords_up: ['새시작'], keywords_down: ['무모함'] },
        { name: '마법사', is_upright: true, keywords_up: ['창조'], keywords_down: ['조작'] },
        { name: '여사제', is_upright: true, keywords_up: ['직관'], keywords_down: ['비밀'] },
      ];
      const result = buildReadingPrompt('종합운', '', cards);
      expect(result).toContain('새시작');
      expect(result).toContain('창조');
      expect(result).toContain('직관');
      expect(result).not.toContain('무모함');
    });

    it('uses reversed keywords when is_upright is false', () => {
      const cards = [
        { name: '바보', is_upright: false, keywords_up: ['새시작'], keywords_down: ['무모함'] },
        { name: '마법사', is_upright: false, keywords_up: ['창조'], keywords_down: ['조작'] },
        { name: '여사제', is_upright: false, keywords_up: ['직관'], keywords_down: ['비밀'] },
      ];
      const result = buildReadingPrompt('종합운', '', cards);
      expect(result).toContain('무모함');
      expect(result).toContain('조작');
      expect(result).toContain('비밀');
      expect(result).not.toContain('새시작');
    });

    it('uses 정위치/역위치 labels', () => {
      const result = buildReadingPrompt('종합운', '질문', mockCards);
      expect(result).toContain('정위치');
      expect(result).toContain('역위치');
    });

    it('substitutes empty question with default text', () => {
      const result = buildReadingPrompt('종합운', '', mockCards);
      expect(result).toContain('종합적인 운세');
    });

    it('does not leave any unfilled placeholders', () => {
      const result = buildReadingPrompt('연애운', '질문', mockCards);
      expect(result).not.toMatch(/\{card\d|category|question\}/);
    });
  });

  describe('READING_PROMPT template', () => {
    it('contains all required sections', () => {
      expect(READING_PROMPT).toContain('과거');
      expect(READING_PROMPT).toContain('현재');
      expect(READING_PROMPT).toContain('미래');
      expect(READING_PROMPT).toContain('타로냥의 조언');
    });
  });
});
