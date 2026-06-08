from app.services.base import BaseModelService
from app.services.ollama_service import OllamaService
from app.services.mock_services import TextToImageService, TextAndImageToImageService, TextToVideoService

def get_text_to_text_service() -> BaseModelService:
    return OllamaService()

def get_text_to_image_service() -> BaseModelService:
    return TextToImageService()

def get_text_and_image_to_image_service() -> BaseModelService:
    return TextAndImageToImageService()

def get_text_to_video_service() -> BaseModelService:
    return TextToVideoService()
