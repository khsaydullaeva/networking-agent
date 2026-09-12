import os

from .base import LLMProvider

# This is the ONLY place LLM_PROVIDER is read, and the only place that
# branches on provider name. Pipelines must call get_llm() and nothing else.


def get_llm() -> LLMProvider:
    provider = os.environ["LLM_PROVIDER"]  # "k2" | "gemini" | "grok"
    api_key = os.environ["LLM_API_KEY"]
    if provider == "k2":
        from .providers.k2 import K2Provider

        return K2Provider(api_key=api_key)
    if provider == "gemini":
        from .providers.gemini import GeminiProvider

        return GeminiProvider(api_key=api_key)
    if provider == "grok":
        from .providers.grok import GrokProvider

        return GrokProvider(api_key=api_key)
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
