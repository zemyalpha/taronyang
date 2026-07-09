/** 타로 API 라우터 */
import { Router, Request, Response } from 'express';
import { ALL_CARDS, getCard, CATEGORY_NAMES } from '../tarotData';
import { SYSTEM_PROMPT, buildReadingPrompt } from '../tarotPrompt';
import { tarotReading, callLlm } from '../llm';
import { saveReading } from './readings';
import { tarotReadSchema, tarotChatSchema } from '../validation';
import { logger } from '../logger';
import { config } from '../config';
import { checkAndIncrementFreeQuota, getRemainingFreeCount, User } from '../database';
import { authMiddleware } from './auth';

export const tarotRouter = Router();

/** 카테고리 목록 */
tarotRouter.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: CATEGORY_NAMES });
});

/** 카드 셔플 */
tarotRouter.get('/shuffle', (req: Request, res: Response) => {
  const count = Math.min(Math.max(parseInt(req.query.count as string) || 10, 3), 20);
  // Fisher-Yates 셔플 (편향 없는 무작위)
  const deck = [...ALL_CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const shuffled = deck.slice(0, count);
  const cards = shuffled.map((c) => {
    const is_upright = Math.random() > 0.5;
    return {
      id: c.id,
      name: c.name,
      name_en: c.name_en,
      symbol: c.symbol,
      is_upright,
      position: is_upright ? '정위치' : '역위치',
    };
  });
  res.json({ cards });
});

/** 타로 해석 — 로그인 필수 (무료 할당량 적용) */
tarotRouter.post('/read', authMiddleware, async (req: Request, res: Response) => {
  const parsed = tarotReadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { category, question, cards: selectedCards } = parsed.data;

  if (!CATEGORY_NAMES[category]) {
    res.status(400).json({ detail: `잘못된 카테고리: ${category}` });
    return;
  }

  // 무료 할당량 검사 (프리미엄 제외)
  const user = (req as any).user as User;
  if (!checkAndIncrementFreeQuota(user)) {
    res.status(429).json({
      detail: '오늘의 무료 타로 횟수를 모두 사용했어요. 내일 다시 이용하거나 프리미엄으로 업그레이드해주세요.',
      remaining: 0,
    });
    return;
  }

  // 카드 데이터 조회
  let cards: any[];
  try {
    cards = selectedCards.map((s) => {
      const card = getCard(s.id);
      if (!card) throw new Error(`카드 없음: ${s.id}`);
      return { ...card, is_upright: s.is_upright };
    });
  } catch (err) {
    res.status(400).json({ detail: String(err) });
    return;
  }

  // 프롬프트 생성
  const prompt = buildReadingPrompt(CATEGORY_NAMES[category], question, cards);

  try {
    const interpretation = await tarotReading(SYSTEM_PROMPT, prompt);

    // 기록 저장
    try {
      saveReading(user.id, category, question, cards, interpretation);
    } catch {
      /* 기록 저장 실패는 무시 */
    }

    res.json({
      cards: cards.map((c: any) => ({
        id: c.id,
        name: c.name,
        name_en: c.name_en,
        symbol: c.symbol,
        is_upright: c.is_upright,
        position: c.is_upright ? '정위치' : '역위치',
      })),
      interpretation,
      remaining_free: getRemainingFreeCount(user),
    });
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes('429')) {
      logger.warn('AI 해석 429', { error: errMsg });
      res.status(429).json({ detail: 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' });
    } else {
      logger.error('AI 해석 실패', { error: errMsg });
      res.status(500).json({ detail: 'AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }
  }
});

/** 추가 대화 — 로그인 필수 */
tarotRouter.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  const parsed = tarotChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { question, chat_history, category, cards_summary, previous_reading } = parsed.data;

  const user = (req as any).user as User;

  // 추가 질문 수 제한 (프리미엄 제외)
  if (user.subscription_status !== 'premium') {
    const chatCount = chat_history ? Math.ceil(chat_history.length / 2) : 0;
    if (chatCount >= config.maxChatPerReading) {
      res.status(429).json({
        detail: `추가 질문은 최대 ${config.maxChatPerReading}회까지 가능해요. 프리미엄으로 업그레이드하면 무제한입니다.`,
      });
      return;
    }
  }

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `이전 상담: 카테고리=${category || ''}, 카드=${cards_summary || ''}, 해석=${previous_reading || ''}`,
    },
  ];

  if (chat_history) {
    for (const m of chat_history) {
      messages.push(m);
    }
  }
  messages.push({ role: 'user', content: question });

  try {
    const reply = await callLlm(messages, 1000, 0.8);
    res.json({ reply });
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes('429')) {
      logger.warn('AI 응답 429', { error: errMsg });
      res.status(429).json({ detail: 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' });
    } else {
      logger.error('AI 응답 실패', { error: errMsg });
      res.status(500).json({ detail: 'AI 응답에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }
  }
});
