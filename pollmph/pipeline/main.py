import os
import time
import argparse
from dotenv import load_dotenv
from typing import List
from datetime import datetime, timedelta
import numpy as np

from xai_sdk.chat import user
from xai_sdk.tools import web_search, x_search

# Assuming running from inside pipeline/ or with pipeline/ in pythonpath
try:
    from models import (
        AgentResponseModel,
        SentimentModel,
    )
    from system_prompt import load_system_prompt, PromptParameters
    from util import get_supabase_client, get_xai_client
    from proposition import read_propositions
except ImportError:
    from pipeline.models import (
        AgentResponseModel,
        SentimentModel,
    )
    from pipeline.system_prompt import load_system_prompt, PromptParameters
    from pipeline.util import get_supabase_client, get_xai_client
    from pipeline.proposition import read_propositions

load_dotenv()

SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")
GROK_MODEL = "grok-4-1-fast-reasoning"


def get_yesterday_metrics(
    supabase_client, proposition_id: str, target_date: datetime
) -> dict:
    """
    Fetches the consensus and attention scores from the previous day.
    Returns default values if no data is found.
    """
    yesterday = target_date - timedelta(days=1)
    yesterday_str = yesterday.strftime("%Y-%m-%d")

    try:
        response = (
            supabase_client.table("sentiments")
            .select("consensus_value, attention_value")
            .eq("proposition_id", proposition_id)
            .eq("date_generated", yesterday_str)
            .execute()
        )

        if response.data and len(response.data) > 0:
            print(
                f"  Found yesterday's data ({yesterday_str}): Consensus={response.data[0]['consensus_value']}, Attention={response.data[0]['attention_value']}"
            )
            return {
                "consensus": response.data[0]["consensus_value"],
                "attention": response.data[0]["attention_value"],
            }
    except Exception as e:
        print(
            f"  Warning: Failed to fetch yesterday's metrics for {proposition_id}: {e}"
        )

    print(f"  No data for {yesterday_str}. Using defaults.")
    return {"consensus": 0.50, "attention": 0.10}


def get_prior_context(
    supabase_client, proposition_id: str, target_date: datetime, n_days: int = 7
):
    context_start_date = target_date - timedelta(days=n_days)
    context_start_date_str = context_start_date.strftime("%Y-%m-%d")
    target_date_str = target_date.strftime("%Y-%m-%d")

    try:
        response = (
            supabase_client.table("sentiments")
            .select(
                "date_generated, consensus_value, attention_value, rationale_consensus, rationale_attention"
            )
            .eq("proposition_id", proposition_id)
            .gte("date_generated", context_start_date_str)
            .lte("date_generated", target_date_str)
            .execute()
        )

        if response.data and len(response.data) > 0:
            # compute consensus and attention statistics
            avg_consensus = sum(
                item["consensus_value"] for item in response.data
            ) / len(response.data)
            avg_attention = sum(
                item["attention_value"] for item in response.data
            ) / len(response.data)

            def get_trend(values, threshold=0.01):
                slope = np.polyfit(range(len(values)), values, 1)[0]
                return (
                    "increasing"
                    if slope > threshold
                    else "decreasing"
                    if slope < -threshold
                    else "stable"
                )

            trend_consensus = get_trend(
                [item["consensus_value"] for item in response.data]
            )
            trend_attention = get_trend(
                [item["attention_value"] for item in response.data]
            )

            # format as markdown table
            context = (
                f"Data from last {n_days} days\n\n"
                + "Statistics:\n"
                + f"- Average Consensus: {avg_consensus:.2f}\n"
                + f"- Average Attention: {avg_attention:.2f}\n"
                + f"- Consensus Trend: {trend_consensus}\n"
                + f"- Attention Trend: {trend_attention}\n\n"
                + "| Date | Consensus | Attention | Rationale Consensus | Rationale Attention |\n"
                + "|------|-----------|-----------|-------------------|-------------------|"
                + "".join(
                    f"\n| {item['date_generated']} | {item['consensus_value']} | {item['attention_value']} | {item['rationale_consensus']} | {item['rationale_attention']} |"
                    for item in response.data
                )
            )
            return context
    except Exception as e:
        print(f"  Warning: Failed to fetch prior context: {e}")
        return None

    return None


def check_existing_record(
    supabase_client, proposition_id: str, target_date: datetime
) -> bool:
    """
    Checks if a record already exists for the given proposition and date.
    """
    target_date_str = target_date.strftime("%Y-%m-%d")
    try:
        response = (
            supabase_client.table("sentiments")
            .select("proposition_id")
            .eq("proposition_id", proposition_id)
            .eq("date_generated", target_date_str)
            .limit(1)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return True
    except Exception as e:
        print(f"  Warning: Failed to check for existing record: {e}")

    return False


def analyze_date(
    target_date: datetime, proposition_ids: List[str] | None = None
) -> List[dict]:
    """
    Runs the analysis for a specific date.
    Returns a list of dictionaries (SentimentModel.model_dump()).
    """
    llm_client = get_xai_client()
    supabase_client = get_supabase_client()

    start_of_day = datetime(target_date.year, target_date.month, target_date.day)
    end_of_day = start_of_day + timedelta(days=1)
    search_start = start_of_day - timedelta(days=1)  # Include context from day before

    print(f"\n=== Analyzing for date: {start_of_day.date()} ===")

    # Read propositions fresh from database
    propositions = read_propositions(supabase_client)

    results = []

    for proposition in propositions:
        # If proposition_id filter is set, skip propositions that don't match
        if proposition_ids and proposition.proposition_id not in proposition_ids:
            print(f"Skipping proposition {proposition.proposition_id} due to filter")
            continue

        print(f"Processing proposition: {proposition.proposition_id}")

        # Check if record already exists
        if check_existing_record(
            supabase_client, proposition.proposition_id, start_of_day
        ):
            print(
                f"  Skipping {proposition.proposition_id} for {start_of_day.strftime('%Y-%m-%d')} - Record already exists."
            )
            continue

        # Get prior context
        prior_context = get_prior_context(
            supabase_client, proposition.proposition_id, start_of_day
        )

        # Create a fresh chat for each proposition to keep context clean
        # The prompt is formatted with inputs.

        query = load_system_prompt(
            PromptParameters(
                proposition=proposition.proposition_text,
                search_queries_list=proposition.search_queries,
                prior_context=prior_context,
            )
        )
        print(query)
        try:
            chat = llm_client.chat.create(
                model=GROK_MODEL,
                tools=[
                    web_search(),
                    x_search(from_date=search_start, to_date=end_of_day),
                ],
                include=["verbose_streaming"],
                response_format=AgentResponseModel,
            )

            chat.append(user(query))

            is_thinking = True
            accumulated_content = ""

            for response, chunk in chat.stream():
                if chunk.tool_calls:
                    for tool_call in chunk.tool_calls:
                        print(f"  > Calling tool: {tool_call.function.name}")

                if response.usage and response.usage.reasoning_tokens and is_thinking:
                    # print(f"\rThinking... ({response.usage.reasoning_tokens} tokens)", end="", flush=True)
                    pass

                if chunk.content:
                    if is_thinking:
                        # print("\nFinal Response generating...")
                        is_thinking = False
                    accumulated_content += chunk.content
                    # print(chunk.content, end="", flush=True)

            print("\n  Response received.")

            # Parse the JSON result
            # Sometimes models wrap JSON in markdown blocks
            json_str = accumulated_content

            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]

            agent_response = AgentResponseModel.model_validate_json(json_str.strip())

            sentiment = SentimentModel(
                proposition_id=proposition.proposition_id,
                **agent_response.model_dump(),
                date_generated=start_of_day.strftime("%Y-%m-%d"),
            ).model_dump()
            print(sentiment)
            results.append(sentiment)

        except Exception as e:
            print(f"  ERROR processing {proposition.proposition_id}: {e}")
            # print(f"  Raw content: {accumulated_content}")
            continue

    return results


def save_results(results: List[dict]):
    if not results:
        print("No results to save.")
        return

    print(f"Saving {len(results)} records to Supabase...")
    try:
        supabase_client = get_supabase_client()
        _ = supabase_client.table("sentiments").insert(results).execute()
        print("Save successful.")
    except Exception as e:
        print(f"Error saving to Supabase: {e}")


def backfill(
    start_date_str: str,
    end_date_str: str,
    proposition_ids: List[str] | None = None,
    save_results_flag: bool = True,
):
    """
    Backfills analysis for a date range (inclusive).
    Format: YYYY-MM-DD
    """
    current_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")

    if current_date > end_date:
        print("Start date must be before or equal to end date.")
        return

    while current_date <= end_date:
        try:
            results = analyze_date(current_date, proposition_ids)
            if results:
                if save_results_flag:
                    save_results(results)
            else:
                print(f"No results generated for {current_date.strftime('%Y-%m-%d')}")
        except Exception as e:
            print(f"Critical error on {current_date.strftime('%Y-%m-%d')}: {e}")

        current_date += timedelta(days=1)
        # Sleep slightly to avoid overwhelming rate limits if running many days
        time.sleep(1)


def run_today(proposition_ids: List[str] | None = None, save_results_flag: bool = True):
    today = datetime.now()
    results = analyze_date(today, proposition_ids)
    if save_results_flag:
        save_results(results)


def main():
    parser = argparse.ArgumentParser(description="Sentiment Analysis Pipeline")
    parser.add_argument("--backfill-start", help="Start date for backfill (YYYY-MM-DD)")
    parser.add_argument("--backfill-end", help="End date for backfill (YYYY-MM-DD)")
    parser.add_argument("--date", help="Run for a specific single date (YYYY-MM-DD)")
    parser.add_argument(
        "--no-save-results",
        action="store_true",
        help="Whether to save results to Supabase",
    )

    args = parser.parse_args()

    if args.backfill_start and args.backfill_end:
        print(f"Starting backfill from {args.backfill_start} to {args.backfill_end}")
        backfill(
            args.backfill_start,
            args.backfill_end,
            save_results_flag=not args.no_save_results,
        )
    elif args.date:
        print(f"Running single date analysis for {args.date}")
        d = datetime.strptime(args.date, "%Y-%m-%d")
        results = analyze_date(d)
        if not args.no_save_results:
            save_results(results)
    else:
        print("No arguments provided. Running for TODAY.")
        run_today(save_results_flag=not args.no_save_results)


if __name__ == "__main__":
    main()
