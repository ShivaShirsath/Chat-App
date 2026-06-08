from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from typing import Dict, Any
import json
import logging
from datetime import datetime

from app.schemas.chat import ChatRequest
from app.api.deps import (
    get_text_to_text_service,
    get_text_to_image_service,
    get_text_and_image_to_image_service,
    get_text_to_video_service,
)
from app.core.exceptions import GatewayException
from app.db.session import SessionLocal
from app.db.models import ChatSession, ChatMessage
from app.services.storage_service import storage_service

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
            
            # Open dynamic database transaction session
            db = SessionLocal()
            try:
                # 1. Resolve or create ChatSession
                session_id = chat_request.session_id
                if not session_id:
                    user_prompt = chat_request.messages[-1].content if chat_request.messages else "New Chat"
                    title = user_prompt[:30] + "..." if len(user_prompt) > 30 else user_prompt
                    session = ChatSession(title=title)
                    db.add(session)
                    db.commit()
                    db.refresh(session)
                    session_id = session.id
                    
                    # Notify client of the newly created session
                    await websocket.send_json({
                        "event": "session_created",
                        "session_id": session_id,
                        "title": session.title
                    })
                else:
                    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
                    if not session:
                        session = ChatSession(id=session_id, title="Restored Conversation")
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                
                # 2. Save User Message to Database
                user_msg = chat_request.messages[-1]
                media_url = None
                media_type = None
                
                # If there is a base64 encoded user image, write it to local uploads
                if user_msg.image_url:
                    media_url = await storage_service.save_base64_file(user_msg.image_url)
                    media_type = "image"
                
                db_user_msg = ChatMessage(
                    session_id=session_id,
                    role="user",
                    content=user_msg.content,
                    media_url=media_url,
                    media_type=media_type
                )
                db.add(db_user_msg)
                db.commit()
                
                # 3. Generate and stream/send response
                if chat_request.stream:
                    full_content = ""
                    out_media_url = None
                    out_media_type = None
                    
                    async for chunk in service.generate_stream(chat_request):
                        await websocket.send_json({
                            "event": "chunk",
                            "data": chunk.model_dump()
                        })
                        delta = chunk.choices[0].delta.content or ""
                        full_content += delta
                        if chunk.media_url:
                            out_media_url = chunk.media_url
                            out_media_type = chunk.media_type
                    
                    # Cache output media files locally on disk
                    if out_media_url:
                        out_media_url = await storage_service.save_url_file(out_media_url, out_media_type)
                    
                    # Log Assistant response to DB
                    db_assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_content,
                        media_url=out_media_url,
                        media_type=out_media_type
                    )
                    db.add(db_assistant_msg)
                    
                    # Update active timestamp
                    session.updated_at = datetime.utcnow()
                    db.commit()
                    
                    # Notify client stream completed with storage URL
                    await websocket.send_json({
                        "event": "done",
                        "media_url": out_media_url,
                        "media_type": out_media_type
                    })
                else:
                    response = await service.generate(chat_request)
                    assistant_msg = response.choices[0].message
                    out_media_url = response.media_url
                    out_media_type = response.media_type
                    
                    # Cache output media files locally on disk
                    if out_media_url:
                        out_media_url = await storage_service.save_url_file(out_media_url, out_media_type)
                        response.media_url = out_media_url
                    
                    db_assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=assistant_msg.content,
                        media_url=out_media_url,
                        media_type=out_media_type
                    )
                    db.add(db_assistant_msg)
                    
                    session.updated_at = datetime.utcnow()
                    db.commit()
                    
                    await websocket.send_json({
                        "event": "response",
                        "data": response.model_dump()
                    })
            except GatewayException as e:
                await websocket.send_json({"error": e.detail})
            except Exception as e:
                logger.error(f"Error during socket processing: {str(e)}")
                await websocket.send_json({"error": f"Internal generation failure: {str(e)}"})
            finally:
                db.close()

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client.")
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
