from abc import ABC, abstractmethod


class LLMOutputError(Exception):
    """Raised when a provider returns output that isn't valid/parseable JSON."""


class LLMProvider(ABC):
    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict:
        """
        Returns parsed JSON matching `schema`. Must raise LLMOutputError
        (not a generic Exception) on invalid/unparseable output so callers
        can apply a uniform retry policy.
        """
        ...
