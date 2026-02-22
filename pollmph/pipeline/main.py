import os
import re
import json
from pathlib import Path
from dotenv import load_dotenv
from typing import List

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search, x_search

from pydantic import BaseModel, Field
from datetime import datetime, timedelta

# demo change
from models import (
    AgentResponseModel,
    PropositionModel,
    PromptParameters,
    SentimentModel,
)

load_dotenv()


def setup_supabase():
    import supabase as sb

    url: str | None = os.environ.get("SUPABASE_URL")
    key: str | None = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError(
            "Supabase URL and Key must be set in environment variables SUPABASE_URL and SUPABASE_KEY"
        )

    supabase: sb.Client = sb.create_client(url, key)

    return supabase


# Load propositions from `propositions.json` next to this file. If the file
# does not exist or is malformed, write a default file and load that.
prop_file = Path(__file__).parent / "propositions.json"

default_props = [
    {
        "proposition_id": "marcos_robredo_2028",
        "proposition_text": "Bongbong Marcos and Leni Robredo will team up for the 2028 Philippine Presidential Election",
        "search_queries": [
            "BBM Leni Robredo",
            "Marcos endorsement Kakampink",
            "UniTeam split Robredo",
        ],
    },
    {
        "proposition_id": "sarah_duterte_wins_2028",
        "proposition_text": "Sara Duterte will win the 2028 Philippine Presidential Election",
        "search_queries": [
            "Sara Duterte 2028",
            "Sara Duterte presidential bid",
            "Sara Duterte election plans",
        ],
    },
]

try:
    with prop_file.open("r", encoding="utf-8") as f:
        raw_props = json.load(f)
    PROPOSITIONS = []
    for p in raw_props:
        pid = p.get("proposition_id")
        p_text = p.get("proposition_text")
        searches = p.get("search_queries") or []
        if not (pid and p_text):
            print(f"Skipping malformed proposition entry: {p}")
            continue
        PROPOSITIONS.append(
            PropositionModel(
                proposition_id=pid, proposition_text=p_text, search_queries=searches
            )
        )
except Exception as e:
    print(f"Failed to load propositions.json ({e}), falling back to defaults")
    PROPOSITIONS = [PropositionModel(**p) for p in default_props]

# Load system prompt from `system_prompt.txt` next to this file.
prompt_file = Path(__file__).parent / "system_prompt.txt"
default_prompt = """You are a quantitative sentiment engine and expert political analyst specializing in Philippine socio-political discourse. Your task is to evaluate real-time public sentiment across social media (especially Twitter/X) and news platforms regarding a specific declarative proposition.

You must act as a "Predictive Market Oracle," scoring the proposition on two strictly defined metrics: Consensus (Agreement) and Attention (Volume).

### INPUT DATA
Proposition to Evaluate: "{proposition}"
Recommended Search Queries: {search_queries_list}, if empty use default queries based on the proposition text.
Yesterday's Consensus Score: {yesterday_consensus}, if empty default to 0.50 (perfect polarization or apathy)
Yesterday's Attention Score: {yesterday_attention}, if empty default to 0.10 (low chatter)

### INSTRUCTIONS
STEP 1: Execute real-time web and social searches using the Recommended Search Queries to gather today's discourse. Look for a balance of administration, opposition, and general public reactions.
STEP 2: Analyze the sentiment and volume of the data retrieved.
STEP 3: Compare today's data against Yesterday's Scores to determine if sentiment or attention has increased, decreased, or remained stagnant. Do not make drastic jumps in scores unless justified by a major real-world event.
STEP 4: Output your final evaluation strictly in the JSON format provided below. Do not include any conversational text outside the JSON.

### SCORING RUBRIC

METRIC 1: CONSENSUS (0.00 to 1.00)
Does the public agree with the Proposition?
* 0.00: Unanimous, aggressive rejection or mocking of the proposition.
* 0.25: Strong opposition. Only a tiny, heavily criticized minority defends it.
* 0.50: Perfect polarization (a 50/50 war), completely neutral reporting, or apathy.
* 0.75: Broad support. Generally accepted as true/good, with only a vocal minority opposing.
* 1.00: Unanimous, enthusiastic agreement.
(Note: If Attention is below 0.10, default Consensus to match Yesterday's Consensus).

METRIC 2: ATTENTION (0.00 to 1.00)
How loudly is the public talking about this today?
* 0.00: Utter silence. No one is talking about this natively.
* 0.25: Low chatter. Mentioned by a few hyper-partisan accounts or niche circles.
* 0.50: Moderate discussion. A recognized talking point today, but not dominating.
* 0.75: High virality. Trending widely across platforms and covered by mainstream news.
* 1.00: National dominance. It is the absolute center of the cultural/political timeline today.

### JSON OUTPUT SCHEMA
{{
  "consensus_value": <float between 0.00 and 1.00>,
  "attention_value": <float between 0.00 and 1.00>,
  "movement_analysis": "<1-sentence explanation of why the score moved (or didn't move) compared to yesterday>",
  "rationale_consensus": "<1-2 sentences justifying the consensus score based on specific narratives observed today>",
  "rationale_attention": "<1-sentence justifying the attention volume>",
  "data_quality": "<'High', 'Medium', or 'Low' based on the amount of search results you were able to retrieve>"
}}"""

try:
    with prompt_file.open("r", encoding="utf-8") as f:
        SYSTEM_PROMPT = f.read()
except Exception as e:
    print(f"Failed to load system_prompt.txt ({e}), using default")
    SYSTEM_PROMPT = default_prompt

client = Client(
    api_key=os.getenv("XAI_API_KEY"),
    timeout=3600,
)

date_yesterday = datetime.now() - timedelta(days=1)
date_today = datetime.now()

chat = client.chat.create(
    model="grok-4-1-fast-reasoning",
    tools=[web_search(), x_search(from_date=date_yesterday, to_date=date_today)],
    include=["verbose_streaming"],
    response_format=AgentResponseModel,
)

outputs = []
for proposition in PROPOSITIONS:
    query = SYSTEM_PROMPT.format(
        **PromptParameters(
            proposition=proposition.proposition_text,
            search_queries_list=proposition.search_queries,
            yesterday_consensus=0.50,
            yesterday_attention=0.10,
        ).model_dump()
    )
    chat.append(user(query))
    is_thinking = True

    for response, chunk in chat.stream():
        for tool_call in chunk.tool_calls:
            print(
                f"\nCalling tool: {tool_call.function.name} with arguments: {tool_call.function.arguments}"
            )
        if response.usage.reasoning_tokens and is_thinking:
            print(
                f"\rThinking... ({response.usage.reasoning_tokens} tokens)",
                end="",
                flush=True,
            )
        if chunk.content and is_thinking:
            print("\n\nFinal Response:")
            is_thinking = False
        if chunk.content and not is_thinking:
            print(chunk.content, end="", flush=True)

    agent_response = AgentResponseModel.model_validate_json(response.content)
    sentiment = SentimentModel(
        proposition_id=proposition.proposition_id,
        **agent_response.model_dump(),
        date_generated=date_today.strftime("%Y-%m-%d"),
    ).model_dump()

    print("\n\nStructured Output:")
    print(json.dumps(sentiment, indent=2))
    outputs.append(sentiment)

print(type(outputs), len(outputs), type(outputs[0]))

supabase_client = setup_supabase()
try:
    response = supabase_client.table("sentiments").insert(outputs).execute()
except Exception as e:
    print(f"Failed to insert sentiments: {e}")
