import {
  signupSchema,
  loginSchema,
  updateMeSchema,
  tarotReadSchema,
  tarotChatSchema,
  paymentVerifySchema,
  notifySettingsSchema,
  zodiacSchema,
} from '../validation';

describe('signupSchema', () => {
  it('valid input — should parse successfully', () => {
    const result = signupSchema.safeParse({
      email: 'user@test.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('valid input with nickname — should parse successfully', () => {
    const result = signupSchema.safeParse({
      email: 'user@test.com',
      password: 'password123',
      nickname: 'MyNick',
    });
    expect(result.success).toBe(true);
  });

  it('invalid email — should fail', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('password too short (< 6 chars) — should fail', () => {
    const result = signupSchema.safeParse({
      email: 'user@test.com',
      password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('password too long (> 128 chars) — should fail', () => {
    const result = signupSchema.safeParse({
      email: 'user@test.com',
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('email too long (> 254 chars) — should fail', () => {
    const result = signupSchema.safeParse({
      email: 'a'.repeat(250) + '@b.co',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('valid input — should parse successfully', () => {
    const result = loginSchema.safeParse({
      email: 'user@test.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('empty password — should fail', () => {
    const result = loginSchema.safeParse({
      email: 'user@test.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('invalid email — should fail', () => {
    const result = loginSchema.safeParse({
      email: 'bad',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMeSchema', () => {
  it('valid birth_date — should parse successfully', () => {
    const result = updateMeSchema.safeParse({ birth_date: '1990-05-15' });
    expect(result.success).toBe(true);
  });

  it('null birth_date — should parse successfully', () => {
    const result = updateMeSchema.safeParse({ birth_date: null });
    expect(result.success).toBe(true);
  });

  it('empty object — should parse successfully (all optional)', () => {
    const result = updateMeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('invalid date format — should fail', () => {
    const result = updateMeSchema.safeParse({ birth_date: '1990/05/15' });
    expect(result.success).toBe(false);
  });

  it('non-existent date that Date.parse rejects — should fail', () => {
    const result = updateMeSchema.safeParse({ birth_date: '2023-13-01' });
    expect(result.success).toBe(false);
  });

  it('nickname too long (> 30 chars) — should fail', () => {
    const result = updateMeSchema.safeParse({ nickname: 'a'.repeat(31) });
    expect(result.success).toBe(false);
  });
});

describe('tarotReadSchema', () => {
  const validCards = [
    { id: 0, is_upright: true },
    { id: 1, is_upright: false },
    { id: 2, is_upright: true },
  ];

  it('valid input — should parse successfully', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: validCards,
    });
    expect(result.success).toBe(true);
  });

  it('with question — should parse successfully', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      question: 'Will I find love?',
      cards: validCards,
    });
    expect(result.success).toBe(true);
  });

  it('question defaults to empty string', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: validCards,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question).toBe('');
    }
  });

  it('only 2 cards — should fail (need exactly 3)', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: validCards.slice(0, 2),
    });
    expect(result.success).toBe(false);
  });

  it('4 cards — should fail (need exactly 3)', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: [...validCards, { id: 3, is_upright: true }],
    });
    expect(result.success).toBe(false);
  });

  it('duplicate card IDs — should fail', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: [
        { id: 0, is_upright: true },
        { id: 0, is_upright: false },
        { id: 1, is_upright: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('negative card ID — should fail', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: [
        { id: -1, is_upright: true },
        { id: 1, is_upright: false },
        { id: 2, is_upright: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('non-integer card ID — should fail', () => {
    const result = tarotReadSchema.safeParse({
      category: 'love',
      cards: [
        { id: 0.5, is_upright: true },
        { id: 1, is_upright: false },
        { id: 2, is_upright: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('empty category — should fail', () => {
    const result = tarotReadSchema.safeParse({
      category: '',
      cards: validCards,
    });
    expect(result.success).toBe(false);
  });
});

describe('tarotChatSchema', () => {
  it('valid input — should parse successfully', () => {
    const result = tarotChatSchema.safeParse({
      question: 'Tell me more about my career',
    });
    expect(result.success).toBe(true);
  });

  it('with chat history — should parse successfully', () => {
    const result = tarotChatSchema.safeParse({
      question: 'Follow-up question',
      chat_history: [
        { role: 'user', content: 'Initial question' },
        { role: 'assistant', content: 'Initial answer' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('empty question — should fail', () => {
    const result = tarotChatSchema.safeParse({ question: '' });
    expect(result.success).toBe(false);
  });

  it('question too long (> 500 chars) — should fail', () => {
    const result = tarotChatSchema.safeParse({ question: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('chat_history exceeds 9 entries — should fail', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    const result = tarotChatSchema.safeParse({
      question: 'test',
      chat_history: history,
    });
    expect(result.success).toBe(false);
  });

  it('invalid role in chat_history — should fail', () => {
    const result = tarotChatSchema.safeParse({
      question: 'test',
      chat_history: [{ role: 'system', content: 'system msg' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentVerifySchema', () => {
  it('valid imp_uid — should parse successfully', () => {
    const result = paymentVerifySchema.safeParse({ imp_uid: 'imp_12345' });
    expect(result.success).toBe(true);
  });

  it('empty imp_uid — should fail', () => {
    const result = paymentVerifySchema.safeParse({ imp_uid: '' });
    expect(result.success).toBe(false);
  });

  it('imp_uid too long (> 100 chars) — should fail', () => {
    const result = paymentVerifySchema.safeParse({ imp_uid: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('notifySettingsSchema', () => {
  it('valid daily_email — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ daily_email: true });
    expect(result.success).toBe(true);
  });

  it('valid notify_time (HH:MM) — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ notify_time: '09:30' });
    expect(result.success).toBe(true);
  });

  it('valid notify_time at boundary (23:59) — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ notify_time: '23:59' });
    expect(result.success).toBe(true);
  });

  it('valid notify_time at boundary (00:00) — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ notify_time: '00:00' });
    expect(result.success).toBe(true);
  });

  it('valid notify_channel email — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ notify_channel: 'email' });
    expect(result.success).toBe(true);
  });

  it('valid notify_channel none — should parse successfully', () => {
    const result = notifySettingsSchema.safeParse({ notify_channel: 'none' });
    expect(result.success).toBe(true);
  });

  it('invalid notify_time (24:00) — should fail', () => {
    const result = notifySettingsSchema.safeParse({ notify_time: '24:00' });
    expect(result.success).toBe(false);
  });

  it('invalid notify_time (12:60) — should fail', () => {
    const result = notifySettingsSchema.safeParse({ notify_time: '12:60' });
    expect(result.success).toBe(false);
  });

  it('invalid notify_channel — should fail', () => {
    const result = notifySettingsSchema.safeParse({ notify_channel: 'sms' });
    expect(result.success).toBe(false);
  });

  it('empty object — should parse successfully (all optional)', () => {
    const result = notifySettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('zodiacSchema', () => {
  it.each([
    '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
    '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
  ])('valid zodiac sign: %s — should parse successfully', (sign) => {
    const result = zodiacSchema.safeParse({ zodiac_sign: sign });
    expect(result.success).toBe(true);
  });

  it('invalid zodiac sign — should fail', () => {
    const result = zodiacSchema.safeParse({ zodiac_sign: '뱀자리' });
    expect(result.success).toBe(false);
  });

  it('empty string — should fail', () => {
    const result = zodiacSchema.safeParse({ zodiac_sign: '' });
    expect(result.success).toBe(false);
  });
});
