from ._openai_compatible import OpenAICompatibleProvider


class GeminiProvider(OpenAICompatibleProvider):
    # Confirm exact path/model against current Gemini docs at hackathon time.
    base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
    model = "gemini-2.5-flash"
