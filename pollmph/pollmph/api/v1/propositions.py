"""Propositions Router

Endpoints for managing, listing, and retrieving political propositions.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client as SupabaseClient

from pollmph.api.deps import get_db, calculate_server_moving_averages
from pollmph.api.schemas import (
    PropositionCreate,
    PropositionResponse,
    PropositionUpdate,
    PropositionDashboardCard,
    SentimentRecord,
)
from pollmph.db import (
    read_propositions,
    create_proposition as db_create_proposition,
    read_sentiment,
)
from pollmph.models import PropositionModel

router = APIRouter(prefix="/propositions", tags=["Propositions"])


@router.get("", response_model=List[PropositionResponse])
def list_propositions(
    include_archived: bool = Query(False, description="Include archived propositions"),
    db: SupabaseClient = Depends(get_db),
):
    """List all tracked propositions."""
    propositions = read_propositions(db, include_archived=include_archived)
    if not propositions:
        return []
    return [
        PropositionResponse(
            proposition_id=p.proposition_id,
            proposition_text=p.proposition_text,
            search_queries=p.search_queries,
            next_run_date=p.next_run_date,
            is_archived=p.is_archived,
        )
        for p in propositions
    ]


@router.get("/dashboard", response_model=List[PropositionDashboardCard])
def get_dashboard_cards(
    include_archived: bool = Query(
        False, description="Include archived propositions in dashboard"
    ),
    db: SupabaseClient = Depends(get_db),
):
    """Retrieve full dashboard data for all propositions including pre-calculated

    7-day moving averages, latest consensus, attention, and delta trends.
    This provides a single consolidated payload for the frontend UI.
    """
    propositions = read_propositions(db, include_archived=include_archived)
    if not propositions:
        return []

    cards: List[PropositionDashboardCard] = []

    for prop in propositions:
        # Fetch sentiments for this proposition
        raw_sentiments = read_sentiment(
            db, proposition_id=prop.proposition_id, limit=60
        )
        if not raw_sentiments:
            cards.append(
                PropositionDashboardCard(
                    id=prop.proposition_id,
                    proposition_text=prop.proposition_text,
                    is_archived=prop.is_archived,
                    evaluations=[],
                )
            )
            continue

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
            for s in raw_sentiments
        ]

        moving_averages = calculate_server_moving_averages(records, window_size=7)

        latest_point = moving_averages[-1] if moving_averages else None
        prev_point = moving_averages[-2] if len(moving_averages) > 1 else latest_point

        delta = (
            round(latest_point.ma_consensus - prev_point.ma_consensus, 4)
            if (latest_point and prev_point)
            else 0.0
        )

        first_point = moving_averages[0] if moving_averages else None

        cards.append(
            PropositionDashboardCard(
                id=prop.proposition_id,
                proposition_text=prop.proposition_text,
                is_archived=prop.is_archived,
                latest_consensus=latest_point.ma_consensus if latest_point else None,
                latest_attention=latest_point.ma_attention if latest_point else None,
                delta_consensus=delta,
                tracking_since=first_point.short_date if first_point else None,
                latest_date=latest_point.short_date if latest_point else None,
                evaluations=moving_averages,
            )
        )

    return cards


@router.get("/{proposition_id}", response_model=PropositionResponse)
def get_proposition(
    proposition_id: str,
    db: SupabaseClient = Depends(get_db),
):
    """Retrieve details for a single proposition by ID."""
    propositions = read_propositions(
        db, proposition_ids=[proposition_id], include_archived=True
    )
    if not propositions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposition '{proposition_id}' not found",
        )

    p = propositions[0]
    return PropositionResponse(
        proposition_id=p.proposition_id,
        proposition_text=p.proposition_text,
        search_queries=p.search_queries,
        next_run_date=p.next_run_date,
        is_archived=p.is_archived,
    )


@router.post(
    "",
    response_model=PropositionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_proposition(
    payload: PropositionCreate,
    db: SupabaseClient = Depends(get_db),
):
    """Register a new proposition to track."""
    prop_model = PropositionModel(
        proposition_id=payload.proposition_id,
        proposition_text=payload.proposition_text,
        search_queries=payload.search_queries,
    )

    result = db_create_proposition(db, prop_model)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create proposition. Check ID uniqueness.",
        )

    return PropositionResponse(
        proposition_id=payload.proposition_id,
        proposition_text=payload.proposition_text,
        search_queries=payload.search_queries,
        is_archived=False,
    )


@router.patch("/{proposition_id}", response_model=PropositionResponse)
def update_proposition(
    proposition_id: str,
    payload: PropositionUpdate,
    db: SupabaseClient = Depends(get_db),
):
    """Update proposition attributes (such as archiving or query updates)."""
    update_data = {}
    if payload.proposition_text is not None:
        update_data["proposition_text"] = payload.proposition_text
    if payload.search_queries is not None:
        update_data["search_queries"] = payload.search_queries
    if payload.is_archived is not None:
        update_data["is_archived"] = payload.is_archived
    if payload.next_run_date is not None:
        update_data["next_run_date"] = payload.next_run_date.strftime("%Y-%m-%d")

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid update fields provided",
        )

    try:
        response = (
            db.table("propositions")
            .update(update_data)
            .eq("proposition_id", proposition_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposition '{proposition_id}' not found",
            )
        p = response.data[0]
        return PropositionResponse(
            proposition_id=p["proposition_id"],
            proposition_text=p["proposition_text"],
            search_queries=p.get("search_queries"),
            next_run_date=p.get("next_run_date"),
            is_archived=p.get("is_archived", False),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}",
        )
