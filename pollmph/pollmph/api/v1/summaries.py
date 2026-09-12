"""Weekly Summaries Router

Endpoints for retrieving generated narrative weekly summaries.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client as SupabaseClient

from pollmph.api.deps import get_db
from pollmph.api.schemas import WeeklySummaryRecord
from pollmph.db import read_weekly_summaries

router = APIRouter(prefix="/summaries", tags=["Summaries"])


@router.get("", response_model=List[WeeklySummaryRecord])
def list_summaries(
    proposition_id: Optional[str] = Query(None, description="Filter by proposition ID"),
    limit: int = Query(20, ge=1, le=100),
    db: SupabaseClient = Depends(get_db),
):
    """List weekly narrative summaries."""
    summaries = read_weekly_summaries(
        db, proposition_id=proposition_id, target_date=None, limit=limit
    )
    if not summaries:
        return []

    return [
        WeeklySummaryRecord(
            proposition_id=s.proposition_id,
            week_start=s.week_start,
            week_end=s.week_end,
            summary=s.summary,
            key_drivers=s.key_drivers,
            trend_verdict=s.trend_verdict,
            outlook=s.outlook,
        )
        for s in summaries
    ]


@router.get("/{proposition_id}/latest", response_model=WeeklySummaryRecord)
def get_latest_weekly_summary(
    proposition_id: str,
    db: SupabaseClient = Depends(get_db),
):
    """Retrieve the most recent weekly narrative summary for a given proposition."""
    summaries = read_weekly_summaries(
        db, proposition_id=proposition_id, target_date=None, limit=1
    )
    if not summaries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No weekly summary available for proposition '{proposition_id}'",
        )

    s = summaries[0]
    return WeeklySummaryRecord(
        proposition_id=s.proposition_id,
        week_start=s.week_start,
        week_end=s.week_end,
        summary=s.summary,
        key_drivers=s.key_drivers,
        trend_verdict=s.trend_verdict,
        outlook=s.outlook,
    )
