"""Orchestrates the execution of various tasks"""

from datetime import datetime, timedelta

from pollmph.llm import LLMAdapter
from pollmph.task import SentimentTask, ContextSummaryTask
from pollmph.util import get_supabase_client, get_xai_adapter
from pollmph.db import (
    has_sentiment_on_date,
    read_propositions,
    read_sentiment,
    create_sentiment,
    update_proposition_next_run_date,
    create_weekly_summary,
    has_weekly_summary_on_date,
)
from pollmph.models import SentimentModel, WeeklySummaryModel


def run_date_interval_policy(attention_value: float) -> int:
    if attention_value >= 0.75:
        return 1
    elif attention_value >= 0.5:
        return 3
    else:
        return 7


def run_sentiment_on_date(
    target_date: datetime,
    proposition_ids: list[str] | None = None,  # if None, run all.
    verbose: bool = False,
    update_next_run: bool = True,
    write_to_db: bool = True,
    adapter: LLMAdapter | None = None,
):
    llm_adapter = adapter or get_xai_adapter(model="grok-4.1-fast-reasoning")
    sb_client = get_supabase_client()
    task = SentimentTask(adapter=llm_adapter, sb_client=sb_client, verbose=verbose)

    propositions = read_propositions(sb_client, proposition_ids)

    if not propositions:
        print("No propositions found.")
        return

    for proposition in propositions:
        try:
            # skip if sentiment already exists for this proposition on the target date
            if has_sentiment_on_date(
                sb_client, proposition.proposition_id, target_date
            ):
                print(
                    f"Sentiment already exists for proposition {proposition.proposition_id} on {target_date.strftime('%Y-%m-%d')}. Skipping.",
                )
                continue

            # run sentiment task
            print(
                f"\nRunning sentiment analysis for proposition {proposition.proposition_id} on {target_date.strftime('%Y-%m-%d')}...",
            )

            # determine search window
            latest_sentiment = read_sentiment(
                sb_client,
                proposition.proposition_id,
                None,
                None,
                limit=1,
            )

            latest_date = (
                datetime.strptime(latest_sentiment[0].date_generated, "%Y-%m-%d")
                if latest_sentiment
                else None
            )

            search_start = (
                latest_date + timedelta(days=1)
                if latest_date
                else target_date - timedelta(days=7)
            )

            # Execute the sentiment task for the proposition and date
            response, output = task.run(
                proposition, search_start=search_start, search_end=target_date
            )

            if output is None:
                print("No output generated for this proposition and date.")
                continue

            # process output and create sentiment record
            sentiment = SentimentModel(
                proposition_id=proposition.proposition_id,
                date_generated=target_date.strftime("%Y-%m-%d"),
                **output.model_dump(),
            )

            # write to database
            if write_to_db:
                if create_sentiment(
                    sb_client,
                    sentiment,
                ):
                    print(
                        f"Sentiment created for proposition {proposition.proposition_id} on {target_date.strftime('%Y-%m-%d')}."
                    )
                else:
                    print(
                        f"Failed to create sentiment for proposition {proposition.proposition_id} on {target_date.strftime('%Y-%m-%d')}."
                    )

            # update next run date based on attention value
            if update_next_run and write_to_db:
                interval = run_date_interval_policy(sentiment.attention_value)
                next_run = target_date + timedelta(days=interval)
                update_proposition_next_run_date(
                    sb_client, proposition.proposition_id, next_run
                )
                print(
                    f"  Next run for {proposition.proposition_id}: {next_run} "
                    f"(interval={interval}d, attention={sentiment.attention_value:.2f})"
                )
        except Exception as e:
            print(
                f"Error running sentiment task for proposition {proposition.proposition_id}: {e}"
            )


def run_today(daily_limit: int = 5, adapter: LLMAdapter | None = None):
    today = datetime.now()

    # get propositions that are due for sentiment analysis today
    sb_client = get_supabase_client()
    propositions = read_propositions(sb_client, scheduled_only=True)

    if not propositions or len(propositions) == 0:
        print("No propositions scheduled for sentiment analysis today.")
        return

    print(f"Found {len(propositions)} propositions scheduled for today.")
    # limit to daily_limit, those skipped will retain their next_run_date
    # so they have higher priority in the next run.
    propositions = propositions[:daily_limit]

    proposition_ids = [p.proposition_id for p in propositions]
    run_sentiment_on_date(
        today, proposition_ids=proposition_ids, update_next_run=True, adapter=adapter
    )


def run_backfill_sentiment(
    proposition_ids: list[str] | None = None,
    days_back: int = 7,
    adapter: LLMAdapter | None = None,
):
    today = datetime.now()
    for i in range(days_back):
        target_date = today - timedelta(days=i)
        print(f"\n=== Running sentiment for {target_date.strftime('%Y-%m-%d')} ===")
        # disable next_run_date update during backfill to ensure we backfill all dates.
        run_sentiment_on_date(
            target_date,
            proposition_ids=proposition_ids,
            update_next_run=False,
            adapter=adapter,
        )


def run_weekly_summary(
    target_date: datetime,
    proposition_ids: list[str] | None = None,
    verbose: bool = False,
    adapter: LLMAdapter | None = None,
):
    llm_adapter = adapter or get_xai_adapter(model="grok-4.1-fast-reasoning")
    sb_client = get_supabase_client()
    task = ContextSummaryTask(adapter=llm_adapter, sb_client=sb_client, verbose=verbose)

    propositions = read_propositions(sb_client, proposition_ids)

    if not propositions:
        print("No propositions found.")
        return

    today = datetime.now().date()

    if today.weekday() == 6:  # If today is Sunday, use today as the end of the week
        last_sunday = today
    else:
        last_sunday = today - timedelta(days=today.weekday() + 1)

    week_start = last_sunday - timedelta(days=6)  # Get the previous Monday
    week_end = last_sunday

    for proposition in propositions:
        try:
            print(
                f"\nRunning weekly summary for proposition {proposition.proposition_id} from {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}...",
            )

            if has_weekly_summary_on_date(
                sb_client, proposition.proposition_id, week_end
            ):
                print(
                    f"Weekly summary already exists for proposition {proposition.proposition_id} on {week_end.strftime('%Y-%m-%d')}. Skipping.",
                )
                continue

            # Execute the context summary task for the proposition and date range
            response, output = task.run(proposition, week_start, week_end)

            if output is None:
                print("No output generated for this proposition and date range.")
                continue

            # process output and create weekly summary record
            summary = WeeklySummaryModel(
                proposition_id=proposition.proposition_id,
                week_start=week_start,
                week_end=week_end,
                **output.model_dump(),
            )

            # write to database
            if create_weekly_summary(
                sb_client,
                summary,
            ):
                print(
                    f"Weekly summary created for proposition {proposition.proposition_id} from {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}."
                )
            else:
                print(
                    f"Failed to create weekly summary for proposition {proposition.proposition_id} from {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}."
                )

        except Exception as e:
            print(
                f"Error running weekly summary task for proposition {proposition.proposition_id}: {e}"
            )
