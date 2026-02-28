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


def get_mock_xai_client(
    consensus: float = 0.65,
    attention: float = 0.45,
    movement_analysis: str = "Mock movement analysis",
    rationale_consensus: str = "Mock consensus rationale",
    rationale_attention: str = "Mock attention rationale",
    data_quality: float = 0.85,
):
    """
    Returns a mock xAI client for testing purposes.
    No API key required, returns fixed responses.

    Args:
        consensus: Consensus value (0-1)
        attention: Attention value (0-1)
        movement_analysis: Analysis of movement compared to yesterday
        rationale_consensus: Rationale for consensus value
        rationale_attention: Rationale for attention value
        data_quality: Data quality score (0-1)

    Returns:
        MockXAIClient with specified response values
    """
    try:
        from mock_xai import create_mock_xai_client
    except ImportError:
        from pipeline.mock_xai import create_mock_xai_client

    return create_mock_xai_client(
        consensus=consensus,
        attention=attention,
        movement_analysis=movement_analysis,
        rationale_consensus=rationale_consensus,
        rationale_attention=rationale_attention,
        data_quality=data_quality,
    )
