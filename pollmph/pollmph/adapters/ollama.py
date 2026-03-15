from typing import Iterator

from pydantic import BaseModel

from pollmph.llm import (
    ChatResponse,
    StreamChunk,
    StreamingCompletion,
    Tool,
)


class OllamaAdapter:
    """LLMAdapter for a local Ollama server.

    Tools (WebSearchTool, XSearchTool) are not supported by Ollama and
    are silently ignored. Structured output is handled via Ollama's
    native JSON schema `format` parameter.
    """

    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def stream(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[Tool] = [],
        response_model: type[BaseModel] | None = None,
    ) -> StreamingCompletion:
        completion = StreamingCompletion()
        format_schema = response_model.model_json_schema() if response_model else None

        def _generate() -> Iterator[StreamChunk]:
            accumulated: list[str] = []

            for chunk in self.client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                stream=True,
                format=format_schema,
            ):
                content = chunk.message.content or ""
                if content:
                    accumulated.append(content)
                yield StreamChunk(content=content)

            completion.response = ChatResponse(content="".join(accumulated))

        completion._iterator = _generate()
        return completion
