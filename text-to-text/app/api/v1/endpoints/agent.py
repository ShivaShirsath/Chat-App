import os
import json
import subprocess
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from pydantic import BaseModel
from app.services.agent_service import AgentService
from app.db.session import SessionLocal
from app.db.models import ChatSession, ChatMessage
from datetime import datetime

router = APIRouter()
agent_service = AgentService()

@router.post("/select-folder")
async def select_folder():
    """
    Triggers a native macOS folder picker dialog using AppleScript
    and returns the selected absolute path.
    """
    cmd = ["osascript", "-e", 'POSIX path of (choose folder with prompt "Select Workspace Folder")']
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, text=True)
        )
        
        if result.returncode != 0:
            if "User cancelled" in result.stderr:
                return {"path": ""}
            raise HTTPException(status_code=500, detail=f"AppleScript error: {result.stderr}")
            
        path = result.stdout.strip()
        return {"path": path}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

class PathValidationRequest(BaseModel):
    path: str

class PathValidationResponse(BaseModel):
    exists: bool
    is_directory: bool
    files: list[str] = []

@router.post("/validate-path", response_model=PathValidationResponse)
async def validate_path(request: PathValidationRequest):
    """
    Checks if a local folder path exists, is a directory,
    and returns up to 100 relative file paths inside it.
    """
    path = request.path
    if not os.path.exists(path):
        return PathValidationResponse(exists=False, is_directory=False)
    
    if not os.path.isdir(path):
        return PathValidationResponse(exists=True, is_directory=False)
        
    # Walk directory to list files
    files = []
    try:
        for root, dirs, filenames in os.walk(path):
            # Skip noise
            if any(ignored in root for ignored in ["node_modules", ".git", "__pycache__", "venv"]):
                continue
            for f in filenames:
                rel = os.path.relpath(os.path.join(root, f), path)
                files.append(rel)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read folder contents: {str(e)}")
        
    return PathValidationResponse(
        exists=True,
        is_directory=True,
        files=files[:100]  # Cap list
    )

@router.websocket("/run")
async def run_agent_ws(websocket: WebSocket):
    """
    WebSocket endpoint that receives run configuration, runs the agent loop,
    and listens for user responses to permission prompts.
    """
    await websocket.accept()
    
    agent_service = AgentService()
    db = SessionLocal()
    session_id = None
    
    try:
        # 1. Wait for initial config message
        config_data = await websocket.receive_text()
        config = json.loads(config_data)
        
        folder_path = config.get("folder_path")
        instruction = config.get("instruction")
        model_name = config.get("model_name", "llama3.2:latest")
        session_id = config.get("session_id")
        
        if not folder_path or not instruction:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Missing required fields 'folder_path' or 'instruction' in handshake."
            }))
            await websocket.close()
            return

        # Resolve or create ChatSession
        if not session_id:
            title = instruction[:30] + "..." if len(instruction) > 30 else instruction
            session = ChatSession(title=f"[Agent] {title}")
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id
            
            # Notify client of the newly created session
            await websocket.send_text(json.dumps({
                "type": "session_created",
                "session_id": session_id,
                "title": session.title
            }))
        else:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not session:
                session = ChatSession(id=session_id, title=f"[Agent] Run")
                db.add(session)
                db.commit()
                db.refresh(session)

        # Save User Message to DB
        db_user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=instruction
        )
        db.add(db_user_msg)
        db.commit()

        # 2. Callback function to send events back over WebSocket
        async def event_callback(event: dict):
            try:
                # If done, save the final agent summary content to DB
                if event.get("type") == "done":
                    db_assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=event.get("summary", "Task completed.")
                    )
                    db.add(db_assistant_msg)
                    session.updated_at = datetime.utcnow()
                    db.commit()
                elif event.get("type") == "error":
                    db_assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=f"Error: {event.get('message', 'Unknown error occurred.')}"
                    )
                    db.add(db_assistant_msg)
                    session.updated_at = datetime.utcnow()
                    db.commit()
                    
                await websocket.send_text(json.dumps(event))
            except Exception:
                # Socket might have closed
                pass

        # 3. Start the agent task in the background
        agent_task = asyncio.create_task(
            agent_service.run_agent(
                folder_path=folder_path,
                instruction=instruction,
                model_name=model_name,
                event_callback=event_callback
            )
        )
        
        # 4. Listen for user input while task is running
        while not agent_task.done():
            try:
                # Listen with a short timeout to keep checking if the agent completed
                message_text = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                msg = json.loads(message_text)
                
                # Check for permission responses
                if msg.get("type") == "permission_response":
                    choice = msg.get("choice")
                    await agent_service.response_queue.put(choice)
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break
                
        # Wait for the task to fully finish in case of any unhandled errors
        if not agent_task.done():
            await agent_task
        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Server error inside agent runner: {str(e)}"
            }))
        except Exception:
            pass
    finally:
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
