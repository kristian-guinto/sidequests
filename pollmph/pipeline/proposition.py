from datetime import date, datetime
from supabase import Client as SupabaseClient
from pydantic import BaseModel, Field
from typing import List, Optional


class PropositionModel(BaseModel):
    proposition_id: str = Field(..., description="The ID of the proposition")
    proposition_text: str = Field(..., description="The text of the proposition")
    search_queries: List[str] = Field(
        default=[], description="The search queries to use for gathering information"
    )
    next_run_date: Optional[date] = Field(
        default=None, description="Date when this proposition should next be processed"
    )


def read_propositions(
    supabase_client: SupabaseClient,
    include_archived: bool = False,
    respect_schedule: bool = False,
):
    try:
        query = supabase_client.table("propositions").select(
            "proposition_id, proposition_text, search_queries, next_run_date"
        )
        if not include_archived:
            query = query.eq("is_archived", False)

        if respect_schedule:
            today_str = datetime.now().strftime("%Y-%m-%d")
            query = query.or_(f"next_run_date.is.null,next_run_date.lte.{today_str}")
            query = query.order("next_run_date", desc=False, nullsfirst=True)

        response = query.execute()

        if response.data:
            propositions = [
                PropositionModel(
                    proposition_id=p["proposition_id"],
                    proposition_text=p["proposition_text"],
                    search_queries=p.get("search_queries", []),
                    next_run_date=p.get("next_run_date"),
                )
                for p in response.data
            ]
            print(f"Loaded {len(propositions)} propositions from Supabase.")
            return propositions

    except Exception as e:
        print(f"Error fetching propositions: {e}")
        return []

    print("No propositions found in Supabase.")
    return []


def create_proposition(supabase_client: SupabaseClient, proposition: PropositionModel):
    try:
        response = (
            supabase_client.table("propositions")
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


def update_next_run_date(
    supabase_client: SupabaseClient, proposition_id: str, next_run_date: date
):
    try:
        supabase_client.table("propositions").update(
            {"next_run_date": next_run_date.isoformat()}
        ).eq("proposition_id", proposition_id).execute()
    except Exception as e:
        print(f"  Warning: Failed to update next_run_date for {proposition_id}: {e}")
