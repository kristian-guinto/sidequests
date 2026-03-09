from datetime import datetime, timedelta
from typing import List
from supabase import Client as SupabaseClient
from xai_sdk.chat import user
from argparse import ArgumentParser

from pipeline.main import get_prior_context
from pipeline.proposition import read_propositions
from pipeline.util import get_supabase_client
from pipeline.util import get_xai_client
from pipeline.system_prompt import load_weekly_summary_prompt, PromptParameters
from pipeline.models import AgentResponseWeeklySummary, WeeklySummaryModel

GROK_MODEL = "grok-4-1-fast-reasoning"


def generate_weekly_summary(
    supabase_client: SupabaseClient,
    save_to_db: bool = True,
) -> list[dict] | None:
    llm_client = get_xai_client()
    supabase_client = get_supabase_client()
    propositions = read_propositions(supabase_client)

    # Find the closest previous Sunday
    today = datetime.now().date()

    if today.weekday() == 6:  # If today is Sunday, use today as the end of the week
        last_sunday = today
    else:
        last_sunday = today - timedelta(days=today.weekday() + 1)

    week_start = last_sunday - timedelta(days=6)  # Get the previous Monday
    week_end = last_sunday

    if not propositions:
        print("No propositions found. Skipping weekly summary generation.")
        return

    for proposition in propositions:
        print(
            f"Generating weekly summary for proposition: {proposition.proposition_id}"
        )
        prior_context = get_prior_context(
            supabase_client, proposition.proposition_id, target_date=week_end, n_days=6
        )

        query = load_weekly_summary_prompt(
            PromptParameters(
                proposition=proposition.proposition_text,
                search_queries_list=None,  # No search results needed for weekly summary
                prior_context=prior_context,
            )
        )
        # print(query)
        results = []
        try:
            chat = llm_client.chat.create(
                model=GROK_MODEL,
                tools=[],
                include=["verbose_streaming"],
                response_format=AgentResponseWeeklySummary,
            )

            chat.append(user(query))

            is_thinking = True
            accumulated_content = ""

            for response, chunk in chat.stream():
                if chunk.tool_calls:
                    for tool_call in chunk.tool_calls:
                        print(f"  > Calling tool: {tool_call.function.name}")

                if response.usage and response.usage.reasoning_tokens and is_thinking:
                    print(
                        f"\rThinking... ({response.usage.reasoning_tokens} tokens)",
                        end="",
                        flush=True,
                    )
                    pass

                if chunk.content:
                    if is_thinking:
                        #     print("\nFinal Response generating...")
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

            agent_response = AgentResponseWeeklySummary.model_validate_json(
                json_str.strip()
            )

            summary = WeeklySummaryModel(
                proposition_id=proposition.proposition_id,
                week_start=week_start.strftime("%Y-%m-%d"),
                week_end=week_end.strftime("%Y-%m-%d"),
                **agent_response.model_dump(),
            ).model_dump()

            if save_to_db:
                save_weekly_summary_to_db(supabase_client, summary)
            else:
                print(
                    f"Weekly summary for proposition_id {proposition.proposition_id}:\n{summary}\n"
                )

            results.append(summary)

        except Exception as e:
            print(f"  ERROR processing {proposition.proposition_id}: {e}")
            # print(f"  Raw content: {accumulated_content}")
            continue

    return results


def save_weekly_summary_to_db(supabase_client: SupabaseClient, summary: dict):
    if not summary:
        print("No summary to save.")
        return

    print(
        f"Saving weekly summary for proposition_id {summary['proposition_id']} to Supabase..."
    )
    try:
        supabase_client.table("weekly_summaries").insert(summary).execute()
        print("Weekly summary saved successfully.")
    except Exception as e:
        print(
            f"Error saving weekly summary for proposition_id {summary['proposition_id']} to Supabase: {e}"
        )
        return


if __name__ == "__main__":
    parser = ArgumentParser(description="Generate weekly summaries for propositions.")
    parser.add_argument(
        "--save", action="store_true", help="Whether to save summaries to the database."
    )
    args = parser.parse_args()

    supabase_client = get_supabase_client()
    summaries = generate_weekly_summary(supabase_client, save_to_db=args.save)
