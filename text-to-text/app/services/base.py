from abc import ABC, abstractmethod
from typing import AsyncGenerator
from app.schemas.chat import ChatRequest, ChatResponse, ChatResponseChunk

class BaseModelService(ABC):
    """
    Abstract Base Class representing a Model Service.
    Follows Dependency Inversion Principle (DIP) and Interface Segregation.
    """
    
    @abstractmethod
    async def generate(self, request: ChatRequest) -> ChatResponse:
        """
        Generate a complete response for a given chat request.
        """
        pass

    @abstractmethod
    async def generate_stream(self, request: ChatRequest) -> AsyncGenerator[ChatResponseChunk, None]:
        """
        Stream back chunks of response for a given chat request.
        """
        pass
        # Yield syntax is expected in subclass
