from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.base import BaseModelService
from app.api.deps import get_text_to_text_service

router = APIRouter()

@router.post("/chat", response_model=None)
async def chat(
    request: ChatRequest,
    service: BaseModelService = Depends(get_text_to_text_service)
):
    """
    Standard chat completion endpoint for text-to-text models.
    Supports both non-streaming JSON and streaming Server-Sent Events (SSE).
    """
    if request.stream:
        async def stream_generator():
            async for chunk in service.generate_stream(request):
                yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        return await service.generate(request)
