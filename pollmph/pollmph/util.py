import os
from dotenv import load_dotenv

load_dotenv()


def get_supabase_client():
    import supabase as sb

    is_prod = os.getenv("ENVIRONMENT", "DEV").upper() == "PROD"

    if is_prod:
        SB_URL = os.getenv("SUPABASE_URL_PROD", None)
        SB_KEY = os.getenv("SUPABASE_SERVICE_KEY_PROD", None)
    else:
        SB_URL = os.getenv("SUPABASE_URL", None)
        SB_KEY = os.getenv("SUPABASE_KEY", None)

    if not SB_URL or not SB_KEY:
        raise ValueError(
            "Supabase URL and Key must be set in environment variables SUPABASE_URL and SUPABASE_KEY"
        )

    return sb.create_client(SB_URL, SB_KEY)


def get_xai_client():
    from xai_sdk import Client as XAIClient

    xai_api_key = os.getenv("XAI_API_KEY")
    if not xai_api_key:
        raise ValueError("XAI API Key must be set in environment variable XAI_API_KEY")

    return XAIClient(api_key=xai_api_key)


def get_xai_adapter(model: str):
    from pollmph.adapters.xai import XAIAdapter

    return XAIAdapter(client=get_xai_client(), model=model)


def get_gemini_client():
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY must be set in environment variables")

    return genai.Client(api_key=api_key)


def get_gemini_adapter(model: str):
    from pollmph.adapters.gemini import GeminiAdapter

    return GeminiAdapter(client=get_gemini_client(), model=model)


def get_mock_adapter(
    consensus: float = 0.65,
    attention: float = 0.45,
    movement_analysis: str = "Mock movement analysis",
    rationale_consensus: str = "Mock consensus rationale",
    rationale_attention: str = "Mock attention rationale",
    data_quality: float = 0.85,
):
    from pollmph.adapters.mock import MockAdapter
    from pollmph.models import SentimentResponse

    response_json = SentimentResponse(
        consensus_value=consensus,
        attention_value=attention,
        movement_analysis=movement_analysis,
        rationale_consensus=rationale_consensus,
        rationale_attention=rationale_attention,
        data_quality=data_quality,
    ).model_dump_json()

    return MockAdapter(response_json=response_json)


def get_mock_evaluate_adapter(
    attention: float = 0.65,
    is_worth_tracking: bool = True,
    rationale_attention: str = "Mock attention rationale",
    search_queries_used: list[str] | None = None,
    suggested_proposition_text: str = "Mock suggested proposition text",
):
    from pollmph.adapters.mock import MockAdapter
    from pollmph.models import AttentionEvaluationResponse

    response_json = AttentionEvaluationResponse(
        attention_value=attention,
        is_worth_tracking=is_worth_tracking,
        rationale_attention=rationale_attention,
        search_queries_used=search_queries_used or ["mock query 1", "mock query 2"],
        suggested_proposition_text=suggested_proposition_text,
    ).model_dump_json()

    return MockAdapter(response_json=response_json)
