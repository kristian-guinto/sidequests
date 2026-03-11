"""
Manual integration test for the dynamic scheduling feature.
Runs against the DEV (test) Supabase database with a mock xAI client.
No real LLM calls are made; no API costs incurred.

Usage:
    uv run pipeline/scripts/test_schedule.py

Requires: SUPABASE_URL and SUPABASE_KEY set in .env (DEV database).
"""

import sys
import os
from datetime import datetime, timedelta
from unittest.mock import patch

# Allow running from repo root or pipeline/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

try:
    from util import get_supabase_client, get_mock_xai_client
    from proposition import read_propositions, update_next_run_date
    import main as pipeline_main
except ImportError:
    from pipeline.util import get_supabase_client, get_mock_xai_client
    from pipeline.proposition import read_propositions, update_next_run_date
    import pipeline.main as pipeline_main


PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SECTION = "\033[94m{}\033[0m"


def check(label: str, condition: bool, detail: str = ""):
    status = PASS if condition else FAIL
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))
    return condition


def get_next_run_date(supabase_client, proposition_id: str):
    resp = (
        supabase_client.table("propositions")
        .select("next_run_date")
        .eq("proposition_id", proposition_id)
        .single()
        .execute()
    )
    return resp.data.get("next_run_date") if resp.data else None


def reset_next_run_date(supabase_client, proposition_id: str, value=None):
    """Set next_run_date to a specific value (None = NULL)."""
    supabase_client.table("propositions").update({"next_run_date": value}).eq(
        "proposition_id", proposition_id
    ).execute()


def run_tests():
    supabase_client = get_supabase_client()

    # Pick the first active proposition to use as the test subject
    propositions = read_propositions(supabase_client)
    if not propositions:
        print("No active propositions found in test DB. Aborting.")
        sys.exit(1)

    prop = propositions[0]
    prop_id = prop.proposition_id
    today = datetime.now()
    today_date = today.date()

    print(f"\nUsing proposition: {prop_id}")
    print("=" * 60)

    all_passed = True

    # Tests 1–3 mock check_existing_record to always return False so the
    # idempotency guard doesn't skip propositions that already have today's
    # sentiment (likely on a prod-replica test DB).

    # ------------------------------------------------------------------
    # TEST 1: High attention (>= 0.5) → next_run_date = today + 1
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 1: High attention (0.75) → daily interval"))
    reset_next_run_date(supabase_client, prop_id, None)
    mock_client = get_mock_xai_client(attention=0.75)
    with (
        patch.object(pipeline_main, "get_xai_client", return_value=mock_client),
        patch.object(pipeline_main, "check_existing_record", return_value=False),
    ):
        pipeline_main.analyze_date(today, [prop_id], update_schedule=True)
    nrd = get_next_run_date(supabase_client, prop_id)
    expected = (today_date + timedelta(days=1)).isoformat()
    ok = check(
        "next_run_date = today + 1", nrd == expected, f"got {nrd}, expected {expected}"
    )
    all_passed = all_passed and ok

    # ------------------------------------------------------------------
    # TEST 2: Medium attention (0.25–0.49) → next_run_date = today + 3
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 2: Medium attention (0.35) → 3-day interval"))
    reset_next_run_date(supabase_client, prop_id, None)
    mock_client = get_mock_xai_client(attention=0.35)
    with (
        patch.object(pipeline_main, "get_xai_client", return_value=mock_client),
        patch.object(pipeline_main, "check_existing_record", return_value=False),
    ):
        pipeline_main.analyze_date(today, [prop_id], update_schedule=True)
    nrd = get_next_run_date(supabase_client, prop_id)
    expected = (today_date + timedelta(days=3)).isoformat()
    ok = check(
        "next_run_date = today + 3", nrd == expected, f"got {nrd}, expected {expected}"
    )
    all_passed = all_passed and ok

    # ------------------------------------------------------------------
    # TEST 3: Low attention (< 0.25) → next_run_date = today + 7
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 3: Low attention (0.10) → 7-day interval"))
    reset_next_run_date(supabase_client, prop_id, None)
    mock_client = get_mock_xai_client(attention=0.10)
    with (
        patch.object(pipeline_main, "get_xai_client", return_value=mock_client),
        patch.object(pipeline_main, "check_existing_record", return_value=False),
    ):
        pipeline_main.analyze_date(today, [prop_id], update_schedule=True)
    nrd = get_next_run_date(supabase_client, prop_id)
    expected = (today_date + timedelta(days=7)).isoformat()
    ok = check(
        "next_run_date = today + 7", nrd == expected, f"got {nrd}, expected {expected}"
    )
    all_passed = all_passed and ok

    # ------------------------------------------------------------------
    # TEST 4: Schedule filter — proposition with future next_run_date is skipped
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 4: Schedule filter skips future-dated propositions"))
    future_date = (today_date + timedelta(days=5)).isoformat()
    reset_next_run_date(supabase_client, prop_id, future_date)
    scheduled = read_propositions(supabase_client, respect_schedule=True)
    ids = [p.proposition_id for p in scheduled]
    ok = check(
        f"{prop_id} absent from today's queue",
        prop_id not in ids,
        f"scheduled ids: {ids}",
    )
    all_passed = all_passed and ok
    # Restore
    reset_next_run_date(supabase_client, prop_id, None)

    # ------------------------------------------------------------------
    # TEST 5: Schedule filter — proposition with NULL next_run_date is included
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 5: Schedule filter includes NULL next_run_date"))
    reset_next_run_date(supabase_client, prop_id, None)
    scheduled = read_propositions(supabase_client, respect_schedule=True)
    ids = [p.proposition_id for p in scheduled]
    ok = check(
        f"{prop_id} present in today's queue",
        prop_id in ids,
        f"scheduled ids: {ids}",
    )
    all_passed = all_passed and ok

    # ------------------------------------------------------------------
    # TEST 6: Budget cap — overflow proposition gets next_run_date = tomorrow
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 6: Budget cap bumps overflow to tomorrow"))
    all_props = read_propositions(supabase_client)
    if len(all_props) < 2:
        print("  [SKIP] Need at least 2 active propositions to test budget cap.")
    else:
        # Reset all next_run_dates
        for p in all_props:
            reset_next_run_date(supabase_client, p.proposition_id, None)

        overflow_prop = all_props[-1]
        overflow_id = overflow_prop.proposition_id
        mock_client = get_mock_xai_client(attention=0.75)

        original_budget = pipeline_main.MAX_DAILY_PROPOSITIONS
        pipeline_main.MAX_DAILY_PROPOSITIONS = len(all_props) - 1

        try:
            with patch.object(
                pipeline_main, "get_xai_client", return_value=mock_client
            ):
                pipeline_main.analyze_date(
                    today, update_schedule=True, respect_schedule=True
                )
        finally:
            pipeline_main.MAX_DAILY_PROPOSITIONS = original_budget

        nrd = get_next_run_date(supabase_client, overflow_id)
        expected = (today_date + timedelta(days=1)).isoformat()
        ok = check(
            f"overflow prop {overflow_id} bumped to tomorrow",
            nrd == expected,
            f"got {nrd}, expected {expected}",
        )
        all_passed = all_passed and ok

        # Restore
        for p in all_props:
            reset_next_run_date(supabase_client, p.proposition_id, None)

    # ------------------------------------------------------------------
    # TEST 7: get_last_run_date returns correct values
    # ------------------------------------------------------------------
    print(SECTION.format("\nTest 7: get_last_run_date — with history"))
    # Query the sentiments table directly to find the true most recent date
    resp = (
        supabase_client.table("sentiments")
        .select("date_generated")
        .eq("proposition_id", prop_id)
        .order("date_generated", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        print(f"  [SKIP] No sentiment history for {prop_id} in test DB.")
    else:
        expected_date = datetime.strptime(resp.data[0]["date_generated"], "%Y-%m-%d")
        fallback = datetime(2000, 1, 1)
        result = pipeline_main.get_last_run_date(supabase_client, prop_id, fallback)
        ok = check(
            "returns most recent sentiment date",
            result == expected_date,
            f"got {result.date()}, expected {expected_date.date()}",
        )
        all_passed = all_passed and ok

    print(SECTION.format("\nTest 7b: get_last_run_date — no history (fallback)"))
    fallback = datetime(2000, 1, 1)
    result = pipeline_main.get_last_run_date(
        supabase_client, "__test_nonexistent__", fallback
    )
    ok = check(
        "returns fallback for unknown proposition_id",
        result == fallback,
        f"got {result.date()}, expected {fallback.date()}",
    )
    all_passed = all_passed and ok

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    if all_passed:
        print(f"[{PASS}] All tests passed.")
    else:
        print(f"[{FAIL}] Some tests failed.")
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
