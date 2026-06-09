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

    async def get_installed_models(self) -> list:
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                models = data.get("models", [])
                
                categorized = []
                import re
                for m in models:
                    name = m.get("name", "")
                    details = m.get("details", {}) or {}
                    
                    # 1. Base family name
                    family = details.get("family", "Unknown").capitalize()
                    
                    # 2. Check if Uncensored
                    is_uncensored = any(keyword in name.lower() for keyword in ["uncensored", "dolphin", "abliterated"])
                    
                    # 3. Parameter size parsing
                    param_size_str = details.get("parameter_size", "")
                    param_size_gb = m.get("size", 0) / (1024 * 1024 * 1024)
                    
                    param_size_num = None
                    if param_size_str:
                        match = re.search(r"([0-9.]+)", param_size_str)
                        if match:
                            try:
                                param_size_num = float(match.group(1))
                                if "M" in param_size_str.upper():
                                    param_size_num = param_size_num / 1000.0
                            except ValueError:
                                pass
                                
                    if param_size_num is None:
                        # Fallback to file size-based estimation
                        if param_size_gb < 1.5:
                            param_size_num = 1.0
                        elif param_size_gb < 3.5:
                            param_size_num = 3.0
                        elif param_size_gb < 6.0:
                            param_size_num = 7.0
                        elif param_size_gb < 10.0:
                            param_size_num = 8.0
                        else:
                            param_size_num = 13.0
                            
                    # Determine Tier category
                    if param_size_num < 2.0:
                        tier = "Ultra-Lightweight / Fast"
                    elif param_size_num < 5.0:
                        tier = "Balanced / Lightweight"
                    elif param_size_num < 15.0:
                        tier = "Standard / Capable"
                    else:
                        tier = "Large / Advanced"
                        
                    # Standard display name format
                    base_name = name
                    if ":" in base_name:
                        base_name = base_name.split(":")[0]
                    if "/" in base_name:
                        base_name = base_name.split("/")[-1]
                    
                    display_name = base_name.lower()
                    for kw in ["uncensored", "abliterated", "dolphin"]:
                        display_name = display_name.replace(kw, "")
                    display_name = display_name.replace("-", " ").replace("_", " ").strip()
                    display_name = " ".join(w.capitalize() for w in display_name.split())
                    display_name = re.sub(r"([a-zA-Z])([0-9])", r"\1 \2", display_name)
                    display_name = re.sub(r"\b\d+b\b", "", display_name, flags=re.IGNORECASE).strip()
                    
                    quant = details.get("quantization_level", "Unknown")
                    
                    uncensored_label = " (Uncensored)" if is_uncensored else ""
                    friendly_label = f"{display_name}{uncensored_label} ({param_size_str or f'{param_size_num:.1f}B'}, {quant})"
                    
                    categorized.append({
                        "id": name,
                        "name": name,
                        "friendly_label": friendly_label,
                        "family": family,
                        "tier": tier,
                        "is_uncensored": is_uncensored,
                        "size_bytes": m.get("size", 0),
                        "parameter_size": param_size_str,
                        "quantization_level": quant
                    })
                return categorized
        except Exception:
            return []
