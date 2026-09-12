"""Deterministic XP + streak rules — no LLM call, same philosophy as
warmth.py. "Streak" = consecutive calendar days (UTC) with at least one
XP-awarding action (adding a connection or completing a quest)."""

from datetime import datetime, timezone

CONNECTION_XP = 5


def today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def next_streak(last_activity_date: str | None, current_streak: int) -> int:
    today = today_str()
    if last_activity_date == today:
        return max(current_streak, 1)  # already active today, unchanged
    if last_activity_date:
        gap_days = (
            datetime.now(timezone.utc).date() - datetime.fromisoformat(last_activity_date).date()
        ).days
        if gap_days == 1:
            return current_streak + 1
    return 1  # first-ever activity, or a gap broke the streak


async def award_xp(db, user_id: str, xp: int) -> dict | None:
    """Adds `xp` to the user's total, updates their streak, and returns
    {"xp_awarded", "new_total_xp", "streak"} — or None if the user doesn't
    exist (a stale session after a backend restart, see mobile/lib/session.ts)."""
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        return None

    streak = next_streak(user.get("last_activity_date"), user.get("streak", 0))
    new_total_xp = user.get("xp", 0) + xp

    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"xp": new_total_xp, "streak": streak, "last_activity_date": today_str()}},
    )
    return {"xp_awarded": xp, "new_total_xp": new_total_xp, "streak": streak}
