import os
import json
import subprocess
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from pydantic import BaseModel
from app.services.agent_service import AgentService
from app.services.agent_manager import agent_manager, agent_task_wrapper, broadcast_agent_event
from app.db.session import SessionLocal
from app.db.models import ChatSession, ChatMessage
from datetime import datetime

router = APIRouter()
agent_service = AgentService()

@router.get("/active")
async def get_active_agents():
    """
    Returns list of active session IDs currently running background agents.
    """
    return list(agent_manager.active_agents.keys())

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
    WebSocket endpoint that receives run configuration, runs/reconnects the agent loop,
    and listens for user responses to permission prompts.
    """
    await websocket.accept()
    
    try:
        config_data = await websocket.receive_text()
        config = json.loads(config_data)
    except Exception:
        await websocket.close()
        return

    session_id = config.get("session_id")
    is_reconnect = config.get("reconnect", False)
    
    state = None
    if session_id:
        state = agent_manager.get_agent(session_id)
        
    if state:
        # Re-attach to the active agent state
        state.websockets.add(websocket)
        
        # Send session created handshake back to confirm
        await websocket.send_text(json.dumps({
            "type": "session_created",
            "session_id": state.session_id
        }))
        
        # Replay thoughts to client
        for thought in state.thoughts:
            await websocket.send_text(json.dumps({
                "type": "thought",
                "content": thought,
                "replay": True
            }))
            
        # Replay terminal logs
        if state.terminal_logs:
            await websocket.send_text(json.dumps({
                "type": "terminal",
                "content": state.terminal_logs,
                "replay": True
            }))
            
        # Replay diffs
        if state.diffs:
            await websocket.send_text(json.dumps({
                "type": "diff",
                "diffs": state.diffs,
                "replay": True
            }))
            
        # Replay pending permission request if active
        if state.permission_request:
            await websocket.send_text(json.dumps({
                "type": "permission_request",
                "question": state.permission_request["question"],
                "options": state.permission_request["options"],
                "answeredChoice": state.permission_request.get("answeredChoice"),
                "replay": True
            }))
            
        # Wait for messages on the newly attached websocket
        try:
            while state.is_streaming:
                message_text = await websocket.receive_text()
                msg = json.loads(message_text)
                
                if msg.get("type") == "permission_response":
                    choice = msg.get("choice")
                    await broadcast_agent_event(state, {
                        "type": "permission_response",
                        "choice": choice
                    })
                    await state.response_queue.put(choice)
                elif msg.get("type") in ["stop", "stop_agent"]:
                    agent_manager.stop_agent(state.session_id)
                    break
        except WebSocketDisconnect:
            pass
        finally:
            state.websockets.discard(websocket)
            
    else:
        # If the client requested a reconnect but the agent is not running
        if is_reconnect:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Agent execution has already completed or does not exist."
            }))
            await websocket.close()
            return
            
        # New execution path
        folder_path = config.get("folder_path")
        instruction = config.get("instruction")
        model_name = config.get("model_name", "llama3.2:latest")
        agent_msg_id = config.get("agent_msg_id")

        if session_id and session_id.startswith("temp-"):
            session_id = None
        
        if not folder_path or not instruction:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Missing required fields 'folder_path' or 'instruction' in handshake."
            }))
            await websocket.close()
            return
            
        # Create or fetch session
        db = SessionLocal()
        try:
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
                    
                    # Notify client of the newly created session
                    await websocket.send_text(json.dumps({
                        "type": "session_created",
                        "session_id": session_id,
                        "title": session.title
                    }))
                    
            # Save User Message to DB
            db_user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=instruction
            )
            db.add(db_user_msg)
            db.commit()
        finally:
            db.close()
            
        # Start the agent background task via manager
        state = agent_manager.start_agent(
            session_id=session_id,
            instruction=instruction,
            folder_path=folder_path,
            model_name=model_name,
            task_coro=agent_task_wrapper,
            agent_msg_id=agent_msg_id
        )
        
        # Add the starting websocket
        state.websockets.add(websocket)
        
        # Listen on the socket
        try:
            while state.is_streaming:
                message_text = await websocket.receive_text()
                msg = json.loads(message_text)
                
                if msg.get("type") == "permission_response":
                    choice = msg.get("choice")
                    await broadcast_agent_event(state, {
                        "type": "permission_response",
                        "choice": choice
                    })
                    await state.response_queue.put(choice)
                elif msg.get("type") in ["stop", "stop_agent"]:
                    agent_manager.stop_agent(state.session_id)
                    break
        except WebSocketDisconnect:
            pass
        finally:
            state.websockets.discard(websocket)
