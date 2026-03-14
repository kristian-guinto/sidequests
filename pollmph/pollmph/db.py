from datetime import datetime
from dotenv import load_dotenv
from numpy import polyfit
from supabase import Client as SupabaseClient

from pollmph.models import PropositionModel, SentimentModel, WeeklySummaryModel

load_dotenv()


def create_sentiment(
    sb_client: SupabaseClient,
    sentiment: SentimentModel,
):
    try:
        response = (
            sb_client.table("sentiments")
            .insert(
                {
                    "proposition_id": sentiment.proposition_id,
                    "date_generated": sentiment.date_generated,
                    "consensus_value": sentiment.consensus_value,
                    "attention_value": sentiment.attention_value,
                    "rationale_consensus": sentiment.rationale_consensus,
                    "rationale_attention": sentiment.rationale_attention,
                    "movement_analysis": sentiment.movement_analysis,
                    "data_quality": sentiment.data_quality,
                }
            )
            .execute()
        )
        print(
            f"Sentiment for proposition {sentiment.proposition_id} on {sentiment.date_generated} created successfully.",
        )
        return response.data
    except Exception as e:
        print(f"Error creating sentiment: {e}")
        return None


def read_sentiment(
    sb_client: SupabaseClient,
    proposition_id: str | None,
    start_date: datetime | None,
    end_date: datetime | None,
    limit: int = 10,
) -> list[SentimentModel] | None:
    query = sb_client.table("sentiments").select("*")
    if proposition_id:
        query = query.eq("proposition_id", proposition_id)
    if start_date:
        query = query.gte("date_generated", start_date.strftime("%Y-%m-%d"))
    if end_date:
        query = query.lte("date_generated", end_date.strftime("%Y-%m-%d"))
    query = query.order("date_generated", desc=True).limit(limit)

    response = query.execute()

    if response.data:
        sentiments = [SentimentModel(**s) for s in response.data]
        return sentiments

    return None


def has_sentiment_on_date(
    sb_client: SupabaseClient,
    proposition_id: str,
    date: datetime,
) -> bool:
    response = read_sentiment(sb_client, proposition_id, date, date, limit=1)
    return bool(response and len(response) > 0)


def get_prior_context(
    sb_client: SupabaseClient,
    proposition_id: str,
    context_start_date: datetime,
    context_end_date: datetime,
) -> str | None:
    context_start_date_str = context_start_date.strftime("%Y-%m-%d")
    context_end_date_str = context_end_date.strftime("%Y-%m-%d")

    try:
        response = read_sentiment(
            sb_client,
            proposition_id,
            context_start_date,
            context_end_date,
            limit=100,
        )

        if response and len(response) > 0:
            # compute consensus and attention statistics
            avg_consensus = sum(item.consensus_value for item in response) / len(
                response
            )
            avg_attention = sum(item.attention_value for item in response) / len(
                response
            )

            def get_trend(values, threshold=0.01):
                slope = polyfit(range(len(values)), values, 1)[0]
                return (
                    "increasing"
                    if slope > threshold
                    else "decreasing"
                    if slope < -threshold
                    else "stable"
                )

            trend_consensus = get_trend([item.consensus_value for item in response])
            trend_attention = get_trend([item.attention_value for item in response])

            # format as markdown table
            context = (
                f"Data from {context_start_date_str} to {context_end_date_str}\n\n"
                + "Statistics:\n"
                + f"- Average Consensus: {avg_consensus:.2f}\n"
                + f"- Average Attention: {avg_attention:.2f}\n"
                + f"- Consensus Trend: {trend_consensus}\n"
                + f"- Attention Trend: {trend_attention}\n\n"
                + "| Date | Consensus | Attention | Rationale Consensus | Rationale Attention |\n"
                + "|------|-----------|-----------|-------------------|-------------------|"
                + "".join(
                    f"\n| {item.date_generated} | {item.consensus_value} | {item.attention_value} | {item.rationale_consensus} | {item.rationale_attention} |"
                    for item in response
                )
            )
            return context
    except Exception as e:
        print(f"  Warning: Failed to fetch prior context: {e}")
        return None

    return None


def read_propositions(
    sb_client: SupabaseClient,
    proposition_ids: list[str] | None = None,
    include_archived: bool = False,
    scheduled_only: bool = False,
) -> list[PropositionModel] | None:
    query = sb_client.table("propositions").select(
        "proposition_id, proposition_text, search_queries, next_run_date"
    )
    if not include_archived:
        query = query.eq("is_archived", False)

    if proposition_ids:
        query = query.in_("proposition_id", proposition_ids)

    if scheduled_only:
        today_str = datetime.now().strftime("%Y-%m-%d")
        query = query.or_(f"next_run_date.is.null,next_run_date.lte.{today_str}")
        query = query.order("next_run_date", desc=False, nullsfirst=True)

    response = query.execute()

    if response.data:
        propositions = [PropositionModel(**p) for p in response.data]
        print(f"Loaded {len(propositions)} propositions from Supabase.")
        return propositions

    return None


def create_proposition(
    sb_client: SupabaseClient,
    proposition: PropositionModel,
):
    try:
        response = (
            sb_client.table("propositions")
            .insert(
                {
                    "proposition_id": proposition.proposition_id,
                    "proposition_text": proposition.proposition_text,
                    "search_queries": proposition.search_queries,
                    "is_archived": False,
                }
            )
            .execute()
        )
        print(f"Proposition {proposition.proposition_id} created successfully.")
        return response.data
    except Exception as e:
        print(f"Error creating proposition: {e}")
        return None


def update_proposition_next_run_date(
    sb_client: SupabaseClient,
    proposition_id: str,
    next_run_date: datetime,
):
    try:
        response = (
            sb_client.table("propositions")
            .update({"next_run_date": next_run_date.strftime("%Y-%m-%d")})
            .eq("proposition_id", proposition_id)
            .execute()
        )
        print(f"Proposition {proposition_id} next run date updated successfully.")
        return response.data
    except Exception as e:
        print(f"Error updating proposition next run date: {e}")
        return None


def read_weekly_summaries(
    sb_client: SupabaseClient,
    proposition_id: str | None,
    target_date: datetime | None,
    limit: int = 10,
) -> list[WeeklySummaryModel] | None:
    query = sb_client.table("weekly_summaries").select("*")
    if proposition_id:
        query = query.eq("proposition_id", proposition_id)
    if target_date:
        query = query.lte("week_end", target_date.strftime("%Y-%m-%d"))
        query = query.gte("week_start", target_date.strftime("%Y-%m-%d"))
    query = query.order("week_start", desc=True).limit(limit)

    response = query.execute()

    if response.data:
        summaries = [WeeklySummaryModel(**s) for s in response.data]
        return summaries

    return None


def has_weekly_summary_on_date(
    sb_client: SupabaseClient,
    proposition_id: str,
    target_date: datetime,
) -> bool:
    response = read_weekly_summaries(sb_client, proposition_id, target_date, limit=1)
    return bool(response and len(response) > 0)


def create_weekly_summary(
    sb_client: SupabaseClient,
    summary: WeeklySummaryModel,
):
    try:
        response = (
            sb_client.table("weekly_summaries")
            .insert(
                {
                    "proposition_id": summary.proposition_id,
                    "week_start": summary.week_start.strftime("%Y-%m-%d"),
                    "week_end": summary.week_end.strftime("%Y-%m-%d"),
                    "summary": summary.summary,
                    "key_drivers": summary.key_drivers,
                    "trend_verdict": summary.trend_verdict,
                    "outlook": summary.outlook,
                }
            )
            .execute()
        )
        print(
            f"Weekly summary for proposition {summary.proposition_id} from {summary.week_start.strftime('%Y-%m-%d')} to {summary.week_end.strftime('%Y-%m-%d')} created successfully.",
        )
        return response.data
    except Exception as e:
        print(f"Error creating weekly summary: {e}")
        return None
