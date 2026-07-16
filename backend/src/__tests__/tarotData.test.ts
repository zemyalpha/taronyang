import {
  MAJOR_ARCANA,
  MINOR_ARCANA,
  ALL_CARDS,
  getCard,
  CATEGORY_NAMES,
  TarotCard,
} from '../tarotData';

describe('MAJOR_ARCANA', () => {
  it('should contain 22 cards', () => {
    expect(MAJOR_ARCANA).toHaveLength(22);
  });

  it('should have sequential IDs from 0 to 21', () => {
    MAJOR_ARCANA.forEach((card, i) => {
      expect(card.id).toBe(i);
    });
  });

  it('should start with The Fool (id=0)', () => {
    expect(MAJOR_ARCANA[0].name_en).toBe('The Fool');
  });

  it('should end with The World (id=21)', () => {
    expect(MAJOR_ARCANA[21].name_en).toBe('The World');
  });
});

describe('MINOR_ARCANA', () => {
  it('should contain 56 cards', () => {
    expect(MINOR_ARCANA).toHaveLength(56);
  });

  it('should have sequential IDs from 22 to 77', () => {
    MINOR_ARCANA.forEach((card, i) => {
      expect(card.id).toBe(22 + i);
    });
  });

  it('should have 14 cards in each suit (Cups, Pentacles, Swords, Wands)', () => {
    const cups = MINOR_ARCANA.filter((c) => c.name_en.includes('Cups'));
    const pentacles = MINOR_ARCANA.filter((c) => c.name_en.includes('Pentacles'));
    const swords = MINOR_ARCANA.filter((c) => c.name_en.includes('Swords'));
    const wands = MINOR_ARCANA.filter((c) => c.name_en.includes('Wands'));

    expect(cups).toHaveLength(14);
    expect(pentacles).toHaveLength(14);
    expect(swords).toHaveLength(14);
    expect(wands).toHaveLength(14);
  });
});

describe('ALL_CARDS', () => {
  it('should contain 78 cards total', () => {
    expect(ALL_CARDS).toHaveLength(78);
  });

  it('should have unique IDs across all cards', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(78);
  });

  it('should have IDs from 0 to 77 with no gaps', () => {
    const ids = ALL_CARDS.map((c) => c.id).sort((a, b) => a - b);
    ids.forEach((id, i) => {
      expect(id).toBe(i);
    });
  });
});

describe('card structure', () => {
  const requiredFields: (keyof TarotCard)[] = [
    'id',
    'name',
    'name_en',
    'symbol',
    'keywords_up',
    'keywords_down',
    'meaning_up',
    'meaning_down',
  ];

  it.each(ALL_CARDS)('card "$name_en" (id=$id) should have all required fields', (card) => {
    requiredFields.forEach((field) => {
      expect(card[field]).toBeDefined();
      expect(card[field]).not.toBe('');
    });
  });

  it.each(ALL_CARDS)('card "$name_en" should have non-empty keyword arrays', (card) => {
    expect(card.keywords_up.length).toBeGreaterThan(0);
    expect(card.keywords_down.length).toBeGreaterThan(0);
  });

  it.each(ALL_CARDS)('card "$name_en" should have meaningful meanings', (card) => {
    expect(card.meaning_up.length).toBeGreaterThan(10);
    expect(card.meaning_down.length).toBeGreaterThan(10);
  });
});

describe('getCard', () => {
  it('should return the correct card for a valid ID', () => {
    const card = getCard(0);
    expect(card).toBeDefined();
    expect(card!.name_en).toBe('The Fool');
  });

  it('should return The World for id=21', () => {
    const card = getCard(21);
    expect(card).toBeDefined();
    expect(card!.name_en).toBe('The World');
  });

  it('should return the last minor arcana card for id=77', () => {
    const card = getCard(77);
    expect(card).toBeDefined();
    expect(card!.name_en).toBe('King of Wands');
  });

  it('should return undefined for an invalid negative ID', () => {
    expect(getCard(-1)).toBeUndefined();
  });

  it('should return undefined for an out-of-range ID', () => {
    expect(getCard(78)).toBeUndefined();
    expect(getCard(100)).toBeUndefined();
  });
});

describe('CATEGORY_NAMES', () => {
  it('should contain all 6 categories', () => {
    expect(Object.keys(CATEGORY_NAMES).sort()).toEqual(
      ['career', 'compatibility', 'general', 'love', 'money', 'newyear'].sort(),
    );
  });

  it('should have emoji + Korean label for each category', () => {
    Object.values(CATEGORY_NAMES).forEach((label) => {
      expect(label.length).toBeGreaterThan(3);
    });
  });

  it('should map love to the correct label', () => {
    expect(CATEGORY_NAMES.love).toContain('연애운');
  });

  it('should map money to the correct label', () => {
    expect(CATEGORY_NAMES.money).toContain('재물운');
  });
});
