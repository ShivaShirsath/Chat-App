from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str
    # Optional image data for multimodal inputs (base64 encoded)
    image_url: Optional[str] = None 

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = False
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    model: Optional[str] = None
    session_id: Optional[str] = None
    # Additional raw parameters for extensibility
    options: Optional[Dict[str, Any]] = None

class Choice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: Optional[str] = None

class ChatResponse(BaseModel):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: List[Choice]
    # To easily pass custom structural outputs like generated images or videos
    media_url: Optional[str] = None
    media_type: Optional[Literal["image", "video", "text"]] = "text"

# SSE Chat chunk schemas
class MessageDelta(BaseModel):
    role: Optional[Literal["system", "user", "assistant"]] = None
    content: Optional[str] = ""

class ChoiceChunk(BaseModel):
    index: int = 0
    delta: MessageDelta
    finish_reason: Optional[str] = None

class ChatResponseChunk(BaseModel):
    id: str
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    created: int
    model: str
    choices: List[ChoiceChunk]
    media_url: Optional[str] = None
    media_type: Optional[Literal["image", "video", "text"]] = None
