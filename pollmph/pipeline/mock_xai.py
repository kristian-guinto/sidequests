"""
Mock xAI client for testing purposes.
Mimics the xai_sdk.Client API with fixed responses.
"""

from typing import Iterator, Tuple, Any


class MockToolCall:
    """Mock tool call object"""

    def __init__(self, name: str):
        self.function = type("Function", (), {"name": name})()


class MockUsage:
    """Mock usage object"""

    def __init__(self, reasoning_tokens: int = 0):
        self.reasoning_tokens = reasoning_tokens


class MockChunk:
    """Mock chunk from streaming response"""

    def __init__(self, content: str = "", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []


class MockResponse:
    """Mock response object"""

    def __init__(self, usage=None):
        self.usage = usage


class MockChat:
    """
    Mock chat object that simulates the xai_sdk chat interface.
    Returns fixed responses for testing.
    """

    def __init__(self, response_json: str):
        """
        Args:
            response_json: The JSON string to return as the response
        """
        self.response_json = response_json
        self.messages = []

    def append(self, message):
        """Append a message to the chat (no-op in mock)"""
        self.messages.append(message)

    def stream(self) -> Iterator[Tuple[MockResponse, MockChunk]]:
        """
        Simulate streaming response with tool calls and content.
        Yields (response, chunk) tuples.
        """
        # Simulate thinking phase
        for i in range(3):
            yield (
                MockResponse(usage=MockUsage(reasoning_tokens=100 * (i + 1))),
                MockChunk(),
            )

        # Simulate tool call
        yield (
            MockResponse(),
            MockChunk(tool_calls=[MockToolCall("web_search")]),
        )

        # Simulate content streaming
        # Split the response into chunks to simulate streaming
        chunk_size = 50
        for i in range(0, len(self.response_json), chunk_size):
            chunk_text = self.response_json[i : i + chunk_size]
            yield (MockResponse(), MockChunk(content=chunk_text))


class MockChatManager:
    """Mock chat manager that creates MockChat instances"""

    def __init__(self, response_json: str):
        self.response_json = response_json

    def create(
        self, model: str, tools: list = None, include: list = None, response_format=None
    ) -> MockChat:
        """
        Create a mock chat instance with fixed response.

        Args:
            model: Model name (ignored in mock)
            tools: Tools to use (ignored in mock)
            include: Additional includes (ignored in mock)
            response_format: Expected response format (ignored in mock)

        Returns:
            MockChat instance
        """
        return MockChat(self.response_json)


class MockXAIClient:
    """
    Mock xAI Client that mimics the xai_sdk.Client interface.
    Returns fixed responses for predictable testing.
    """

    def __init__(
        self,
        api_key: str = "mock_api_key",
        response_json: str = None,
    ):
        """
        Args:
            api_key: API key (not used in mock)
            response_json: Fixed JSON response to return for all queries.
                          If None, uses a default response.
        """
        if response_json is None:
            # Default fixed response matching AgentResponseModel
            response_json = """{
                "consensus_value": 0.65,
                "attention_value": 0.45,
                "movement_analysis": "Consensus increased by 0.15 due to positive test data. Attention decreased by 0.05 due to reduced media coverage.",
                "rationale_consensus": "Test data shows strong agreement among participants.",
                "rationale_attention": "Media coverage has decreased slightly compared to yesterday.",
                "data_quality": 0.85
            }"""

        self.response_json = response_json
        self.chat = MockChatManager(self.response_json)


def create_mock_xai_client(
    consensus: float = 0.65,
    attention: float = 0.45,
    movement_analysis: str = "Mock movement analysis",
    rationale_consensus: str = "Mock consensus rationale",
    rationale_attention: str = "Mock attention rationale",
    data_quality: float = 0.85,
) -> MockXAIClient:
    """
    Factory function to create a MockXAIClient with custom response values.

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
    response_json = f"""{{
        "consensus_value": {consensus},
        "attention_value": {attention},
        "movement_analysis": "{movement_analysis}",
        "rationale_consensus": "{rationale_consensus}",
        "rationale_attention": "{rationale_attention}",
        "data_quality": {data_quality}
    }}"""

    return MockXAIClient(response_json=response_json)
