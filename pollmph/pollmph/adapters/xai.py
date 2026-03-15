from typing import Iterator

from pydantic import BaseModel
from xai_sdk.chat import system, user
from xai_sdk.tools import web_search, x_search

from pollmph.llm import (
    ChatResponse,
    StreamChunk,
    StreamingCompletion,
    Tool,
    ToolCall,
    WebSearchTool,
    XSearchTool,
)


class XAIAdapter:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def _make_tools(self, tools: list[Tool]) -> list:
        result = []
        for tool in tools:
            if isinstance(tool, WebSearchTool):
                result.append(web_search())
            elif isinstance(tool, XSearchTool):
                result.append(x_search(from_date=tool.from_date, to_date=tool.to_date))
        return result

    def stream(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[Tool] = [],
        response_model: type[BaseModel] | None = None,
    ) -> StreamingCompletion:
        completion = StreamingCompletion()
        sdk_tools = self._make_tools(tools)

        def _generate() -> Iterator[StreamChunk]:
            chat = self.client.chat.create(
                model=self.model,
                tools=sdk_tools if sdk_tools else None,
                include=["verbose_streaming"] if sdk_tools else None,
                response_format=response_model,
            )
            chat.append(system(system_prompt))
            chat.append(user(user_message))

            final_response = None
            for response, chunk in chat.stream():
                final_response = response
                yield StreamChunk(
                    content=chunk.content,
                    tool_calls=[
                        ToolCall(name=tc.function.name, arguments=tc.function.arguments)
                        for tc in chunk.tool_calls
                    ],
                    reasoning_tokens=response.usage.reasoning_tokens
                    if response.usage
                    else 0,
                )

            completion.response = ChatResponse(
                content=final_response.content if final_response else "",
                citations=list(final_response.citations) if final_response else [],
            )

        completion._iterator = _generate()
        return completion
