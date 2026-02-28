from pipeline.main import backfill, run_today, analyze_date
from pipeline.util import get_mock_xai_client
from datetime import datetime, timedelta
import pytest


def test_analyze_date_with_mock(monkeypatch):
    """Test analyze_date with mocked xAI API responses"""

    # Simply replace get_xai_client with get_mock_xai_client
    def mock_get_xai_client():
        return get_mock_xai_client(
            consensus=0.75,
            attention=0.55,
            movement_analysis="Test movement: increased due to mock data",
            rationale_consensus="Test consensus rationale",
            rationale_attention="Test attention rationale",
            data_quality=0.90,
        )

    monkeypatch.setattr("pipeline.main.get_xai_client", mock_get_xai_client)

    # Run analysis for a specific date
    target_date = datetime(2025, 2, 26)

    # Test with a specific proposition
    results = analyze_date(target_date)

    # Verify results
    assert results is not None, "Results should not be None"
    assert isinstance(results, list), "Results should be a list"

    # If we got results, verify the structure
    if len(results) > 0:
        result = results[0]
        assert "consensus_value" in result
        assert "attention_value" in result
        assert "movement_analysis" in result
        assert "data_quality" in result

        print(f"Test generated {len(results)} results")
        print(f"Sample result: {result}")


def test_analyze_date_filter_with_mock(monkeypatch):
    """Test analyze_date with proposition filter and mocked API"""
    # Use default mock values
    monkeypatch.setattr("pipeline.main.get_xai_client", get_mock_xai_client)

    target_date = datetime(2025, 2, 26)
    unavailable_proposition_id = "unavailable_proposition"

    # This should return empty results since the proposition doesn't exist
    results = analyze_date(target_date, proposition_ids=[unavailable_proposition_id])

    assert results is not None, "Results should not be None"
    assert isinstance(results, list), "Results should be a list"
    # Should be empty because proposition doesn't exist
    assert len(results) == 0, "Should have no results for non-existent proposition"


def test_mock_xai_client_directly():
    """Test the mock client directly to verify its behavior"""
    mock_client = get_mock_xai_client(
        consensus=0.80,
        attention=0.60,
    )

    # Create a chat
    chat = mock_client.chat.create(
        model="grok-test",
        tools=[],
        include=["verbose_streaming"],
        response_format=None,
    )

    # Append a message
    from xai_sdk.chat import user

    chat.append(user("Test message"))

    # Stream and collect content
    full_content = ""
    tool_calls_count = 0

    for response, chunk in chat.stream():
        if chunk.tool_calls:
            tool_calls_count += len(chunk.tool_calls)
        if chunk.content:
            full_content += chunk.content

    # Verify the response
    assert full_content != "", "Should have received content"
    assert "consensus_value" in full_content, "Response should contain consensus_value"
    assert "0.8" in full_content, (
        "Response should contain the specified consensus value"
    )
    assert tool_calls_count > 0, "Should have simulated tool calls"

    print(f"Mock returned: {full_content}")
    print(f"Tool calls: {tool_calls_count}")
