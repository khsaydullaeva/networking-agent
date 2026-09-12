import os
from typing import Any
from uuid import uuid4


class InMemoryCollection:
    """Mimics the subset of motor's AsyncIOMotorCollection API this app
    uses. Used when MONGODB_URI isn't set, so the API runs and is testable
    on a laptop with zero Atlas setup — swap in real Atlas any time by
    setting MONGODB_URI, no application code changes needed.
    """

    def __init__(self):
        self._docs: dict[str, dict] = {}

    async def insert_one(self, doc: dict) -> dict:
        doc = dict(doc)
        doc.setdefault("_id", str(uuid4()))
        self._docs[doc["_id"]] = doc
        return doc

    async def find_one(self, query: dict) -> dict | None:
        for doc in self._docs.values():
            if self._matches(doc, query):
                return dict(doc)
        return None

    async def find(self, query: dict) -> list[dict]:
        return [dict(doc) for doc in self._docs.values() if self._matches(doc, query)]

    async def update_one(self, query: dict, update: dict) -> None:
        doc = await self.find_one(query)
        if doc is None:
            return
        doc.update(update.get("$set", {}))
        self._docs[doc["_id"]] = doc

    @staticmethod
    def _matches(doc: dict, query: dict) -> bool:
        return all(doc.get(k) == v for k, v in query.items())


class Database:
    def __init__(self):
        uri = os.environ.get("MONGODB_URI")
        if uri:
            from motor.motor_asyncio import AsyncIOMotorClient

            client = AsyncIOMotorClient(uri)
            db = client.get_default_database("networking_agent")
            self.users = db["users"]
            self.connections = db["connections"]
            self.quests = db["quests"]
        else:
            self.users = InMemoryCollection()
            self.connections = InMemoryCollection()
            self.quests = InMemoryCollection()


_db: Database | None = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database()
    return _db


def serialize(doc: dict) -> dict:
    """Converts a raw Mongo-shaped document (using `_id`) to the API shape
    (using `id`)."""
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    return out
