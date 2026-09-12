from typing import Awaitable, Callable, TypeVar

from .llm.base import LLMOutputError

T = TypeVar("T")


async def with_one_retry(call: Callable[[], Awaitable[T]], fallback: T) -> T:
    """Runs `call`, retries once on LLMOutputError, then returns `fallback`.

    Keeps malformed LLM output from ever propagating as an unhandled
    exception to backend/ — callers get either valid data or a safe default.
    """
    for _ in range(2):
        try:
            return await call()
        except LLMOutputError:
            continue
    return fallback
