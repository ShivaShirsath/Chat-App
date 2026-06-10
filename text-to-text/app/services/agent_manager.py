import asyncio
import json
from datetime import datetime
from typing import Dict, Optional, Set
from fastapi import WebSocket
from app.db.session import SessionLocal
from app.db.models import ChatSession, ChatMessage

class ActiveAgentState:
    def __init__(self, session_id: str, instruction: str, folder_path: str, model_name: str, agent_msg_id: Optional[str] = None):
        self.session_id = session_id
        self.instruction = instruction
        self.folder_path = folder_path
        self.model_name = model_name
        self.agent_msg_id = agent_msg_id or f"agent-{int(datetime.utcnow().timestamp() * 1000)}"
        self.thoughts = ["Connecting to agent loop..."]
        self.terminal_logs = ""
        self.diffs = {}
        self.permission_request = None  # Dict of {question, options, answeredChoice}
        self.is_streaming = True
        self.websockets: Set[WebSocket] = set()
        self.response_queue = asyncio.Queue()
        self.task = None  # The running asyncio task
        self.start_time = asyncio.get_event_loop().time()

    @property
    def thinking_time(self) -> int:
        return int(asyncio.get_event_loop().time() - self.start_time)

class AgentManager:
    def __init__(self):
        self.active_agents: Dict[str, ActiveAgentState] = {}

    def get_agent(self, session_id: str) -> Optional[ActiveAgentState]:
        return self.active_agents.get(session_id)

    def start_agent(self, session_id: str, instruction: str, folder_path: str, model_name: str, task_coro, agent_msg_id: Optional[str] = None) -> ActiveAgentState:
        if session_id in self.active_agents:
            return self.active_agents[session_id]
        
        state = ActiveAgentState(session_id, instruction, folder_path, model_name, agent_msg_id)
        self.active_agents[session_id] = state
        state.task = asyncio.create_task(task_coro(state))
        return state

    def stop_agent(self, session_id: str):
        state = self.active_agents.get(session_id)
        if state:
            if state.task and not state.task.done():
                state.task.cancel()
            self.active_agents.pop(session_id, None)

# Global singleton manager
agent_manager = AgentManager()


async def broadcast_agent_event(state: ActiveAgentState, event: dict):
    # Update in-memory state
    event_type = event.get("type")
    if event_type == "thought":
        state.thoughts.append(event.get("content"))
    elif event_type == "terminal":
        state.terminal_logs += event.get("content", "")
    elif event_type == "diff":
        state.diffs = event.get("diffs", {})
    elif event_type == "permission_request":
        state.permission_request = {
            "question": event.get("question"),
            "options": event.get("options"),
            "answeredChoice": None
        }
    elif event_type == "permission_response":
        if state.permission_request:
            state.permission_request["answeredChoice"] = event.get("choice")
    elif event_type == "done":
        state.is_streaming = False
        duration = state.thinking_time
        # Save to DB
        db = SessionLocal()
        try:
            session = db.query(ChatSession).filter(ChatSession.id == state.session_id).first()
            db_assistant_msg = ChatMessage(
                id=state.agent_msg_id,
                session_id=state.session_id,
                role="assistant",
                content=event.get("summary", "Task completed."),
                media_url=None,
                media_type=None,
                is_streaming=False,
                thoughts=json.dumps(state.thoughts),
                terminal_logs=state.terminal_logs,
                diffs=json.dumps(state.diffs),
                permission_request=json.dumps(state.permission_request) if state.permission_request else None,
                thinking_time=duration
            )
            db.add(db_assistant_msg)
            if session:
                session.updated_at = datetime.utcnow()
            db.commit()
        finally:
            db.close()
            
    elif event_type == "error":
        state.is_streaming = False
        duration = state.thinking_time
        db = SessionLocal()
        try:
            session = db.query(ChatSession).filter(ChatSession.id == state.session_id).first()
            db_assistant_msg = ChatMessage(
                id=state.agent_msg_id,
                session_id=state.session_id,
                role="assistant",
                content=f"Error: {event.get('message', 'Unknown error occurred.')}",
                media_url=None,
                media_type=None,
                is_streaming=False,
                thoughts=json.dumps(state.thoughts),
                terminal_logs=state.terminal_logs,
                diffs=json.dumps(state.diffs),
                permission_request=json.dumps(state.permission_request) if state.permission_request else None,
                thinking_time=duration
            )
            db.add(db_assistant_msg)
            if session:
                session.updated_at = datetime.utcnow()
            db.commit()
        finally:
            db.close()

    # Distribute the event to all registered websockets
    disconnected = []
    for ws in list(state.websockets):
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        state.websockets.discard(ws)

    # Clean up from manager if ended
    if event_type in ["done", "error"]:
        agent_manager.active_agents.pop(state.session_id, None)


async def agent_task_wrapper(state: ActiveAgentState):
    from app.services.agent_service import AgentService
    agent_service = AgentService()
    
    async def event_callback(event: dict):
        await broadcast_agent_event(state, event)

    try:
        await agent_service.run_agent(
            folder_path=state.folder_path,
            instruction=state.instruction,
            model_name=state.model_name,
            event_callback=event_callback,
            response_queue=state.response_queue
        )
    except asyncio.CancelledError:
        await event_callback({
            "type": "error",
            "message": "Agent execution stopped by user."
        })
    except Exception as e:
        await event_callback({
            "type": "error",
            "message": f"Agent loop crashed: {str(e)}"
        })
