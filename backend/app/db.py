import asyncio
import json
import os
from uuid import uuid4


class InMemoryCollection:
    """Mimics the subset of the Postgres-backed collection API this app
    uses. Used when DATABASE_URL isn't set, so the API runs and is
    testable on a laptop with zero Postgres setup — point DATABASE_URL at
    a real instance any time, no application code changes needed.
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


class PostgresJSONCollection:
    """Stores each document as a JSONB blob in a single `id, doc` table.

    This keeps the shared JSON data model (root README.md §3) as the
    single source of truth without hand-writing a relational schema per
    collection for a 24h hackathon — Postgres's JSONB containment operator
    (`@>`) gives us find-by-field queries almost for free. `table` is
    created lazily on first use.
    """

    def __init__(self, pool_getter, table: str):
        self._pool_getter = pool_getter
        self._table = table
        self._ensured = False

    async def _ensure_table(self, conn):
        if self._ensured:
            return
        await conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self._table} (
                id TEXT PRIMARY KEY,
                doc JSONB NOT NULL
            )
            """
        )
        self._ensured = True

    async def insert_one(self, doc: dict) -> dict:
        doc = dict(doc)
        doc.setdefault("_id", str(uuid4()))
        pool = await self._pool_getter()
        async with pool.acquire() as conn:
            await self._ensure_table(conn)
            await conn.execute(
                f"INSERT INTO {self._table} (id, doc) VALUES ($1, $2)",
                doc["_id"],
                json.dumps(doc),
            )
        return doc

    async def find_one(self, query: dict) -> dict | None:
        pool = await self._pool_getter()
        async with pool.acquire() as conn:
            await self._ensure_table(conn)
            row = await conn.fetchrow(
                f"SELECT doc FROM {self._table} WHERE doc @> $1::jsonb LIMIT 1",
                json.dumps(query),
            )
        return json.loads(row["doc"]) if row else None

    async def find(self, query: dict) -> list[dict]:
        pool = await self._pool_getter()
        async with pool.acquire() as conn:
            await self._ensure_table(conn)
            rows = await conn.fetch(
                f"SELECT doc FROM {self._table} WHERE doc @> $1::jsonb",
                json.dumps(query),
            )
        return [json.loads(row["doc"]) for row in rows]

    async def update_one(self, query: dict, update: dict) -> None:
        doc = await self.find_one(query)
        if doc is None:
            return
        doc.update(update.get("$set", {}))
        pool = await self._pool_getter()
        async with pool.acquire() as conn:
            await self._ensure_table(conn)
            await conn.execute(
                f"UPDATE {self._table} SET doc = $2::jsonb WHERE id = $1",
                doc["_id"],
                json.dumps(doc),
            )


class Database:
    def __init__(self):
        database_url = os.environ.get("DATABASE_URL")
        if database_url:
            import asyncpg

            self._pool = None
            self._pool_lock = asyncio.Lock()

            async def get_pool():
                if self._pool is None:
                    async with self._pool_lock:
                        if self._pool is None:
                            self._pool = await asyncpg.create_pool(database_url)
                return self._pool

            self.users = PostgresJSONCollection(get_pool, "users")
            self.connections = PostgresJSONCollection(get_pool, "connections")
            self.quests = PostgresJSONCollection(get_pool, "quests")
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
    """Converts a raw stored document (using `_id`) to the API shape
    (using `id`)."""
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    return out
