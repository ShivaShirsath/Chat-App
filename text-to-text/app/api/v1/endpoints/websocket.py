from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from typing import Dict, Any
import json
import logging

from app.schemas.chat import ChatRequest
from app.api.deps import (
    get_text_to_text_service,
    get_text_to_image_service,
    get_text_and_image_to_image_service,
    get_text_to_video_service,
)
from app.core.exceptions import GatewayException

logger = logging.getLogger(__name__)
router = APIRouter()

# Map model type to dependency resolving functions
SERVICES_MAP = {
    "text-to-text": get_text_to_text_service,
    "text-to-image": get_text_to_image_service,
    "text-and-image-to-image": get_text_and_image_to_image_service,
    "text-to-video": get_text_to_video_service,
}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established.")
    
    try:
        while True:
            # Wait for message from client
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON format."})
                continue
            
            # Extract request routing fields
            model_type = data.get("type")
            request_data = data.get("payload")
            
            if not model_type or not request_data:
                await websocket.send_json({
                    "error": "Message must contain 'type' (model route) and 'payload' (chat request)."
                })
                continue
                
            if model_type not in SERVICES_MAP:
                await websocket.send_json({
                    "error": f"Unsupported model type '{model_type}'. Options are: {list(SERVICES_MAP.keys())}"
                })
                continue
            
            # Parse & validate request payload
            try:
                chat_request = ChatRequest(**request_data)
            except ValidationError as e:
                await websocket.send_json({
                    "error": "Invalid payload format.",
                    "details": e.errors()
                })
                continue
            
            # Resolve service and run generation
            service_factory = SERVICES_MAP[model_type]
            service = service_factory()
            
            try:
                if chat_request.stream:
                    async for chunk in service.generate_stream(chat_request):
                        await websocket.send_json({
                            "event": "chunk",
                            "data": chunk.model_dump()
                        })
                    await websocket.send_json({"event": "done"})
                else:
                    response = await service.generate(chat_request)
                    await websocket.send_json({
                        "event": "response",
                        "data": response.model_dump()
                    })
            except GatewayException as e:
                await websocket.send_json({"error": e.detail})
            except Exception as e:
                logger.error(f"Error during socket processing: {str(e)}")
                await websocket.send_json({"error": f"Internal generation failure: {str(e)}"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client.")
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
