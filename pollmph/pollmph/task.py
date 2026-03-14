"""A collection of LLM tasks

The task module defines tasks to be performed by LLMs in the pollmph system.
Each task is contained in a class with a `run()` method that executes the task.
A task is initialised with an LLMAdapter, which abstracts away the specific LLM API being used.
This allows for flexibility in swapping out LLM providers without changing the task logic.
"""

from datetime import datetime, timedelta
from typing import TypeVar, overload
from supabase import Client as SupabaseClient

from pydantic import BaseModel

from pollmph.llm import (
    LLMAdapter,
    StreamingCompletion,
    WebSearchTool,
    XSearchTool,
    ChatResponse,
)
from pollmph.models import (
    SentimentResponse,
    PropositionModel,
    ContextSummaryResponse,
    AttentionEvaluationResponse,
)
from pollmph.db import get_prior_context

TResponseModel = TypeVar("TResponseModel", bound=BaseModel)


@overload
def stream_chat(
    completion: StreamingCompletion,
    response_model: type[TResponseModel],
    verbose: bool = False,
) -> tuple[ChatResponse | None, TResponseModel | None]: ...


@overload
def stream_chat(
    completion: StreamingCompletion,
    response_model: None = None,
    verbose: bool = False,
) -> tuple[ChatResponse | None, None]: ...


def stream_chat(
    completion: StreamingCompletion,
    response_model: type[TResponseModel] | None = None,
    verbose: bool = False,
) -> tuple[ChatResponse | None, TResponseModel | None]:
    is_thinking = True
    for chunk in completion:
        if verbose:
            for tool_call in chunk.tool_calls:
                print(
                    f"\nCalling tool: {tool_call.name} with arguments: {tool_call.arguments}"
                )
            if chunk.reasoning_tokens and is_thinking:
                print(
                    f"\rThinking... ({chunk.reasoning_tokens} tokens)",
                    end="",
                    flush=True,
                )
            if chunk.content and is_thinking:
                print("\n\nFinal Response:")
                is_thinking = False
            if chunk.content and not is_thinking:
                print(chunk.content, end="", flush=True)

    response = completion.response
    output = (
        response_model.model_validate_json(response.content)
        if response_model and response
        else None
    )

    return response, output


class SentimentTask:
    def __init__(
        self,
        adapter: LLMAdapter,
        sb_client: SupabaseClient,
        verbose: bool = False,
        prior_context_days: int = 7,
    ):
        self.adapter = adapter
        self.sb_client = sb_client
        self.verbose = verbose
        self.response_model: type[SentimentResponse] = SentimentResponse
        self.prior_context_days = prior_context_days

    def run(
        self,
        proposition: PropositionModel,
        search_start: datetime,
        search_end: datetime,
    ) -> tuple[ChatResponse | None, SentimentResponse | None]:
        system_prompt = """
            You are a quantitative sentiment engine and expert political analyst specializing in
            Philippine socio-political discourse. Your task is to evaluate real-time public sentiment
            across social media (especially Twitter/X) and news platforms regarding a specific declarative
            proposition.

            You must act as a "Predictive Market Oracle," scoring the proposition on two strictly defined
            metrics: Consensus (Agreement) and Attention (Volume).

            ### INSTRUCTIONS
            STEP 1: Execute web and social searches using the Recommended Search Queries to gather discourse
            within the search period. Look for a balance of administration, opposition, and general public
            reactions.
            STEP 2: Analyze the sentiment and volume of the data retrieved. Your rationale must be grounded in evidence
               gathered from the searches within the specified period. Do not paraphrase or recycle rationale from the Prior Context —
               if the situation is unchanged, say so explicitly and cite what the search results confirmed (or failed to find).
            STEP 3: Compare the data against the Prior Context to identify whether the trend is continuing,
                reversing, or accelerating.
            STEP 4: Output your final evaluation strictly in the JSON format provided below. Do not include
                any conversational text outside the JSON.

            ### SCORING RUBRIC

            METRIC 1: CONSENSUS (0.00 to 1.00)
            Does the public agree with the Proposition?
            * 0.00: Unanimous, aggressive rejection or mocking of the proposition.
            * 0.25: Strong opposition. Only a tiny, heavily criticized minority defends it.
            * 0.50: Perfect polarization (a 50/50 war), completely neutral reporting, or apathy.
            * 0.75: Broad support. Generally accepted as true/good, with only a vocal minority opposing.
            * 1.00: Unanimous, enthusiastic agreement.
            (Note: If Attention is below 0.10, default Consensus to match the most recent day's Consensus value in
               the Prior Context).

            METRIC 2: ATTENTION (0.00 to 1.00)
            How loudly is the public talking about this?
            * 0.00: Utter silence. No one is talking about this natively.
            * 0.25: Low chatter. Mentioned by a few hyper-partisan accounts or niche circles.
            * 0.50: Moderate discussion. A recognized talking point, but not dominating.
            * 0.75: High virality. Trending widely across platforms and covered by mainstream news.
            * 1.00: National dominance. It is the absolute center of the cultural/political timeline.
        """

        context_start = search_start - timedelta(days=self.prior_context_days)
        prior_context = get_prior_context(
            self.sb_client, proposition.proposition_id, context_start, search_end
        )

        query = f"""
        ### INPUT DATA

        Proposition to Evaluate: "{proposition.proposition_text}"
        Recommended Search Queries: {proposition.search_queries if proposition.search_queries else "No search queries provided."}
        Search Period: From {search_start} to {search_end}
        Context Window: Last {self.prior_context_days} days

        Prior Context:

        {prior_context if prior_context else "No prior context provided."}
        """

        completion = self.adapter.stream(
            system_prompt=system_prompt,
            user_message=query,
            tools=[
                WebSearchTool(),
                XSearchTool(from_date=search_start, to_date=search_end),
            ],
            response_model=self.response_model,
        )

        return stream_chat(completion, self.response_model, self.verbose)


class ContextSummaryTask:
    def __init__(
        self, adapter: LLMAdapter, sb_client: SupabaseClient, verbose: bool = False
    ):
        self.adapter = adapter
        self.sb_client = sb_client
        self.verbose = verbose
        self.response_model: type[ContextSummaryResponse] = ContextSummaryResponse

    def run(
        self,
        proposition: PropositionModel,
        context_start: datetime,
        context_end: datetime,
    ) -> tuple[ChatResponse | None, ContextSummaryResponse | None]:
        prior_context = get_prior_context(
            self.sb_client, proposition.proposition_id, context_start, context_end
        )

        if not prior_context:
            return None, None

        system_prompt = """
            You are a quantitative sentiment analyst specializing in Philippine socio-political discourse.
            Your task is to synthesize a week of pre-collected sentiment data for a specific proposition
            into a concise narrative summary.

            ### INSTRUCTIONS
            STEP 1: Review the data above. Do not perform any searches; this is a synthesis task only.
            STEP 2: Identify the narrative arc — how did scores evolve? Were there turning points?
            STEP 3: Determine the overall trend verdict: rising, falling, stable, or volatile.
            STEP 4: Output strictly as JSON. No conversational text outside the JSON.

            ### TREND VERDICT DEFINITIONS
            - rising: Consensus or attention meaningfully increased over the week.
            - falling: Consensus or attention meaningfully decreased over the week.
            - stable: Scores remained largely flat with no significant movement.
            - volatile: Large swings in either direction without a clear trend.
        """

        query = f"""
            ### INPUT DATA
            Proposition: "{proposition.proposition_text}"

            ### SENTIMENT DATA
            {prior_context}
        """

        completion = self.adapter.stream(
            system_prompt=system_prompt,
            user_message=query,
            response_model=self.response_model,
        )

        return stream_chat(completion, self.response_model, self.verbose)


class EvaluatePropositionTask:
    def __init__(self, adapter: LLMAdapter, verbose: bool = False):
        self.adapter = adapter
        self.verbose = verbose
        self.response_model: type[AttentionEvaluationResponse] = (
            AttentionEvaluationResponse
        )

    def run(
        self, proposition_text: str
    ) -> tuple[ChatResponse | None, AttentionEvaluationResponse | None]:
        search_end = datetime.now()
        search_start = search_end - timedelta(days=30)

        system_prompt = """
            You are an expert political analyst specializing in Philippine socio-political discourse.
            A user wants to start tracking public sentiment on a new declarative proposition.
            Before adding it to the database, evaluate if there is enough public attention to warrant tracking.
        """

        user_message = f"""
            Proposition: "{proposition_text}"

            INSTRUCTIONS:
            STEP 1: Analyze the proposition and formulate concise search queries to find recent discourse
            on Twitter/X and news platforms. Avoid full sentences; use short, effective terms. Include
            local spelling, abbreviations, or social media shorthand. Do NOT include dates in the queries.
            STEP 2: Evaluate the proposition text. Rephrase it to be more neutral, clear, and unambiguous
            for LLM evaluation if needed. If the original is fine, return it exactly.
            STEP 3: Execute searches using x_search and web_search tools for discourse in the last 30 days.
            STEP 4: Score the attention level:
            * 0.00: Utter silence. No one is talking about this.
            * 0.25: Low chatter. Mentioned by a few hyper-partisan accounts or niche circles.
            * 0.50: Moderate discussion. A recognized talking point, but not dominating.
            * 0.75: High virality. Trending widely across platforms and covered by mainstream news.
            * 1.00: National dominance. The absolute center of the cultural/political timeline.
            STEP 5: Output whether the proposition has enough traction to track (attention >= 0.25).
            Include the exact search queries you used.
        """

        completion = self.adapter.stream(
            system_prompt=system_prompt,
            user_message=user_message,
            tools=[
                WebSearchTool(),
                XSearchTool(from_date=search_start, to_date=search_end),
            ],
            response_model=self.response_model,
        )

        return stream_chat(completion, self.response_model, self.verbose)
