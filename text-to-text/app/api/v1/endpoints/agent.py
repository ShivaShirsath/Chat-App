import os
import json
import subprocess
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from pydantic import BaseModel
from app.services.agent_service import AgentService

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
    
    try:
        # 1. Wait for initial config message
        config_data = await websocket.receive_text()
        config = json.loads(config_data)
        
        folder_path = config.get("folder_path")
        instruction = config.get("instruction")
        model_name = config.get("model_name", "llama3.2:latest")
        
        if not folder_path or not instruction:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Missing required fields 'folder_path' or 'instruction' in handshake."
            }))
            await websocket.close()
            return

        # 2. Callback function to send events back over WebSocket
        async def event_callback(event: dict):
            try:
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
        try:
            await websocket.close()
        except Exception:
            pass
