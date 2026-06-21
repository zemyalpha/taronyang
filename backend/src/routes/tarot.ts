/** 타로 API 라우터 */
import { Router, Request, Response } from 'express';
import { ALL_CARDS, getCard, CATEGORY_NAMES } from '../tarotData';
import { SYSTEM_PROMPT, buildReadingPrompt } from '../tarotPrompt';
import { tarotReading, callLlm } from '../llm';
import { saveReading } from './readings';
import { tarotReadSchema, tarotChatSchema } from '../validation';
import { logger } from '../logger';

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

/** 타로 해석 */
tarotRouter.post('/read', async (req: Request, res: Response) => {
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

    // 기록 저장 (비회원도)
    try {
      saveReading(null, category, question, cards, interpretation);
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
    });
  } catch (err) {
    logger.error('AI 해석 실패', { error: String(err) });
    res.status(500).json({ detail: 'AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
});

/** 추가 대화 */
tarotRouter.post('/chat', async (req: Request, res: Response) => {
  const parsed = tarotChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0]?.message || '잘못된 입력입니다' });
    return;
  }
  const { question, chat_history, category, cards_summary, previous_reading } = parsed.data;

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
    logger.error('AI 응답 실패', { error: String(err) });
    res.status(500).json({ detail: 'AI 응답에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
});
