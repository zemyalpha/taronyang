"""
타로 API 라우터
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))

from tarot_data import ALL_CARDS, get_card
from services.tarot_prompt import (
    SYSTEM_PROMPT,
    build_reading_prompt,
    build_chat_prompt,
    CATEGORY_NAMES,
)
from services.llm import tarot_reading, tarot_chat

router = APIRouter(prefix="/api/tarot", tags=["tarot"])


class ShuffleResponse(BaseModel):
    cards: list[dict]


class ReadRequest(BaseModel):
    category: str
    question: Optional[str] = ""
    card_ids: list  # 선택한 3장의 카드 id


class ReadResponse(BaseModel):
    cards: list[dict]
    interpretation: str


class ChatRequest(BaseModel):
    category: str
    cards_summary: str
    previous_reading: str
    chat_history: list[dict]
    question: str


class ChatResponse(BaseModel):
    reply: str


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
        result.append({
            "id": card["id"],
            "name": card["name"],
            "name_en": card["name_en"],
            "symbol": card["symbol"],
            "is_upright": is_upright,
        })
    return {"cards": result}


@router.post("/read", response_model=ReadResponse)
async def read_tarot(req: ReadRequest):
    """타로 해석"""
    if req.category not in CATEGORY_NAMES:
        raise HTTPException(400, f"Invalid category. Use: {list(CATEGORY_NAMES.keys())}")
    if len(req.card_ids) != 3:
        raise HTTPException(400, "Must select exactly 3 cards")

    # 카드 데이터 조회
    cards = []
    for card_id in req.card_ids:
        card = get_card(card_id)
        if not card:
            raise HTTPException(400, f"Card not found: {card_id}")
        # 정/역위치 랜덤 (셔플에서 받은 값 사용, 기본 정위치)
        card_copy = dict(card)
        card_copy["is_upright"] = card_copy.get("is_upright", True)
        cards.append(card_copy)

    # 프롬프트 생성
    prompt = build_reading_prompt(req.category, req.question, cards)

    # LLM 호출
    try:
        interpretation = await tarot_reading(SYSTEM_PROMPT, prompt)
    except Exception as e:
        raise HTTPException(500, f"AI 해석 실패: {str(e)}")

    return {
        "cards": [
            {
                "id": c["id"],
                "name": c["name"],
                "name_en": c["name_en"],
                "symbol": c["symbol"],
                "is_upright": c["is_upright"],
                "position": "정위치" if c["is_upright"] else "역위치",
            }
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

    prompt = build_chat_prompt(
        req.category,
        req.cards_summary,
        req.previous_reading,
        "\n".join(
            f"{'👤' if m['role']=='user' else '🐱'}: {m['content']}"
            for m in req.chat_history
        ),
        req.question,
    )

    try:
        reply = await tarot_chat(SYSTEM_PROMPT, req.chat_history, req.question)
    except Exception as e:
        raise HTTPException(500, f"AI 응답 실패: {str(e)}")

    return {"reply": reply}
