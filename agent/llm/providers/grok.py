from ._openai_compatible import OpenAICompatibleProvider


class GrokProvider(OpenAICompatibleProvider):
    base_url = "https://api.x.ai/v1"
    model = "grok-4"
