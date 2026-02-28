from argparse import ArgumentParser
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

load_dotenv()

try:
    from util import get_supabase_client
    from proposition import read_propositions
    from main import backfill
except ImportError:
    from pipeline.util import get_supabase_client
    from pipeline.proposition import read_propositions
    from pipeline.main import backfill


def main():
    parser = ArgumentParser(
        description="Script to backfill existing propositions by ID"
    )
    parser.add_argument(
        "--id",
        required=True,
        type=str,
        help="The proposition ID to backfill (e.g. 'marcos_wins_2028')",
    )
    parser.add_argument(
        "--backfill-days",
        type=int,
        required=True,
        help="Number of past days to backfill sentiment data for the proposition",
    )

    args = parser.parse_args()
    proposition_id = args.id
    backfill_days = args.backfill_days

    supabase_client = get_supabase_client()
    # Check if proposition exists
    propositions = read_propositions(supabase_client, include_archived=True)
    proposition_ids = [p.proposition_id for p in propositions]
    if proposition_id not in proposition_ids:
        print(f"Proposition ID '{proposition_id}' not found in database.")
        raise ValueError(f"Proposition ID '{proposition_id}' not found")

    assert backfill_days > 0, "Backfill days must be a positive integer"
    end_date = datetime.now(tz=ZoneInfo("Asia/Manila")) - timedelta(
        days=1
    )  # backfill up to yesterday
    start_date = end_date - timedelta(days=args.backfill_days)

    end_date_str = end_date.strftime("%Y-%m-%d")
    start_date_str = start_date.strftime("%Y-%m-%d")

    print(
        f"Starting backfill for proposition '{proposition_id}' from {start_date_str} to {end_date_str}"
    )
    backfill(
        start_date_str,
        end_date_str,
        proposition_ids=[proposition_id],
    )


if __name__ == "__main__":
    main()
