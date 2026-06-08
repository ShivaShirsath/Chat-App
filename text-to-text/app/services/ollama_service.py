import time
import json
import httpx
from typing import AsyncGenerator
from app.services.base import BaseModelService
from app.schemas.chat import ChatRequest, ChatResponse, ChatResponseChunk, Choice, ChatMessage, ChoiceChunk, MessageDelta
from app.core.config import settings
from app.core.exceptions import ModelServiceException

class OllamaService(BaseModelService):
    """
    Ollama service implementing BaseModelService.
    Communicates with local Ollama HTTP API.
    """
    
    def __init__(self, base_url: str = settings.OLLAMA_BASE_URL, default_model: str = settings.OLLAMA_MODEL):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model

    def _get_model_name(self, request: ChatRequest) -> str:
        # Allow overriding model in request, fallback to config
        return request.model or self.default_model

    async def generate(self, request: ChatRequest) -> ChatResponse:
        model = self._get_model_name(request)
        url = f"{self.base_url}/api/chat"
        
        # Prepare Ollama payload
        payload = {
            "model": model,
            "messages": [
                {"role": msg.role, "content": msg.content} 
                for msg in request.messages
            ],
            "stream": False,
            "options": {
                "temperature": request.temperature,
            }
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                assistant_message = ChatMessage(
                    role="assistant",
                    content=data["message"]["content"]
                )
                
                return ChatResponse(
                    id=f"ollama-{int(time.time())}",
                    created=int(time.time()),
                    model=model,
                    choices=[Choice(index=0, message=assistant_message, finish_reason="stop")]
                )
        except httpx.HTTPStatusError as e:
            raise ModelServiceException(f"Ollama returned HTTP error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise ModelServiceException(f"Failed to communicate with Ollama: {str(e)}")

    async def generate_stream(self, request: ChatRequest) -> AsyncGenerator[ChatResponseChunk, None]:
        model = self._get_model_name(request)
        url = f"{self.base_url}/api/chat"
        
        payload = {
            "model": model,
            "messages": [
                {"role": msg.role, "content": msg.content} 
                for msg in request.messages
            ],
            "stream": True,
            "options": {
                "temperature": request.temperature,
            }
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        try:
            client = httpx.AsyncClient(timeout=60.0)
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    # Read error content
                    err_content = await response.aread()
                    raise ModelServiceException(f"Ollama returned HTTP error {response.status_code}: {err_content.decode()}")
                
                # Stream lines
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        content_chunk = data.get("message", {}).get("content", "")
                        done = data.get("done", False)
                        
                        chunk = ChatResponseChunk(
                            id=f"ollama-{int(time.time())}",
                            created=int(time.time()),
                            model=model,
                            choices=[
                                ChoiceChunk(
                                    index=0,
                                    delta=MessageDelta(role="assistant", content=content_chunk),
                                    finish_reason="stop" if done else None
                                )
                            ]
                        )
                        yield chunk
                    except json.JSONDecodeError:
                        continue
        except httpx.RequestError as e:
            raise ModelServiceException(f"Network request to Ollama failed: {str(e)}")
        except Exception as e:
            raise ModelServiceException(f"Stream generation failed: {str(e)}")
