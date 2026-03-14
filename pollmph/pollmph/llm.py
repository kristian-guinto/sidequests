from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterator, Protocol

from pydantic import BaseModel


# --- Tool types (vendor-agnostic) ---


@dataclass
class WebSearchTool:
    pass


@dataclass
class XSearchTool:
    from_date: datetime
    to_date: datetime


Tool = WebSearchTool | XSearchTool


# --- Stream types ---


@dataclass
class ToolCall:
    name: str
    arguments: str


@dataclass
class StreamChunk:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    reasoning_tokens: int = 0


@dataclass
class ChatResponse:
    content: str
    citations: list[str] = field(default_factory=list)


class StreamingCompletion:
    """Iterate to get StreamChunks. `.response` is populated after iteration completes."""

    def __init__(self):
        self.response: ChatResponse | None = None
        self._iterator: Iterator[StreamChunk] = iter([])

    def __iter__(self) -> Iterator[StreamChunk]:
        yield from self._iterator


# --- Adapter Protocol ---


class LLMAdapter(Protocol):
    def stream(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[Tool] = [],
        response_model: type[BaseModel] | None = None,
    ) -> StreamingCompletion: ...
