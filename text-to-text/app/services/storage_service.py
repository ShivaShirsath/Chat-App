import os
import uuid
import base64
import httpx
import aiofiles
import logging

logger = logging.getLogger(__name__)

STORAGE_DIR = "storage"
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
GENERATIONS_DIR = os.path.join(STORAGE_DIR, "generations")

class LocalStorageService:
    """
    Service responsible for reading, writing, and caching media files locally.
    Decoupled from FastAPI endpoints to satisfy Single Responsibility.
    """
    def __init__(self):
        # Ensure directories exist
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        os.makedirs(GENERATIONS_DIR, exist_ok=True)
        
    async def save_base64_file(self, base64_data: str) -> str:
        """
        Saves a base64 encoded data string (from frontend upload) to local storage.
        Returns the relative URL path, e.g. '/storage/uploads/uuid.ext'
        """
        try:
            if not base64_data or not base64_data.startswith("data:"):
                raise ValueError("Invalid base64 data format.")
                
            header, encoded = base64_data.split(";base64,")
            mime_type = header.replace("data:", "")
            
            # Determine extension
            ext = "png"
            if "image/jpeg" in mime_type:
                ext = "jpg"
            elif "image/webp" in mime_type:
                ext = "webp"
            elif "image/gif" in mime_type:
                ext = "gif"
                
            file_name = f"{uuid.uuid4()}.{ext}"
            file_path = os.path.join(UPLOADS_DIR, file_name)
            
            file_content = base64.b64decode(encoded)
            
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(file_content)
                
            return f"/storage/uploads/{file_name}"
        except Exception as e:
            logger.error(f"Failed to save base64 file: {str(e)}")
            raise e
            
    async def save_url_file(self, url: str, media_type: str = "image") -> str:
        """
        Downloads a file from an external URL and saves it to local storage.
        Returns the relative URL path, e.g. '/storage/generations/uuid.ext'
        """
        try:
            ext = "png" if media_type == "image" else "mp4"
            file_name = f"{uuid.uuid4()}.{ext}"
            file_path = os.path.join(GENERATIONS_DIR, file_name)
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                response.raise_for_status()
                file_content = response.content
                
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(file_content)
                
            return f"/storage/generations/{file_name}"
        except Exception as e:
            logger.error(f"Failed to cache URL file: {str(e)}")
            # Fallback to returning original URL in case of network issues
            return url

storage_service = LocalStorageService()
