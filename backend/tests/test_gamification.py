from datetime import datetime, timedelta, timezone

from backend.app.gamification import next_streak, today_str


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


def test_first_ever_activity_starts_streak_at_one():
    assert next_streak(None, 0) == 1


def test_second_action_same_day_does_not_double_increment():
    assert next_streak(today_str(), 1) == 1


def test_action_next_day_increments_streak():
    assert next_streak(days_ago(1), 3) == 4


def test_gap_of_two_or_more_days_resets_streak_to_one():
    assert next_streak(days_ago(2), 5) == 1
    assert next_streak(days_ago(10), 30) == 1
