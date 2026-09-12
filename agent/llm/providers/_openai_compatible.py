import json

import httpx

from ..base import LLMOutputError, LLMProvider


class OpenAICompatibleProvider(LLMProvider):
    """Shared HTTP client for any provider exposing an OpenAI-compatible
    /chat/completions endpoint. Subclasses set base_url and model only."""

    base_url: str
    model: str

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise LLMOutputError(str(e)) from e

            try:
                content = resp.json()["choices"][0]["message"]["content"]
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                raise LLMOutputError(f"unexpected response shape: {e}") from e

            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                raise LLMOutputError(str(e)) from e
            return data  # caller validates against pydantic schema
