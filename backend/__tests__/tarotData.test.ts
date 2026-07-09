import { getCard, ALL_CARDS, MAJOR_ARCANA, CATEGORY_NAMES } from '../src/tarotData';

describe('tarotData', () => {
  describe('getCard', () => {
    it('returns the correct card for a valid id', () => {
      const card = getCard(0);
      expect(card).toBeDefined();
      expect(card?.name).toBe('바보');
      expect(card?.name_en).toBe('The Fool');
    });

    it('returns the correct card for a high id', () => {
      const card = getCard(21);
      expect(card).toBeDefined();
      expect(card?.name).toBe('세계');
      expect(card?.name_en).toBe('The World');
    });

    it('returns undefined for an out-of-range id', () => {
      expect(getCard(-1)).toBeUndefined();
      expect(getCard(999)).toBeUndefined();
    });
  });

  describe('ALL_CARDS', () => {
    it('contains all 78 tarot cards', () => {
      expect(ALL_CARDS).toHaveLength(78);
    });

    it('has unique ids for every card', () => {
      const ids = ALL_CARDS.map((c) => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(78);
    });

    it('has sequential ids 0-77', () => {
      const ids = ALL_CARDS.map((c) => c.id).sort((a, b) => a - b);
      expect(ids[0]).toBe(0);
      expect(ids[77]).toBe(77);
    });

    it('every card has required fields', () => {
      for (const card of ALL_CARDS) {
        expect(card.name).toBeTruthy();
        expect(card.name_en).toBeTruthy();
        expect(card.symbol).toBeTruthy();
        expect(card.keywords_up).toBeInstanceOf(Array);
        expect(card.keywords_up.length).toBeGreaterThan(0);
        expect(card.keywords_down).toBeInstanceOf(Array);
        expect(card.keywords_down.length).toBeGreaterThan(0);
        expect(card.meaning_up).toBeTruthy();
        expect(card.meaning_down).toBeTruthy();
      }
    });
  });

  describe('MAJOR_ARCANA', () => {
    it('contains 22 major arcana cards (0-21)', () => {
      expect(MAJOR_ARCANA).toHaveLength(22);
    });
  });

  describe('CATEGORY_NAMES', () => {
    it('contains expected categories', () => {
      expect(CATEGORY_NAMES['love']).toBeDefined();
      expect(CATEGORY_NAMES['money']).toBeDefined();
      expect(CATEGORY_NAMES['career']).toBeDefined();
      expect(CATEGORY_NAMES['general']).toBeDefined();
    });
  });
});
