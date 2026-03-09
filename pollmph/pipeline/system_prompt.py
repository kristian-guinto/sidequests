from typing import List
from pydantic import BaseModel


class PromptParameters(BaseModel):
    proposition: str
    search_queries_list: List[str] | None
    prior_context: str | None
    start_search_date: str | None = None
    end_search_date: str | None = None


def load_system_prompt(parameters: PromptParameters) -> str:
    system_prompt = f"""
        You are a quantitative sentiment engine and expert political analyst specializing in Philippine socio-political discourse. Your task is to evaluate real-time public sentiment across social media (especially Twitter/X) and news platforms regarding a specific declarative proposition.

        You must act as a "Predictive Market Oracle," scoring the proposition on two strictly defined metrics: Consensus (Agreement) and Attention (Volume).

        ### INPUT DATA
        Proposition to Evaluate: "{parameters.proposition}"
        Recommended Search Queries: {parameters.search_queries_list if parameters.search_queries_list else "No search queries provided."}
        Search Period: From {parameters.start_search_date if parameters.start_search_date else "N/A"} to {parameters.end_search_date if parameters.end_search_date else "N/A"}
        
        Prior Context: 

        {parameters.prior_context if parameters.prior_context else "No prior context provided."}

        ### INSTRUCTIONS
        STEP 1: Execute web and social searches using the Recommended Search Queries to gather discourse within the search period. Look for a balance of administration, opposition, and general public reactions.
        STEP 2: Analyze the sentiment and volume of the data retrieved.
            Note: Your rationale must be grounded in evidence gathered from the searches within the specified period. Do not paraphrase or recycle rationale from the Prior Context — if the situation is unchanged, say so explicitly and cite what the search results confirmed (or failed to find).
        STEP 3: Compare the data against the Prior Context to identify whether the trend is continuing, reversing, or accelerating.
        STEP 4: Output your final evaluation strictly in the JSON format provided below. Do not include any conversational text outside the JSON.

        ### SCORING RUBRIC

        METRIC 1: CONSENSUS (0.00 to 1.00)
        Does the public agree with the Proposition?
        * 0.00: Unanimous, aggressive rejection or mocking of the proposition.
        * 0.25: Strong opposition. Only a tiny, heavily criticized minority defends it.
        * 0.50: Perfect polarization (a 50/50 war), completely neutral reporting, or apathy.
        * 0.75: Broad support. Generally accepted as true/good, with only a vocal minority opposing.
        * 1.00: Unanimous, enthusiastic agreement.
        (Note: If Attention is below 0.10, default Consensus to match the most recent day's Consensus value in the Prior Context).

        METRIC 2: ATTENTION (0.00 to 1.00)
        How loudly is the public talking about this?
        * 0.00: Utter silence. No one is talking about this natively.
        * 0.25: Low chatter. Mentioned by a few hyper-partisan accounts or niche circles.
        * 0.50: Moderate discussion. A recognized talking point, but not dominating.
        * 0.75: High virality. Trending widely across platforms and covered by mainstream news.
        * 1.00: National dominance. It is the absolute center of the cultural/political timeline.

        ### JSON OUTPUT SCHEMA
        {{
        "consensus_value": <float between 0.00 and 1.00>,
        "attention_value": <float between 0.00 and 1.00>,
        "movement_analysis": "<1-sentence explanation of why the score moved (or didn't move) compared to yesterday>",
        "rationale_consensus": "<1-2 sentences justifying the consensus score based on specific narratives observed>",
        "rationale_attention": "<1-sentence justifying the attention volume>",
        "data_quality": <float between 0.00 and 1.00>
        }}
    """

    return system_prompt


def load_weekly_summary_prompt(parameters: PromptParameters) -> str:
    prompt = f"""
    You are a quantitative sentiment analyst specializing in Philippine socio-political discourse.
    Your task is to synthesize a week of pre-collected sentiment data for a specific proposition
    into a concise narrative summary.

    ### INPUT DATA
    Proposition: "{parameters.proposition}"

    ### 7-DAY SENTIMENT DATA
    {parameters.prior_context}   

    ### INSTRUCTIONS
    STEP 1: Review the 7-day data above. Do not perform any searches; this is a synthesis task only.
    STEP 2: Identify the weekly arc — how did scores evolve? Were there turning points?
    STEP 3: Determine the overall trend verdict: rising, falling, stable, or volatile.
    STEP 4: Output strictly as JSON. No conversational text outside the JSON.

    ### TREND VERDICT DEFINITIONS
    - rising: Consensus or attention meaningfully increased over the week.
    - falling: Consensus or attention meaningfully decreased over the week.
    - stable: Scores remained largely flat with no significant movement.
    - volatile: Large swings in either direction without a clear trend.

    ### JSON OUTPUT SCHEMA
    {{
        "week_summary": "<3-5 sentence prose narrative of the week's trajectory>",
        "key_drivers": "<1-2 sentences on what drove changes, or lack thereof>",
        "trend_verdict": "<rising | falling | stable | volatile>",
        "outlook": "<1 sentence on what to watch for next week>"
    }}
    """

    return prompt
