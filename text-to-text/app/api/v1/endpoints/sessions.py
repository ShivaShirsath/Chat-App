import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import ChatSession, ChatMessage
from app.services.agent_manager import agent_manager
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class SessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    created_at: datetime
    is_streaming: Optional[bool] = None
    thoughts: Optional[List[str]] = None
    terminal_logs: Optional[str] = None
    diffs: Optional[dict] = None
    permission_request: Optional[dict] = None
    thinking_time: Optional[int] = None

    class Config:
        from_attributes = True

@router.get("", response_model=List[SessionOut])
async def list_sessions(db: Session = Depends(get_db)):
    """
    List all chat sessions, ordered by last active time descending.
    """
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
    return sessions

@router.get("/{session_id}/messages", response_model=List[MessageOut])
async def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    """
    Fetch all historical messages for a specific chat session.
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found."
        )
    # Order by message creation time ascending
    db_messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    
    result = []
    for m in db_messages:
        # Parse stringified JSON fields from DB
        thoughts = None
        if m.thoughts:
            try:
                thoughts = json.loads(m.thoughts)
            except Exception:
                pass
                
        diffs = None
        if m.diffs:
            try:
                diffs = json.loads(m.diffs)
            except Exception:
                pass
                
        permission_req = None
        if m.permission_request:
            try:
                permission_req = json.loads(m.permission_request)
            except Exception:
                pass

        result.append(MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            media_url=m.media_url,
            media_type=m.media_type,
            created_at=m.created_at,
            is_streaming=m.is_streaming,
            thoughts=thoughts,
            terminal_logs=m.terminal_logs,
            diffs=diffs,
            permission_request=permission_req,
            thinking_time=m.thinking_time
        ))
        
    # Check if there is an active running agent for this session and append it
    active_agent = agent_manager.get_agent(session_id)
    if active_agent:
        result.append(MessageOut(
            id=active_agent.agent_msg_id,
            role="assistant",
            content="",
            is_streaming=True,
            thoughts=active_agent.thoughts,
            terminal_logs=active_agent.terminal_logs,
            diffs=active_agent.diffs,
            permission_request=active_agent.permission_request,
            thinking_time=active_agent.thinking_time,
            created_at=datetime.utcnow()
        ))
        
    return result

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    """
    Delete a chat session and all its associated message records (cascade delete).
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found."
        )
    db.delete(session)
    db.commit()
    return None
