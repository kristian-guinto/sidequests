import os
import json
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Optional
from datetime import datetime, timedelta

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search, x_search
from pydantic import BaseModel, Field

# Assuming running from inside pipeline/ or with pipeline/ in pythonpath
try:
    from models import (
        AgentResponseModel,
        PropositionModel,
        PromptParameters,
        SentimentModel,
    )
except ImportError:
    from pipeline.models import (
        AgentResponseModel,
        PropositionModel,
        PromptParameters,
        SentimentModel,
    )

load_dotenv()

SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")


def setup_supabase():
    import supabase as sb

    if not SB_URL or not SB_KEY:
        raise ValueError(
            "Supabase URL and Key must be set in environment variables SUPABASE_URL and SUPABASE_KEY"
        )

    return sb.create_client(SB_URL, SB_KEY)


def load_propositions(supabase=None) -> List[PropositionModel]:
    if supabase is None:
        supabase = setup_supabase()

    try:
        response = supabase.table("propositions").select("*").execute()
        if response.data:
            propositions = []
            for p in response.data:
                propositions.append(
                    PropositionModel(
                        proposition_id=p["proposition_id"],
                        proposition_text=p["proposition_text"],
                        search_queries=p.get("search_queries") or [],
                    )
                )
            print(f"Loaded {len(propositions)} propositions from Supabase.")
            return propositions
    except Exception as e:
        print(
            f"Failed to load propositions from Supabase ({e}), falling back to local file"
        )

    prop_file = Path(__file__).parent / "propositions.json"
    default_props = [
        {
            "proposition_id": "marcos_robredo_2028",
            "proposition_text": "Bongbong Marcos and Leni Robredo will team up for the 2028 Philippine Presidential Election",
            "search_queries": [
                "BBM Leni Robredo",
                "Marcos endorsement Kakampink",
                "UniTeam split Robredo",
            ],
        },
        {
            "proposition_id": "sarah_duterte_wins_2028",
            "proposition_text": "Sara Duterte will win the 2028 Philippine Presidential Election",
            "search_queries": [
                "Sara Duterte 2028",
                "Sara Duterte presidential bid",
                "Sara Duterte election plans",
            ],
        },
    ]

    try:
        if prop_file.exists():
            with prop_file.open("r", encoding="utf-8") as f:
                raw_props = json.load(f)
            propositions = []
            for p in raw_props:
                pid = p.get("proposition_id")
                p_text = p.get("proposition_text")
                searches = p.get("search_queries") or []
                if pid and p_text:
                    propositions.append(
                        PropositionModel(
                            proposition_id=pid,
                            proposition_text=p_text,
                            search_queries=searches,
                        )
                    )
            return propositions
    except Exception as e:
        print(f"Failed to load propositions.json ({e}), falling back to defaults")

    return [PropositionModel(**p) for p in default_props]


def load_system_prompt() -> str:
    prompt_file = Path(__file__).parent / "system_prompt.txt"
    default_prompt = """You are a quantitative sentiment engine and expert political analyst specializing in Philippine socio-political discourse. Your task is to evaluate real-time public sentiment across social media (especially Twitter/X) and news platforms regarding a specific declarative proposition.

You must act as a "Predictive Market Oracle," scoring the proposition on two strictly defined metrics: Consensus (Agreement) and Attention (Volume).

### INPUT DATA
Proposition to Evaluate: "{proposition}"
Recommended Search Queries: {search_queries_list}, if empty use default queries based on the proposition text.
Yesterday's Consensus Score: {yesterday_consensus}, if empty default to 0.50 (perfect polarization or apathy)
Yesterday's Attention Score: {yesterday_attention}, if empty default to 0.10 (low chatter)

### INSTRUCTIONS
STEP 1: Execute real-time web and social searches using the Recommended Search Queries to gather today's discourse. Look for a balance of administration, opposition, and general public reactions.
STEP 2: Analyze the sentiment and volume of the data retrieved.
STEP 3: Compare today's data against Yesterday's Scores to determine if sentiment or attention has increased, decreased, or remained stagnant. Do not make drastic jumps in scores unless justified by a major real-world event.
STEP 4: Output your final evaluation strictly in the JSON format provided below. Do not include any conversational text outside the JSON.

### SCORING RUBRIC

METRIC 1: CONSENSUS (0.00 to 1.00)
Does the public agree with the Proposition?
* 0.00: Unanimous, aggressive rejection or mocking of the proposition.
* 0.25: Strong opposition. Only a tiny, heavily criticized minority defends it.
* 0.50: Perfect polarization (a 50/50 war), completely neutral reporting, or apathy.
* 0.75: Broad support. Generally accepted as true/good, with only a vocal minority opposing.
* 1.00: Unanimous, enthusiastic agreement.
(Note: If Attention is below 0.10, default Consensus to match Yesterday's Consensus).

METRIC 2: ATTENTION (0.00 to 1.00)
How loudly is the public talking about this today?
* 0.00: Utter silence. No one is talking about this natively.
* 0.25: Low chatter. Mentioned by a few hyper-partisan accounts or niche circles.
* 0.50: Moderate discussion. A recognized talking point today, but not dominating.
* 0.75: High virality. Trending widely across platforms and covered by mainstream news.
* 1.00: National dominance. It is the absolute center of the cultural/political timeline today.

### JSON OUTPUT SCHEMA
{{
  "consensus_value": <float between 0.00 and 1.00>,
  "attention_value": <float between 0.00 and 1.00>,
  "movement_analysis": "<1-sentence explanation of why the score moved (or didn't move) compared to yesterday>",
  "rationale_consensus": "<1-2 sentences justifying the consensus score based on specific narratives observed today>",
  "rationale_attention": "<1-sentence justifying the attention volume>",
  "data_quality": "<'High', 'Medium', or 'Low' based on the amount of search results you were able to retrieve>"
}}"""

    try:
        if prompt_file.exists():
            with prompt_file.open("r", encoding="utf-8") as f:
                return f.read()
    except Exception as e:
        print(f"Failed to load system_prompt.txt ({e}), using default")

    return default_prompt


SYSTEM_PROMPT = load_system_prompt()
PROPOSITIONS = load_propositions()


def get_xai_client():
    return Client(
        api_key=os.getenv("XAI_API_KEY"),
        timeout=3600,
    )


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
            .execute()
        )
        if response.data and len(response.data) > 0:
            return True
    except Exception as e:
        print(f"  Warning: Failed to check for existing record: {e}")

    return False


def analyze_date(target_date: datetime) -> List[dict]:
    """
    Runs the analysis for a specific date.
    Returns a list of dictionaries (SentimentModel.model_dump()).
    """
    client = get_xai_client()
    supabase = setup_supabase()

    # Define time window for analysis
    # x_search likely takes datetime.
    # Example: If target_date is 2023-10-27 (midnight), we want to search covering that day.

    start_of_day = datetime(target_date.year, target_date.month, target_date.day)
    end_of_day = start_of_day + timedelta(days=1)

    # Context window for search
    # If we want to capture the sentiment of the 'target_date', we should probably look at posts made on that day.
    # So from_date=start_of_day, to_date=end_of_day.
    # The original code used 'yesterday' to 'today', which is a 24h window ending 'now'.
    # If we are backfilling, 'now' is end of day.

    search_start = start_of_day - timedelta(days=1)  # Include context from day before?

    print(f"\n=== Analyzing for date: {start_of_day.date()} ===")

    results = []

    for proposition in PROPOSITIONS:
        print(f"Processing proposition: {proposition.proposition_id}")

        # Check if record already exists
        if check_existing_record(supabase, proposition.proposition_id, start_of_day):
            print(
                f"  Skipping {proposition.proposition_id} for {start_of_day.strftime('%Y-%m-%d')} - Record already exists."
            )
            continue

        # Fetch yesterday's metrics
        yesterday_metrics = get_yesterday_metrics(
            supabase, proposition.proposition_id, start_of_day
        )

        # Create a fresh chat for each proposition to keep context clean
        # The prompt is formatted with inputs.

        query = SYSTEM_PROMPT.format(
            **PromptParameters(
                proposition=proposition.proposition_text,
                search_queries_list=proposition.search_queries,
                yesterday_consensus=yesterday_metrics["consensus"],
                yesterday_attention=yesterday_metrics["attention"],
            ).model_dump()
        )

        try:
            chat = client.chat.create(
                model="grok-4-1-fast-reasoning",
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
        supabase = setup_supabase()
        response = supabase.table("sentiments").insert(results).execute()
        print("Save successful.")
    except Exception as e:
        print(f"Error saving to Supabase: {e}")


def backfill(start_date_str: str, end_date_str: str):
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
            results = analyze_date(current_date)
            if results:
                save_results(results)
            else:
                print(f"No results generated for {current_date.strftime('%Y-%m-%d')}")
        except Exception as e:
            print(f"Critical error on {current_date.strftime('%Y-%m-%d')}: {e}")

        current_date += timedelta(days=1)
        # Sleep slightly to avoid overwhelming rate limits if running many days
        time.sleep(1)


def run_today():
    today = datetime.now()
    results = analyze_date(today)
    save_results(results)


def main():
    parser = argparse.ArgumentParser(description="Sentiment Analysis Pipeline")
    parser.add_argument("--backfill-start", help="Start date for backfill (YYYY-MM-DD)")
    parser.add_argument("--backfill-end", help="End date for backfill (YYYY-MM-DD)")
    parser.add_argument("--date", help="Run for a specific single date (YYYY-MM-DD)")
    parser.add_argument(
        "--prod", action="store_true", help="Use production environment"
    )

    args = parser.parse_args()

    if args.prod:
        # this is for local testing with production supabase, not for running in prod environment.
        # In prod environment, env vars should just be set to prod values.
        global SB_URL, SB_KEY
        SB_URL = os.getenv("SUPABASE_URL_PROD")
        SB_KEY = os.getenv("SUPABASE_SERVICE_KEY_PROD")
        print("Using PRODUCTION Supabase environment.")

    if args.backfill_start and args.backfill_end:
        print(f"Starting backfill from {args.backfill_start} to {args.backfill_end}")
        backfill(args.backfill_start, args.backfill_end)
    elif args.date:
        print(f"Running single date analysis for {args.date}")
        d = datetime.strptime(args.date, "%Y-%m-%d")
        results = analyze_date(d)
        save_results(results)
    else:
        print("No arguments provided. Running for TODAY.")
        run_today()


if __name__ == "__main__":
    main()
