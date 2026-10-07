from typing import Iterator

from pydantic import BaseModel

from pollmph.llm import ChatResponse, StreamChunk, StreamingCompletion, Tool, ToolCall


class MockAdapter:
    """LLMAdapter that returns fixed responses without hitting any API."""

    def __init__(self, response_json: str, citations: list[str] = []):
        self.response_json = response_json
        self.citations = citations

    def stream(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[Tool] = [],
        response_model: type[BaseModel] | None = None,
    ) -> StreamingCompletion:
        completion = StreamingCompletion()
        response_json = self.response_json
        citations = self.citations

        def _generate() -> Iterator[StreamChunk]:
            for tokens in [100, 200, 300]:
                yield StreamChunk(reasoning_tokens=tokens)

            if tools:
                yield StreamChunk(
                    tool_calls=[ToolCall(name="web_search", arguments="{}")]
                )

            chunk_size = 50
            for i in range(0, len(response_json), chunk_size):
                yield StreamChunk(content=response_json[i : i + chunk_size])

            completion.response = ChatResponse(
                content=response_json, citations=citations
            )

        completion._iterator = _generate()
        return completion
