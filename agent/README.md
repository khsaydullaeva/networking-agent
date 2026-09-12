# agent/ — Enrichment + Quest Generation (Claude Code context for this folder)

You are implementing the AI core: two deterministic pipelines (enrichment,
quest generation), not an open-ended autonomous agent loop. Every LLM call
must request strict JSON output validated against a schema, with one retry
and a template fallback on failure. This is what keeps demo behavior
predictable — never let malformed output reach `backend/` or the UI.

**Critical constraint: the LLM provider must be swappable via one env var
with zero changes to pipeline code.** We have not finalized whether we're
using K2 (IFM), Gemini, or Grok, and the sponsor decision may change
during the hackathon. Build the abstraction in §2 first, before writing
any pipeline logic.

---

## 1. Stack

- Python, plain `httpx` (async) — avoid heavy SDKs where a provider
  exposes an OpenAI-compatible endpoint, since one client can serve
  multiple providers
- `pydantic` v2 for schema validation of LLM outputs
- Querit.ai for search (`https://api.querit.ai/v1/search`)
- No LangChain / agent framework — for a 24h hackathon, hand-rolled
  pipelines are faster to debug at 3am than a framework's abstractions

```bash
pip install httpx pydantic python-dotenv
```

---

## 2. LLM provider abstraction — build this first

### Interface every provider must implement

```python
# agent/llm/base.py
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict:
        """
        Returns parsed JSON matching `schema`. Must raise LLMOutputError
        (not a generic Exception) on invalid/unparseable output so callers
        can apply a uniform retry policy.
        """
        ...
```

### Factory — the only place `LLM_PROVIDER` is read

```python
# agent/llm/factory.py
import os

def get_llm() -> LLMProvider:
    provider = os.environ["LLM_PROVIDER"]  # "k2" | "gemini" | "grok"
    if provider == "k2":
        from .providers.k2 import K2Provider
        return K2Provider(api_key=os.environ["LLM_API_KEY"])
    if provider == "gemini":
        from .providers.gemini import GeminiProvider
        return GeminiProvider(api_key=os.environ["LLM_API_KEY"])
    if provider == "grok":
        from .providers.grok import GrokProvider
        return GrokProvider(api_key=os.environ["LLM_API_KEY"])
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
```

**Every pipeline calls `get_llm()` and nothing else.** No pipeline file
should ever import `k2`, `gemini`, or `grok` directly, and no pipeline
file should contain an `if provider == ...` branch — that logic lives
only in the factory. If you find yourself branching on provider outside
`factory.py`, stop and move it back.

### Provider implementations — all three are OpenAI-compatible chat APIs

This is the useful fact that makes the abstraction cheap: K2 Horizon
(IFM), Gemini, and Grok (xAI) all expose (or can be called via) an
OpenAI-compatible `/chat/completions` shape. One shared HTTP client
function, three thin subclasses that differ only in `base_url` and
`model`.

```python
# agent/llm/providers/_openai_compatible.py
import httpx, json
from ..base import LLMProvider, LLMOutputError

class OpenAICompatibleProvider(LLMProvider):
    base_url: str
    model: str

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate_json(self, system_prompt, user_prompt, schema) -> dict:
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
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                raise LLMOutputError(str(e)) from e
            return data  # caller validates against pydantic schema
```

```python
# agent/llm/providers/k2.py
class K2Provider(OpenAICompatibleProvider):
    base_url = "https://platform.ifm.ai/v1"   # confirm exact path in IFM docs at hackathon time
    model = "k2-horizon-32b"                   # pick size per latency/cost need — see §5

# agent/llm/providers/gemini.py
class GeminiProvider(OpenAICompatibleProvider):
    base_url = "https://generativelanguage.googleapis.com/v1beta/openai"  # confirm current path
    model = "gemini-2.5-flash"

# agent/llm/providers/grok.py
class GrokProvider(OpenAICompatibleProvider):
    base_url = "https://api.x.ai/v1"
    model = "grok-4"
```

**Action item at build time:** verify each provider's exact base URL,
model name, and whether `response_format: json_object` is supported —
these details drift and should be confirmed against current docs, not
assumed from this file. If a provider doesn't support strict JSON mode,
fall back to prompting for JSON and parsing defensively with a retry.

### Switching providers

```bash
# .env
LLM_PROVIDER=k2       # or: gemini | grok
LLM_API_KEY=sk-...
```

No code changes, no redeploy logic changes — just this env var and a
process restart. Confirm this works by actually swapping it once during
development, don't assume it works untested.

---

## 3. Pipeline A — Enrichment

```python
async def enrich(person: dict, met_context: dict) -> dict:
    llm = get_llm()

    # 1. Plan 2-3 search queries
    queries = await llm.generate_json(
        system_prompt=PLAN_QUERIES_PROMPT,
        user_prompt=json.dumps({"person": person, "context": met_context}),
        schema=QUERY_PLAN_SCHEMA,   # {"queries": ["string", "string", "string"]}
    )

    # 2. Querit search, in parallel
    results = await asyncio.gather(*[querit_search(q) for q in queries["queries"]])

    # 3. Extract facts per result, LLM call per result (or batch if provider allows)
    facts = []
    for query, result_set in zip(queries["queries"], results):
        extracted = await llm.generate_json(
            system_prompt=EXTRACT_FACTS_PROMPT,
            user_prompt=json.dumps({"query": query, "results": result_set}),
            schema=FACTS_SCHEMA,   # {"facts": [{"fact": str, "source_url": str, "date": str|null}]}
        )
        facts.extend(extracted["facts"])

    # 4. HARD RULE: drop any fact without a source_url that traces to an actual
    # result URL from step 2. Do not trust the LLM's self-reported source_url —
    # verify it appears in the search results you actually retrieved.
    verified = [f for f in facts if f["source_url"] in {r["url"] for rs in results for r in rs}]

    return {"facts": verified[:6]}  # cap for quest-generation prompt size
```

### `querit_search`

```python
async def querit_search(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.querit.ai/v1/search",
            headers={"Authorization": f"Bearer {os.environ['QUERIT_API_KEY']}"},
            json={"query": query, "count": 5},
        )
        resp.raise_for_status()
        return resp.json()["results"]["result"]
```

---

## 4. Pipeline B — Quest generation

```python
QUEST_SCHEMA = {
    "type": "object",
    "properties": {
        "quests": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "why_now": {"type": "string"},      # MUST reference a specific fact
                    "action_type": {"enum": ["message", "read", "meet", "share"]},
                    "draft_message": {"type": ["string", "null"]},
                    "due_days": {"type": "integer"},
                },
                "required": ["title", "why_now", "action_type", "due_days"],
            },
        }
    },
    "required": ["quests"],
}

async def generate_quests(person, enrichment, met_context, user_goals) -> dict:
    llm = get_llm()
    try:
        return await llm.generate_json(
            system_prompt=QUEST_GEN_PROMPT,  # see prompt requirements below
            user_prompt=json.dumps({
                "person": person, "facts": enrichment["facts"],
                "met_context": met_context, "user_goals": user_goals,
            }),
            schema=QUEST_SCHEMA,
        )
    except LLMOutputError:
        return FALLBACK_QUESTS  # one generic "send a follow-up message" quest, hardcoded
```

**Prompt must enforce this hard rule — it is the entire product
differentiator:** every `why_now` must reference a specific item from
`facts`, not a generic prompt like "reach out and reconnect." Include one
accepted and one rejected example directly in the system prompt:

- ❌ Rejected: "Ask her about her research."
- ✅ Accepted: "Her paper on sparse routing (posted 3 weeks ago) relates
  directly to the inference problem you discussed at the career fair —
  ask how her approach compares."

If the model produces vague quests during testing, tighten this example
set before touching anything else — this is worth more debugging time
than any other part of the pipeline.

---

## 5. Model size selection (K2-specific, skip if using Gemini/Grok)

If `LLM_PROVIDER=k2`, IFM's K2 Horizon fleet has 6 sizes. For this
product:
- Query planning + fact extraction → smaller/faster model (e.g. 7B or
  3.7B) — these are simple, structured tasks
- Quest generation → a mid-size model (e.g. 32B) — this is the task
  where reasoning quality is visible to judges
Confirm exact model identifiers in IFM's docs at hackathon time; names in
§2 are illustrative.

---

## 6. Test fixtures — build against these before touching real APIs

Create `agent/fixtures/fake_people.json` with 5 hand-written profiles
(name, org, a couple of "known facts" you invent) and
`agent/fixtures/fake_search_results.json` with plausible Querit-shaped
responses for them. Build and debug both pipelines end-to-end against
fixtures first; only swap in real Querit + LLM calls once the JSON
contracts are solid. This unblocks `backend/` from ever waiting on your
API keys working.

---

## 7. Acceptance checklist for this layer

- [ ] Swapping `LLM_PROVIDER` between `k2`, `gemini`, `grok` requires no
      code change, only env var + restart — test this at least once
- [ ] No file outside `agent/llm/factory.py` branches on provider name
- [ ] Every fact in enrichment output has a `source_url` that matches a
      real Querit result URL (verified programmatically, not just
      requested in the prompt)
- [ ] Malformed LLM JSON triggers one retry, then a fallback — never an
      unhandled exception surfaced to `backend/`
- [ ] At least 3 of 5 fixture profiles produce quests where `why_now`
      references a specific fact (manually review these — this is the
      core quality bar for the whole product)
- [ ] `enrich_and_generate_quests()` runs end-to-end against fixtures with
      zero network calls, for demo-mode use by `backend/`
