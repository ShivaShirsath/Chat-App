from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import json

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.base import BaseModelService
from app.api.deps import get_text_to_text_service
from app.db.session import get_db
from app.db.models import ChatSession, ChatMessage
from app.services.storage_service import storage_service

router = APIRouter()

@router.post("/chat", response_model=None)
async def chat(
    request: ChatRequest,
    service: BaseModelService = Depends(get_text_to_text_service),
    db: Session = Depends(get_db)
):
    """
    Standard chat completion endpoint for text-to-text models.
    Supports both non-streaming JSON and streaming Server-Sent Events (SSE) logged to SQLite.
    """
    # 1. Resolve or create ChatSession
    session_id = request.session_id
    new_session_created = False
    
    if not session_id:
        user_prompt = request.messages[-1].content if request.messages else "New Chat"
        title = user_prompt[:30] + "..." if len(user_prompt) > 30 else user_prompt
        session = ChatSession(title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
        new_session_created = True
    else:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            session = ChatSession(id=session_id, title="Restored Conversation")
            db.add(session)
            db.commit()
            db.refresh(session)
            new_session_created = True

    # 2. Save User Message to DB
    user_msg = request.messages[-1]
    media_url = None
    media_type = None
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

    if request.stream:
        async def stream_generator():
            # If a new session was created, yield that metadata first so the client can store it
            if new_session_created:
                session_meta = {
                    "event": "session_created",
                    "session_id": session_id,
                    "title": session.title
                }
                yield f"data: {json.dumps(session_meta)}\n\n"
                
            full_content = ""
            async for chunk in service.generate_stream(request):
                # Ensure the chunk includes the session_id
                chunk_data = chunk.model_dump()
                yield f"data: {json.dumps(chunk_data)}\n\n"
                delta = chunk.choices[0].delta.content or ""
                full_content += delta
                
            # Log Assistant response to DB
            db_assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_content
            )
            db.add(db_assistant_msg)
            
            # Update active timestamp
            session.updated_at = datetime.utcnow()
            db.commit()
            
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        response = await service.generate(request)
        assistant_msg = response.choices[0].message
        
        # Log Assistant response to DB
        db_assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=assistant_msg.content
        )
        db.add(db_assistant_msg)
        
        session.updated_at = datetime.utcnow()
        db.commit()
        
        # Inject the resolved session_id back into the HTTP response so the client knows it
        response_dict = response.model_dump()
        response_dict["session_id"] = session_id
        return response_dict
