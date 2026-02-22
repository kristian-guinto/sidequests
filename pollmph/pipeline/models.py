from datetime import datetime

from pydantic import BaseModel, Field
from typing import List


class ReasoningTraceModel(BaseModel):
    step: int = Field(..., description="The step number in the reasoning process")
    thought: str = Field(..., description="The thought process at this step")
    tool_calls: list[str] = Field(
        ..., description="What tools were called at this step and with what arguments?"
    )


class AgentResponseModel(BaseModel):
    consensus_value: float = Field(
        ..., description="Do people agree? 0 means no agreement, 1 means full agreement"
    )
    attention_value: float = Field(
        ..., description="Do people care? 0 means no attention, 1 means full attention"
    )
    movement_analysis: str = Field(
        ..., description="Why did the scores move (or not move) compared to yesterday?"
    )
    rationale_consensus: str = Field(
        ..., description="What is the rationale for the consensus value?"
    )
    rationale_attention: str = Field(
        ..., description="What is the rationale for the attention value?"
    )
    data_quality: float = Field(
        ...,
        description="How good is the data? 0 means very bad data, 1 means very good data",
    )
    # reasoning_trace: list[ReasoningTraceModel] = Field(
    #     ...,
    #     description="What was the step by step reasoning process to arrive at this conclusion?",
    # )
    # citations: list[str] = Field(
    #     ..., description="What are the sources for this information?"
    # )


class SentimentModel(AgentResponseModel):
    proposition_id: str = Field(
        ..., description="The ID of the proposition being evaluated"
    )
    date_generated: str = Field(
        ..., description="The date of the evaluation in ISO8601 format"
    )


class PropositionModel(BaseModel):
    proposition_id: str = Field(..., description="The ID of the proposition")
    proposition_text: str = Field(..., description="The text of the proposition")
    search_queries: List[str] = Field(
        default=[], description="The search queries to use for gathering information"
    )


class PromptParameters(BaseModel):
    proposition: str
    search_queries_list: List[str]
    yesterday_consensus: float
    yesterday_attention: float
