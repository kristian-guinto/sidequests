"""Response and data models for the application"""

from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import date


class PropositionModel(BaseModel):
    proposition_id: str
    proposition_text: str
    search_queries: List[str] | None = Field(default=None)
    next_run_date: date | None = Field(default=None)
    is_archived: bool = Field(default=False)


class SentimentResponse(BaseModel):
    consensus_value: float = Field(ge=0.0, le=1.0)
    attention_value: float = Field(ge=0.0, le=1.0)
    movement_analysis: str | None = None
    rationale_consensus: str
    rationale_attention: str
    data_quality: float = Field(ge=0.0, le=1.0)


class SentimentModel(SentimentResponse):
    proposition_id: str
    date_generated: str


class ContextSummaryResponse(BaseModel):
    summary: str
    key_drivers: str
    trend_verdict: Literal["rising", "falling", "stable", "volatile"]
    outlook: str


class WeeklySummaryModel(ContextSummaryResponse):
    proposition_id: str
    week_start: date
    week_end: date


class AttentionEvaluationResponse(BaseModel):
    search_queries_used: list[str]
    attention_value: float = Field(ge=0.0, le=1.0)
    rationale_attention: str
    is_worth_tracking: bool
    suggested_proposition_text: str
