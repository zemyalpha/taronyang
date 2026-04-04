"""
Z.ai GLM API 클라이언트
"""
import httpx
import sys
import os

# shared 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))

import config


async def call_llm(messages: list, max_tokens: int = 2000, temperature: float = 0.8) -> str:
    """Z.ai GLM API 호출"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.ZAI_API_KEY}",
    }

    payload = {
        "model": config.ZAI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            config.ZAI_API_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def tarot_reading(system_prompt: str, user_prompt: str) -> str:
    """타로 해석"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return await call_llm(messages, max_tokens=2000, temperature=0.85)


async def tarot_chat(system_prompt: str, user_prompt: str) -> str:
    """추가 대화"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return await call_llm(messages, max_tokens=1000, temperature=0.8)
