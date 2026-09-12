from ._openai_compatible import OpenAICompatibleProvider


class K2Provider(OpenAICompatibleProvider):
    # Confirm exact path/model against IFM docs at hackathon time.
    base_url = "https://platform.ifm.ai/v1"
    model = "k2-horizon-32b"
