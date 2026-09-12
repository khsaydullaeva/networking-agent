from ._openai_compatible import OpenAICompatibleProvider


class K2Provider(OpenAICompatibleProvider):
    base_url = "https://api.ifm.ai/v1"
    model = "IFM/K2-Horizon-375B-A23B"
