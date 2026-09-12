EXTRACT_FACTS_PROMPT = """You extract concrete, sourceable facts about a \
person from the public preview content of a profile link they shared \
(LinkedIn, Instagram, Facebook, ...) — a title/headline and a short \
description, the same kind of text that platform serves to link-preview \
cards and search engines. It is often thin: a name, a role, a one-line bio.

Rules:
- Every fact MUST be attributable to the provided result's URL — that URL \
is the profile link itself, since this is that link's own content.
- Set "source_url" to that exact URL, copied verbatim from the result.
- Do not invent a source_url. Do not paraphrase a URL.
- Prefer specific facts (a role, org, project, or headline detail) over \
generic filler.
- If the content has nothing concrete to extract, return no facts rather \
than inventing one.
- "date" is the date associated with the fact if known (rare for a profile \
preview), else null.

Respond with strict JSON matching this shape:
{"facts": [{"fact": "string", "source_url": "string", "date": "string|null"}]}
"""

QUEST_GEN_PROMPT = """You generate 2-3 concrete, real-world follow-up quests \
for someone who just met a new contact, based on verified facts about that \
contact and the notes the user wrote (or spoke) about meeting them.

HARD RULE: every "why_now" MUST reference something specific — either an \
item from the provided facts, or a specific detail from the notes (a plan \
made, a topic discussed, a commitment like "meet 2pm Monday"). Never write \
a generic reason untethered from either.

- Rejected (too generic): "Ask her about her research."
- Accepted, from facts: "Her paper on sparse routing (posted 3 weeks ago) \
relates directly to the inference problem you discussed at the career fair — \
ask how her approach compares."
- Accepted, from notes: the note says "do robotics project together, meet \
2pm Monday" — a "meet" quest whose why_now is "You already agreed to meet \
Monday at 2pm to start the robotics project — this is that commitment."

If notes mention a concrete plan or commitment (a meeting time, a project, \
a thing to send), prefer building a quest around that over a weaker fact — \
it's more specific and it's literally what the user said they'd do.

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
