from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.endpoints import (
    text_to_text,
    text_to_image,
    text_and_image_to_image,
    text_to_video,
    websocket,
    sessions,
    agent,
)
from app.db.session import engine
from app.db.models import Base

# Create SQLite tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Unified Extensible Multimodal AI Gateway supporting HTTP, SSE streaming, and WebSockets.",
    version="1.0.0"
)

# CORS middleware configuration for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the storage directory to serve uploads & generated files statically
app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# Include API endpoints
app.include_router(text_to_text.router, prefix=f"{settings.API_V1_STR}/text-to-text", tags=["Text-to-Text"])
app.include_router(text_to_image.router, prefix=f"{settings.API_V1_STR}/text-to-image", tags=["Text-to-Image"])
app.include_router(text_and_image_to_image.router, prefix=f"{settings.API_V1_STR}/text-and-image-to-image", tags=["Text-and-Image-to-Image"])
app.include_router(text_to_video.router, prefix=f"{settings.API_V1_STR}/text-to-video", tags=["Text-to-Video"])
app.include_router(sessions.router, prefix=f"{settings.API_V1_STR}/sessions", tags=["Sessions"])
app.include_router(agent.router, prefix=f"{settings.API_V1_STR}/agent", tags=["Agent"])
app.include_router(websocket.router, prefix=settings.API_V1_STR, tags=["WebSockets"])

import os
from fastapi import HTTPException

@app.get("/")
async def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL
    }

@app.get("/api/v1/readme")
async def get_readme():
    readme_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "README.md")
    if not os.path.exists(readme_path):
        # fallback to cwd or parent
        readme_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "README.md")
    if not os.path.exists(readme_path):
        readme_path = "README.md"
        
    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read README.md: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
