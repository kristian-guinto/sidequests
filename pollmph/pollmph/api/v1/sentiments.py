"""Sentiments Router

Endpoints for querying sentiment time-series and rolling moving averages.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client as SupabaseClient

from pollmph.api.deps import get_db, calculate_server_moving_averages
from pollmph.api.schemas import (
    SentimentRecord,
    SentimentHistoryResponse,
    MovingAveragePoint,
)
from pollmph.db import read_sentiment

router = APIRouter(prefix="/sentiments", tags=["Sentiments"])


@router.get("", response_model=List[SentimentRecord])
def list_sentiments(
    proposition_id: Optional[str] = Query(None, description="Filter by proposition ID"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    db: SupabaseClient = Depends(get_db),
):
    """Query raw sentiment evaluations."""
    s_date = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    e_date = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None

    raw = read_sentiment(
        db,
        proposition_id=proposition_id,
        start_date=s_date,
        end_date=e_date,
        limit=limit,
    )

    if not raw:
        return []

    return [
        SentimentRecord(
            proposition_id=s.proposition_id,
            date_generated=s.date_generated,
            consensus_value=s.consensus_value,
            attention_value=s.attention_value,
            movement_analysis=s.movement_analysis,
            rationale_consensus=s.rationale_consensus,
            rationale_attention=s.rationale_attention,
            data_quality=s.data_quality,
        )
        for s in raw
    ]


@router.get("/{proposition_id}", response_model=SentimentHistoryResponse)
def get_proposition_sentiment_history(
    proposition_id: str,
    limit: int = Query(60, ge=1, le=365, description="Max history window in days"),
    db: SupabaseClient = Depends(get_db),
):
    """Retrieve full sentiment history and computed 7-day moving averages for a proposition."""
    raw = read_sentiment(db, proposition_id=proposition_id, limit=limit)
    if not raw:
        return SentimentHistoryResponse(
            proposition_id=proposition_id, count=0, items=[], moving_averages=[]
        )

    records = [
        SentimentRecord(
            proposition_id=s.proposition_id,
            date_generated=s.date_generated,
            consensus_value=s.consensus_value,
            attention_value=s.attention_value,
            movement_analysis=s.movement_analysis,
            rationale_consensus=s.rationale_consensus,
            rationale_attention=s.rationale_attention,
            data_quality=s.data_quality,
        )
        for s in raw
    ]

    moving_averages = calculate_server_moving_averages(records, window_size=7)

    return SentimentHistoryResponse(
        proposition_id=proposition_id,
        count=len(records),
        items=records,
        moving_averages=moving_averages,
    )


@router.get("/{proposition_id}/latest", response_model=SentimentRecord)
def get_latest_sentiment(
    proposition_id: str,
    db: SupabaseClient = Depends(get_db),
):
    """Fetch the single most recent sentiment record for a proposition."""
    raw = read_sentiment(db, proposition_id=proposition_id, limit=1)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sentiment data found for proposition '{proposition_id}'",
        )

    s = raw[0]
    return SentimentRecord(
        proposition_id=s.proposition_id,
        date_generated=s.date_generated,
        consensus_value=s.consensus_value,
        attention_value=s.attention_value,
        movement_analysis=s.movement_analysis,
        rationale_consensus=s.rationale_consensus,
        rationale_attention=s.rationale_attention,
        data_quality=s.data_quality,
    )
