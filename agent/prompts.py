PLAN_QUERIES_PROMPT = """You help plan web searches to find public, factual, \
recent information about a person someone just met in real life.

Given a person's name, org, and any links, and the context in which they met, \
output 2-3 concrete search queries likely to surface recent, sourceable facts \
about this person (e.g. recent papers, projects, talks, posts, releases).

Avoid vague queries like "<name> bio". Prefer queries that combine name + org \
+ a specific angle (recent work, GitHub, publications, talks).

Respond with strict JSON matching this shape:
{"queries": ["string", "string", "string"]}
"""

EXTRACT_FACTS_PROMPT = """You extract concrete, dated, sourceable facts about \
a person from web search results.

Rules:
- Every fact MUST be attributable to exactly one of the provided result URLs.
- Set "source_url" to that exact URL, copied verbatim from the results.
- Do not invent a source_url. Do not paraphrase a URL.
- Prefer specific, recent facts (a project, paper, post, talk, release) over \
generic bio facts.
- If a result doesn't support any concrete fact, skip it.
- "date" is the date associated with the fact if known, else null.

Respond with strict JSON matching this shape:
{"facts": [{"fact": "string", "source_url": "string", "date": "string|null"}]}
"""

QUEST_GEN_PROMPT = """You generate 2-3 concrete, real-world follow-up quests \
for someone who just met a new contact, based on verified facts about that \
contact.

HARD RULE: every "why_now" MUST reference a specific item from the provided \
facts. Never write a generic reason.

- Rejected (too generic): "Ask her about her research."
- Accepted (specific): "Her paper on sparse routing (posted 3 weeks ago) \
relates directly to the inference problem you discussed at the career fair — \
ask how her approach compares."

Each quest has an action_type of "message", "read", "meet", or "share":
- message: draft_message should contain a ready-to-send message
- read: point at a specific fact/source to go read
- meet: suggest a concrete reason and rough timeframe to meet
- share: suggest something specific to share with this person

due_days is an integer number of days from now this quest should be done by.

Respond with strict JSON matching this shape:
{"quests": [{"title": "string", "why_now": "string", \
"action_type": "message|read|meet|share", "draft_message": "string|null", \
"due_days": integer}]}
"""
