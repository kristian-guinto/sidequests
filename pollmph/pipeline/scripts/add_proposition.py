from dotenv import load_dotenv
import argparse

try:
    from util import get_supabase_client
    from proposition import create_proposition, PropositionModel
    from main import backfill
except ImportError:
    from pipeline.util import get_supabase_client
    from pipeline.proposition import create_proposition, PropositionModel
    from pipeline.main import backfill

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="CLI command to add new proposition")
    parser.add_argument(
        "--backfill-days",
        type=int,
        default=None,
        help="Number of past days to backfill sentiment data for the new proposition",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Path to a json file containing proposition details. If not provided, will prompt for input.",
    )

    args = parser.parse_args()

    if args.file:
        import json

        with open(args.file, "r") as f:
            json_data = json.load(f)

        print(f"Enter proposition ID: {json_data['proposition_id']}")
        print(f"Enter proposition text: {json_data['proposition_text']}")
        print(
            f"Enter search queries (comma-separated): {', '.join(json_data['search_queries'])}"
        )

    else:
        proposition_id = input("Enter proposition ID: ")
        proposition_text = input("Enter proposition text: ")
        search_queries = input("Enter search queries (comma-separated): ").split(",")

        json_data = {
            "proposition_id": proposition_id,
            "proposition_text": proposition_text,
            "search_queries": search_queries,
        }

    proposition = PropositionModel.model_validate(json_data)

    supabase_client = get_supabase_client()
    try:
        response = create_proposition(supabase_client, proposition)

    except Exception as e:
        print(f"Error adding proposition: {e}")

    if response is None:
        raise ValueError("Failed to add proposition")

    if args.backfill_days:
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo

        assert args.backfill_days > 0, "backfill-days must be a positive integer"
        end_date = datetime.now(tz=ZoneInfo("Asia/Manila")) - timedelta(
            days=1
        )  # backfill up to yesterday
        start_date = end_date - timedelta(days=args.backfill_days)

        end_date_str = end_date.strftime("%Y-%m-%d")
        start_date_str = start_date.strftime("%Y-%m-%d")

        print(
            f"Starting backfill for proposition '{json_data['proposition_id']}' from {start_date_str} to {end_date_str}"
        )
        backfill(
            start_date_str,
            end_date_str,
            proposition_ids=[json_data["proposition_id"]],
        )


if __name__ == "__main__":
    main()
