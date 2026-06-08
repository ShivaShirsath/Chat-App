import time
import asyncio
import urllib.parse
from typing import AsyncGenerator
from app.services.base import BaseModelService
from app.schemas.chat import ChatRequest, ChatResponse, ChatResponseChunk, Choice, ChatMessage, ChoiceChunk, MessageDelta

class TextToImageService(BaseModelService):
    """
    Mock service for Text-to-Image generation.
    Returns high-quality Picsum photos seeded by prompt.
    """
    async def generate(self, request: ChatRequest) -> ChatResponse:
        prompt = request.messages[-1].content
        slug = urllib.parse.quote_plus(prompt[:30])
        # Use Picsum with prompt-based seed to get consistent beautiful images
        image_url = f"https://picsum.photos/seed/{slug}/800/600"
        
        assistant_message = ChatMessage(
            role="assistant",
            content=f"I have generated a custom image based on your prompt: **\"{prompt}\"**.\n\nHere is your render:"
        )
        
        return ChatResponse(
            id=f"img-{int(time.time())}",
            created=int(time.time()),
            model="mock-text-to-image-v1",
            choices=[Choice(index=0, message=assistant_message, finish_reason="stop")],
            media_url=image_url,
            media_type="image"
        )

    async def generate_stream(self, request: ChatRequest) -> AsyncGenerator[ChatResponseChunk, None]:
        prompt = request.messages[-1].content
        slug = urllib.parse.quote_plus(prompt[:30])
        image_url = f"https://picsum.photos/seed/{slug}/800/600"
        
        steps = [
            "Parsing prompt details... 🔍",
            "Synthesizing visual concepts... 🎨",
            "Enhancing resolution and lighting... ⚡",
            f"Rendering completed! Finalizing output image...\n\nHere is your render for **\"{prompt}\"**:"
        ]
        
        for i, step in enumerate(steps):
            await asyncio.sleep(0.8)  # Simulate generation delay
            yield ChatResponseChunk(
                id=f"img-stream-{int(time.time())}",
                created=int(time.time()),
                model="mock-text-to-image-v1",
                choices=[
                    ChoiceChunk(
                        index=0,
                        delta=MessageDelta(role="assistant", content=step if i == 0 else f"\n{step}"),
                        finish_reason="stop" if i == len(steps) - 1 else None
                    )
                ],
                # Include the media payload in the final chunk
                media_url=image_url if i == len(steps) - 1 else None,
                media_type="image" if i == len(steps) - 1 else None
            )


class TextAndImageToImageService(BaseModelService):
    """
    Mock service for Image-to-Image / Multimodal editing.
    Reads input image and generates modified output.
    """
    async def generate(self, request: ChatRequest) -> ChatResponse:
        user_msg = request.messages[-1]
        prompt = user_msg.content
        
        # Determine seed based on prompt
        slug = urllib.parse.quote_plus(prompt[:30])
        image_url = f"https://picsum.photos/seed/edit-{slug}/800/600"
        
        assistant_message = ChatMessage(
            role="assistant",
            content=f"Analyzed input image successfully. Applying edits based on prompt: **\"{prompt}\"**.\n\nHere is the edited image:"
        )
        
        return ChatResponse(
            id=f"img2img-{int(time.time())}",
            created=int(time.time()),
            model="mock-img2img-v1",
            choices=[Choice(index=0, message=assistant_message, finish_reason="stop")],
            media_url=image_url,
            media_type="image"
        )

    async def generate_stream(self, request: ChatRequest) -> AsyncGenerator[ChatResponseChunk, None]:
        prompt = request.messages[-1].content
        slug = urllib.parse.quote_plus(prompt[:30])
        image_url = f"https://picsum.photos/seed/edit-{slug}/800/600"
        
        steps = [
            "Analyzing source image composition and structures... 🖼️",
            "Aligning editing mask with text prompt instructions... 🎯",
            "Blending generated diffusions with original elements... 🧬",
            f"Edits successfully merged! Here is the modified output:"
        ]
        
        for i, step in enumerate(steps):
            await asyncio.sleep(0.8)
            yield ChatResponseChunk(
                id=f"img2img-stream-{int(time.time())}",
                created=int(time.time()),
                model="mock-img2img-v1",
                choices=[
                    ChoiceChunk(
                        index=0,
                        delta=MessageDelta(role="assistant", content=step if i == 0 else f"\n{step}"),
                        finish_reason="stop" if i == len(steps) - 1 else None
                    )
                ],
                media_url=image_url if i == len(steps) - 1 else None,
                media_type="image" if i == len(steps) - 1 else None
            )


class TextToVideoService(BaseModelService):
    """
    Mock service for Text-to-Video generation.
    Returns high-quality loopable stock video.
    """
    async def generate(self, request: ChatRequest) -> ChatResponse:
        prompt = request.messages[-1].content
        # High quality sample video link
        video_url = "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4"
        
        assistant_message = ChatMessage(
            role="assistant",
            content=f"Custom video render complete for prompt: **\"{prompt}\"**.\n\nYou can watch or download the clip below:"
        )
        
        return ChatResponse(
            id=f"vid-{int(time.time())}",
            created=int(time.time()),
            model="mock-text-to-video-v1",
            choices=[Choice(index=0, message=assistant_message, finish_reason="stop")],
            media_url=video_url,
            media_type="video"
        )

    async def generate_stream(self, request: ChatRequest) -> AsyncGenerator[ChatResponseChunk, None]:
        prompt = request.messages[-1].content
        video_url = "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4"
        
        steps = [
            "Decomposing prompt into keyframes... 🎞️",
            "Simulating fluid dynamics and camera motion... 🎥",
            "Synthesizing high frame rate video packets... ⚙️",
            f"Video rendering complete! Enjoy the clip:"
        ]
        
        for i, step in enumerate(steps):
            await asyncio.sleep(0.9)
            yield ChatResponseChunk(
                id=f"vid-stream-{int(time.time())}",
                created=int(time.time()),
                model="mock-text-to-video-v1",
                choices=[
                    ChoiceChunk(
                        index=0,
                        delta=MessageDelta(role="assistant", content=step if i == 0 else f"\n{step}"),
                        finish_reason="stop" if i == len(steps) - 1 else None
                    )
                ],
                media_url=video_url if i == len(steps) - 1 else None,
                media_type="video" if i == len(steps) - 1 else None
            )
