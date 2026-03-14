from typing import Iterator

from pydantic import BaseModel

from pollmph.llm import (
    ChatResponse,
    StreamChunk,
    StreamingCompletion,
    Tool,
    ToolCall,
    WebSearchTool,
    XSearchTool,
)


class GeminiAdapter:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def _make_tools(self, tools: list[Tool]) -> list:
        from google.genai import types

        result = []
        for tool in tools:
            if isinstance(tool, WebSearchTool):
                result.append(types.Tool(google_search=types.GoogleSearch()))
            elif isinstance(tool, XSearchTool):
                pass  # Gemini has no X/Twitter search; skip silently
        return result

    def stream(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[Tool] = [],
        response_model: type[BaseModel] | None = None,
    ) -> StreamingCompletion:
        from google.genai import types

        completion = StreamingCompletion()
        sdk_tools = self._make_tools(tools)

        def _generate() -> Iterator[StreamChunk]:
            accumulated: list[str] = []
            citations: list[str] = []

            # Step 1: stream with tools (no JSON schema — API rejects the combination)
            search_config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=sdk_tools if sdk_tools else None,
                response_mime_type="application/json" if (response_model and not sdk_tools) else None,
                response_schema=response_model if (response_model and not sdk_tools) else None,
            )

            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=user_message,
                config=search_config,
            ):
                content = ""
                tool_calls: list[ToolCall] = []

                if chunk.candidates:
                    candidate = chunk.candidates[0]

                    for part in candidate.content.parts:
                        if hasattr(part, "function_call") and part.function_call:
                            tool_calls.append(
                                ToolCall(
                                    name=part.function_call.name,
                                    arguments=str(part.function_call.args),
                                )
                            )
                        elif hasattr(part, "text") and part.text:
                            content += part.text

                    grounding = getattr(candidate, "grounding_metadata", None)
                    if grounding and getattr(grounding, "grounding_chunks", None):
                        for gc in grounding.grounding_chunks:
                            uri = getattr(getattr(gc, "web", None), "uri", None)
                            if uri and uri not in citations:
                                citations.append(uri)

                if content:
                    accumulated.append(content)

                yield StreamChunk(content=content, tool_calls=tool_calls)

            raw_content = "".join(accumulated)

            # Step 2: if tools were used, reformat the raw output as structured JSON
            if sdk_tools and response_model:
                format_response = self.client.models.generate_content(
                    model=self.model,
                    contents=f"Based on this analysis:\n\n{raw_content}\n\nProvide the structured output.",
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        response_schema=response_model,
                    ),
                )
                final_content = format_response.text or ""
            else:
                final_content = raw_content

            completion.response = ChatResponse(content=final_content, citations=citations)

        completion._iterator = _generate()
        return completion
