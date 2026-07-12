import {
  signupSchema,
  loginSchema,
  updateMeSchema,
  tarotReadSchema,
  tarotChatSchema,
  paymentVerifySchema,
  notifySettingsSchema,
  zodiacSchema,
} from '../src/validation';

describe('validation schemas', () => {
  describe('signupSchema', () => {
    it('accepts valid input with nickname', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        nickname: '타로냥',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid input without nickname (optional)', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      expect(result.success && result.data.nickname).toBeUndefined();
    });

    it('rejects invalid email', () => {
      const result = signupSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 6 characters', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password longer than 128 characters', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'a'.repeat(129),
      });
      expect(result.success).toBe(false);
    });

    it('rejects email longer than 254 characters', () => {
      const result = signupSchema.safeParse({
        email: 'a'.repeat(250) + '@b.co',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'no-at-sign',
        password: 'password',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateMeSchema', () => {
    it('accepts valid nickname', () => {
      const result = updateMeSchema.safeParse({ nickname: '새닉네임' });
      expect(result.success).toBe(true);
    });

    it('accepts valid birth_date', () => {
      const result = updateMeSchema.safeParse({ birth_date: '1995-06-15' });
      expect(result.success).toBe(true);
    });

    it('accepts null birth_date', () => {
      const result = updateMeSchema.safeParse({ birth_date: null });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (all fields optional)', () => {
      const result = updateMeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid birth_date format', () => {
      const result = updateMeSchema.safeParse({ birth_date: '1995/06/15' });
      expect(result.success).toBe(false);
    });

    it('rejects impossible date', () => {
      const result = updateMeSchema.safeParse({ birth_date: '1995-13-40' });
      expect(result.success).toBe(false);
    });
  });

  describe('tarotReadSchema', () => {
    const validCards = [
      { id: 0, is_upright: true },
      { id: 1, is_upright: false },
      { id: 2, is_upright: true },
    ];

    it('accepts valid reading request', () => {
      const result = tarotReadSchema.safeParse({
        category: 'love',
        question: '새 연애가 있을까요?',
        cards: validCards,
      });
      expect(result.success).toBe(true);
    });

    it('accepts request without question (defaults to empty string)', () => {
      const result = tarotReadSchema.safeParse({
        category: 'general',
        cards: validCards,
      });
      expect(result.success).toBe(true);
    });

    it('rejects fewer than 3 cards', () => {
      const result = tarotReadSchema.safeParse({
        category: 'love',
        cards: [validCards[0], validCards[1]],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 3 cards', () => {
      const result = tarotReadSchema.safeParse({
        category: 'love',
        cards: [...validCards, { id: 3, is_upright: true }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects duplicate card ids', () => {
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

    it('rejects empty category', () => {
      const result = tarotReadSchema.safeParse({
        category: '',
        cards: validCards,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tarotChatSchema', () => {
    it('accepts valid chat request', () => {
      const result = tarotChatSchema.safeParse({
        question: '더 자세히 알려줘',
      });
      expect(result.success).toBe(true);
    });

    it('accepts chat request with history', () => {
      const result = tarotChatSchema.safeParse({
        question: '추가 질문',
        chat_history: [
          { role: 'user', content: '이전 질문' },
          { role: 'assistant', content: '이전 답변' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty question', () => {
      const result = tarotChatSchema.safeParse({ question: '' });
      expect(result.success).toBe(false);
    });

    it('rejects question longer than 500 characters', () => {
      const result = tarotChatSchema.safeParse({ question: 'a'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role in chat_history', () => {
      const result = tarotChatSchema.safeParse({
        question: '질문',
        chat_history: [{ role: 'invalid' as any, content: '내용' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 9 chat history items', () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: '내용',
      }));
      const result = tarotChatSchema.safeParse({
        question: '질문',
        chat_history: history,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paymentVerifySchema', () => {
    it('accepts valid imp_uid', () => {
      const result = paymentVerifySchema.safeParse({ imp_uid: 'imp_12345' });
      expect(result.success).toBe(true);
    });

    it('rejects empty imp_uid', () => {
      const result = paymentVerifySchema.safeParse({ imp_uid: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing imp_uid', () => {
      const result = paymentVerifySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('notifySettingsSchema', () => {
    it('accepts valid notification settings', () => {
      const result = notifySettingsSchema.safeParse({
        daily_email: true,
        notify_time: '09:30',
        notify_channel: 'email',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (all fields optional)', () => {
      const result = notifySettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid time format', () => {
      const result = notifySettingsSchema.safeParse({ notify_time: '9:30' });
      expect(result.success).toBe(false);
    });

    it('rejects hour > 23', () => {
      const result = notifySettingsSchema.safeParse({ notify_time: '24:00' });
      expect(result.success).toBe(false);
    });

    it('rejects minute > 59', () => {
      const result = notifySettingsSchema.safeParse({ notify_time: '12:60' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid channel', () => {
      const result = notifySettingsSchema.safeParse({ notify_channel: 'sms' });
      expect(result.success).toBe(false);
    });
  });

  describe('zodiacSchema', () => {
    it('accepts a valid zodiac sign', () => {
      const result = zodiacSchema.safeParse({ zodiac_sign: '양자리' });
      expect(result.success).toBe(true);
    });

    it('accepts all 12 zodiac signs', () => {
      const signs = [
        '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
        '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
      ];
      for (const sign of signs) {
        const result = zodiacSchema.safeParse({ zodiac_sign: sign });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid zodiac sign', () => {
      const result = zodiacSchema.safeParse({ zodiac_sign: '뱀자리' });
      expect(result.success).toBe(false);
    });

    it('rejects missing zodiac_sign', () => {
      const result = zodiacSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
