/** Zod 입력 검증 스키마 — 모든 API 라우트에서 공용 사용 */
import { z } from 'zod';

/** 회원가입 */
export const signupSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다').max(254),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').max(128),
  nickname: z.string().max(30).optional(),
});

/** 로그인 */
export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다').max(254),
  password: z.string().min(1).max(128),
});

/** 내 정보 수정 */
export const updateMeSchema = z.object({
  nickname: z.string().max(30).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생일은 YYYY-MM-DD 형식이어야 합니다').nullable().optional(),
});

/** 타로 해석 */
export const tarotReadSchema = z.object({
  category: z.string().min(1).max(50),
  question: z.string().max(500).optional().default(''),
  cards: z.array(z.object({
    id: z.number().int().min(0),
    is_upright: z.boolean(),
  })).length(3, '카드를 3장 선택해주세요'),
});

/** 추가 대화 */
export const tarotChatSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요').max(500, '질문은 500자 이내로 입력해주세요'),
  chat_history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(9).optional(),
  category: z.string().max(50).optional(),
  cards_summary: z.string().max(500).optional(),
  previous_reading: z.string().max(5000).optional(),
});

/** 결제 검증 */
export const paymentVerifySchema = z.object({
  imp_uid: z.string().min(1, 'imp_uid가 필요합니다').max(100),
});

/** 알림 설정 변경 */
export const notifySettingsSchema = z.object({
  daily_email: z.boolean().optional(),
  notify_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '시간은 HH:MM 형식이어야 합니다').optional(),
  notify_channel: z.enum(['email', 'push', 'none']).optional(),
});

/** 별자리 변경 */
export const zodiacSchema = z.object({
  zodiac_sign: z.enum([
    '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
    '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
  ]),
});
