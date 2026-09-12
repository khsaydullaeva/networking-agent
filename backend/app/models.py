from typing import Literal

from pydantic import BaseModel, Field

ContextType = Literal["conference", "club", "orientation", "campus", "work", "other"]
QuestType = Literal["message", "read", "meet", "share"]
QuestStatus = Literal["pending", "completed"]


class Links(BaseModel):
    linkedin: str | None = None
    github: str | None = None
    twitter: str | None = None

    model_config = {"extra": "allow"}


class UserCreate(BaseModel):
    name: str
    goals: list[str] = Field(default_factory=list)
    links: Links = Field(default_factory=Links)


class User(UserCreate):
    id: str
    auth0_id: str | None = None
    xp: int = 0
    streak: int = 0


class Person(BaseModel):
    name: str
    org: str = ""
    links: Links = Field(default_factory=Links)


class MetContext(BaseModel):
    lat: float | None = None
    lng: float | None = None
    place_label: str | None = None
    ts: str | None = None
    context_type: ContextType = "other"


class ConnectionCreate(BaseModel):
    owner_id: str
    person: Person
    met: MetContext
    notes: list[str] = Field(default_factory=list)


class Fact(BaseModel):
    fact: str
    source_url: str
    date: str | None = None


class Enrichment(BaseModel):
    role: str | None = None
    interests: list[str] = Field(default_factory=list)
    recent_activity: list[Fact] = Field(default_factory=list)
    links: dict[str, str] = Field(default_factory=dict)


class Connection(BaseModel):
    id: str
    owner_id: str
    person: Person
    met: MetContext
    notes: list[str] = Field(default_factory=list)
    enrichment: Enrichment | None = None
    warmth: float = 0.0
    last_touch: str | None = None


class Quest(BaseModel):
    id: str
    owner_id: str
    connection_id: str
    type: QuestType
    title: str
    why_now: str
    draft_message: str | None = None
    status: QuestStatus = "pending"
    xp: int = 10
    due_at: str | None = None
