from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest
from app.services.base import BaseModelService
from app.api.deps import get_text_and_image_to_image_service

router = APIRouter()

@router.post("/chat", response_model=None)
async def chat(
    request: ChatRequest,
    service: BaseModelService = Depends(get_text_and_image_to_image_service)
):
    """
    Modify an image using text prompt instructions.
    Supports both non-streaming response and streaming generation steps.
    """
    if request.stream:
        async def stream_generator():
            async for chunk in service.generate_stream(request):
                yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        return await service.generate(request)
