"""API Dependencies and Shared Services

Provides dependency injection for database clients, settings, and analytical transforms.
"""

from datetime import datetime
from typing import Generator, List
from supabase import Client as SupabaseClient

from pollmph.settings import settings, Settings
from pollmph.util import get_supabase_client
from pollmph.api.schemas import MovingAveragePoint, SentimentRecord


def get_app_settings() -> Settings:
    return settings


def get_db() -> SupabaseClient:
    return get_supabase_client()


def calculate_server_moving_averages(
    sentiments: List[SentimentRecord], window_size: int = 7
) -> List[MovingAveragePoint]:
    """Calculate 7-day rolling moving averages server-side for API consumers."""
    if not sentiments:
        return []

    # Sort ascending by date
    sorted_sentiments = sorted(sentiments, key=lambda s: s.date_generated)

    ma_points: List[MovingAveragePoint] = []
    for idx, item in enumerate(sorted_sentiments):
        date_obj = datetime.strptime(item.date_generated, "%Y-%m-%d")
        short_date = date_obj.strftime("%b %d")

        if idx < window_size - 1:
            window = sorted_sentiments[: idx + 1]
        else:
            window = sorted_sentiments[idx - window_size + 1 : idx + 1]

        avg_c = sum(w.consensus_value for w in window) / len(window)
        avg_a = sum(w.attention_value for w in window) / len(window)

        ma_points.append(
            MovingAveragePoint(
                date_generated=item.date_generated,
                short_date=short_date,
                consensus_value=item.consensus_value,
                attention_value=item.attention_value,
                ma_consensus=round(avg_c, 3),
                ma_attention=round(avg_a, 3),
            )
        )

    return ma_points
