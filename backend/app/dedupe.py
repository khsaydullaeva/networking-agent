"""Matches a newly-scanned person against a user's existing connections,
so scanning/typing the same person twice merges into one connection card
instead of creating a duplicate. Two people are the same connection if
their name matches (case-insensitive) or they share any link URL."""


def find_existing_connection(existing_docs: list[dict], person: dict) -> dict | None:
    name = person.get("name", "").strip().lower()
    links = {v for v in person.get("links", {}).values() if v}

    for doc in existing_docs:
        existing_person = doc.get("person", {})
        if existing_person.get("name", "").strip().lower() == name and name:
            return doc
        existing_links = {v for v in existing_person.get("links", {}).values() if v}
        if links & existing_links:
            return doc

    return None
