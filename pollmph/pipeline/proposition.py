try:
    from util import get_supabase_client
except ImportError:
    from pipeline.util import get_supabase_client

from supabase import Client as SupabaseClient
from pydantic import BaseModel, Field
from typing import List


class PropositionModel(BaseModel):
    proposition_id: str = Field(..., description="The ID of the proposition")
    proposition_text: str = Field(..., description="The text of the proposition")
    search_queries: List[str] = Field(
        default=[], description="The search queries to use for gathering information"
    )


def read_propositions(supabase_client: SupabaseClient, include_archived: bool = False):
    try:
        query = supabase_client.table("propositions").select(
            "proposition_id, proposition_text, search_queries"
        )
        if not include_archived:
            query = query.eq("is_archived", False)
        response = query.execute()

        if response.data:
            propositions = [
                PropositionModel(
                    proposition_id=p["proposition_id"],
                    proposition_text=p["proposition_text"],
                    search_queries=p.get("search_queries", []),
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
