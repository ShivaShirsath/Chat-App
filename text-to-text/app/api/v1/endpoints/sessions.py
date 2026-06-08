from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import ChatSession, ChatMessage
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
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    return messages

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
