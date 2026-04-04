"""
타로 API 라우터
"""
import logging
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from shared.tarot_data import ALL_CARDS, get_card
from services.tarot_prompt import (
    SYSTEM_PROMPT,
    build_reading_prompt,
    build_chat_prompt,
    CATEGORY_NAMES,
)
from services.llm import tarot_reading, call_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tarot", tags=["tarot"])


# --- Pydantic Models ---

class CardSelection(BaseModel):
    """셔플에서 선택한 카드 (id + 방향)"""
    id: int | str
    is_upright: bool = True


class ChatMessage(BaseModel):
    """대화 메시지"""
    role: str
    content: str


class CardInfo(BaseModel):
    """카드 정보"""
    id: int | str
    name: str
    name_en: str
    symbol: str
    is_upright: bool
    position: str


class ShuffleResponse(BaseModel):
    cards: list[CardInfo]


class ReadRequest(BaseModel):
    category: str
    question: Optional[str] = ""
    cards: list[CardSelection]


class ReadResponse(BaseModel):
    cards: list[CardInfo]
    interpretation: str


class ChatRequest(BaseModel):
    category: str
    cards_summary: str
    previous_reading: str
    chat_history: list[ChatMessage]
    question: str


class ChatResponse(BaseModel):
    reply: str


# --- Endpoints ---

@router.get("/categories")
async def get_categories():
    """상담 카테고리 목록"""
    return {"categories": CATEGORY_NAMES}


@router.get("/shuffle", response_model=ShuffleResponse)
async def shuffle_cards(count: int = 10):
    """카드 셔플 — count장 중 3장 선택 가능"""
    if count < 3 or count > 20:
        raise HTTPException(400, "count must be 3~20")

    cards = random.sample(ALL_CARDS, min(count, len(ALL_CARDS)))
    result = []
    for card in cards:
        is_upright = random.choice([True, False])
        result.append(CardInfo(
            id=card["id"],
            name=card["name"],
            name_en=card["name_en"],
            symbol=card["symbol"],
            is_upright=is_upright,
            position="정위치" if is_upright else "역위치",
        ))
    return {"cards": result}


@router.post("/read", response_model=ReadResponse)
async def read_tarot(req: ReadRequest):
    """타로 해석"""
    if req.category not in CATEGORY_NAMES:
        raise HTTPException(400, f"Invalid category. Use: {list(CATEGORY_NAMES.keys())}")
    if len(req.cards) != 3:
        raise HTTPException(400, "Must select exactly 3 cards")

    # 카드 데이터 조회 (셔플에서 받은 방향 사용)
    cards = []
    for selection in req.cards:
        card = get_card(selection.id)
        if not card:
            raise HTTPException(400, f"Card not found: {selection.id}")
        card_copy = dict(card)
        card_copy["is_upright"] = selection.is_upright
        cards.append(card_copy)

    # 프롬프트 생성
    prompt = build_reading_prompt(req.category, req.question, cards)

    # LLM 호출
    try:
        interpretation = await tarot_reading(SYSTEM_PROMPT, prompt)
    except Exception as e:
        logger.error("AI 해석 실패: %s", e, exc_info=True)
        raise HTTPException(500, "AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.")

    return {
        "cards": [
            CardInfo(
                id=c["id"],
                name=c["name"],
                name_en=c["name_en"],
                symbol=c["symbol"],
                is_upright=c["is_upright"],
                position="정위치" if c["is_upright"] else "역위치",
            )
            for c in cards
        ],
        "interpretation": interpretation,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat_tarot(req: ChatRequest):
    """추가 대화"""
    if len(req.question) > 500:
        raise HTTPException(400, "질문은 500자 이내로 입력해주세요")
    if len(req.chat_history) >= 10:
        raise HTTPException(400, "대화 횟수를 초과했어요")

    # 대화 기록을 문자열로 변환 (프롬프트 컨텍스트용)
    chat_history_str = "\n".join(
        f"{'👤' if m.role == 'user' else '🐱'}: {m.content}"
        for m in req.chat_history
    )

    # 컨텍스트 프롬프트 생성 (기존 카드/해석 + 대화기록 포함)
    context_prompt = build_chat_prompt(
        req.category,
        req.cards_summary,
        req.previous_reading,
        chat_history_str,
        req.question,
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": context_prompt},
    ]

    try:
        reply = await call_llm(messages, max_tokens=1000, temperature=0.8)
    except Exception as e:
        logger.error("AI 응답 실패: %s", e, exc_info=True)
        raise HTTPException(500, "AI 응답에 실패했어요. 잠시 후 다시 시도해주세요.")

    return {"reply": reply}
