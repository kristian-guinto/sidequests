"""Data Transfer Objects and Schemas for pollmph API

Aligned with OpenElectricity API schemas pattern.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# --- System & Health Schemas ---


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Proposition Schemas ---


class PropositionBase(BaseModel):
    proposition_id: str = Field(..., description="Unique slug for the proposition")
    proposition_text: str = Field(
        ..., description="The declarative claim being tracked"
    )
    search_queries: Optional[List[str]] = Field(
        default=None, description="Keywords and entities used for web retrieval"
    )


class PropositionCreate(PropositionBase):
    backfill_days: Optional[int] = Field(
        default=None,
        description="Optional days of historical sentiment to backfill upon creation",
    )


class PropositionUpdate(BaseModel):
    proposition_text: Optional[str] = None
    search_queries: Optional[List[str]] = None
    is_archived: Optional[bool] = None
    next_run_date: Optional[date] = None


class PropositionResponse(PropositionBase):
    id: Optional[int] = None
    next_run_date: Optional[date] = None
    is_archived: bool = False


# --- Sentiment Schemas ---


class SentimentRecord(BaseModel):
    id: Optional[int] = None
    proposition_id: str
    date_generated: str
    consensus_value: float = Field(ge=0.0, le=1.0)
    attention_value: float = Field(ge=0.0, le=1.0)
    movement_analysis: Optional[str] = None
    rationale_consensus: str
    rationale_attention: str
    data_quality: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class MovingAveragePoint(BaseModel):
    date_generated: str
    short_date: str
    consensus_value: float
    attention_value: float
    ma_consensus: float
    ma_attention: float


class PropositionDashboardCard(BaseModel):
    id: str
    proposition_text: str
    is_archived: bool = False
    latest_consensus: Optional[float] = None
    latest_attention: Optional[float] = None
    delta_consensus: Optional[float] = None
    tracking_since: Optional[str] = None
    latest_date: Optional[str] = None
    evaluations: List[MovingAveragePoint] = Field(default_factory=list)


class SentimentHistoryResponse(BaseModel):
    proposition_id: str
    count: int
    items: List[SentimentRecord]
    moving_averages: List[MovingAveragePoint]


# --- Summary Schemas ---


class WeeklySummaryRecord(BaseModel):
    id: Optional[int] = None
    proposition_id: str
    week_start: date
    week_end: date
    summary: str
    key_drivers: str
    trend_verdict: Literal["rising", "falling", "stable", "volatile"]
    outlook: str
    created_at: Optional[datetime] = None


# --- Virtual Polling Schemas (Next-Gen Architecture) ---


class DemographicBreakdown(BaseModel):
    dimension: str = Field(
        ..., description="e.g. 'region', 'socioeconomic_class', 'age_bracket'"
    )
    segment: str = Field(..., description="e.g. 'NCR', 'Mindanao', 'Class D', '18-24'")
    support_percentage: float = Field(ge=0.0, le=100.0)
    attention_score: float = Field(ge=0.0, le=1.0)
    sample_weight: float = Field(
        ..., description="Normalized demographic weight from Census data"
    )


class VirtualPollSurveyResponse(BaseModel):
    poll_id: str
    topic_id: str
    poll_date: date
    simulated_respondents: int = Field(default=1200, description="Synthetic panel size")
    margin_of_error: float = Field(
        default=2.8, description="Simulated statistical MOE in percentage points"
    )
    consensus_score: float = Field(ge=0.0, le=1.0)
    attention_score: float = Field(ge=0.0, le=1.0)
    net_agreement: float = Field(description="Net agreement score: (+Agree - Disagree)")
    demographic_breakdowns: List[DemographicBreakdown] = Field(default_factory=list)
    methodology_note: str = (
        "Simulated demographic panel stratified by PSA census distribution "
        "(NCR 13%, Balance Luzon 45%, Visayas 19%, Mindanao 23%; Class ABC/D/E) "
        "conditioned on verified news and social discourse streams."
    )


# --- Task & Operational Schemas ---


class TaskTriggerRequest(BaseModel):
    limit: int = 5
    llm: Literal["gemini", "grok", "mock", "local"] = "gemini"
    no_db: bool = False
    verbose: bool = False


class BackfillTriggerRequest(BaseModel):
    ids: Optional[List[str]] = None
    days_back: int = 7
    llm: Literal["gemini", "grok", "mock", "local"] = "gemini"
    no_db: bool = False
    verbose: bool = False


class EvaluateTriggerRequest(BaseModel):
    text: str
    id: Optional[str] = None
    llm: Literal["gemini", "grok", "mock", "local"] = "gemini"


class TaskExecutionResult(BaseModel):
    task: str
    status: Literal["queued", "completed", "failed"]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: str
    details: Optional[Dict[str, Any]] = None
