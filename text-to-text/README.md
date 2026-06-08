# Multimodal AI Gateway & Playground

An industry-ready, SOLID-compliant, extensible API gateway and unified chat interface. It acts as a single gateway that routes chat, image generation, editing, and video requests to various local and remote models over HTTP, Server-Sent Events (SSE) streaming, and bidirectional WebSockets.

---

## 🛠️ Architecture & SOLID Principles

The backend is built using Python 3.14+ and FastAPI. It strictly implements the following software design principles:

1. **Single Responsibility Principle (SRP):**
   - Routes (`app/api/`) only manage HTTP/WS connections and serialize request payloads.
   - Services (`app/services/`) contain pure domain logic for interacting with model engines (Ollama, mock synthesizers).
2. **Open/Closed Principle (OCP):**
   - All engines inherit from the abstract contract `BaseModelService`.
   - New model APIs (e.g., OpenAI, Replicate, local Stable Diffusion) can be plugged in by creating a new service class without modifying any router endpoints.
3. **Liskov Substitution Principle (LSP):**
   - Services can be swapped dynamically at runtime using the Unified WebSocket route.
4. **Interface Segregation (ISP) & Dependency Inversion (DIP):**
   - Sub-services depend on abstract method interfaces. FastAPI's Dependency Injection system compiles and provides concrete service instances at runtime.

---

## ⚙️ Ports and Endpoint Maps

The backend runs on port **`8001`** (avoiding port `8000` collisions):

### HTTP REST / SSE Routes
- `POST /api/v1/text-to-text/chat` - Chats with local Ollama (`llama3.2:latest`, `llama3.2:1b`, etc.).
- `POST /api/v1/text-to-image/chat` - Scaffolds text-to-image mock generation.
- `POST /api/v1/text-and-image-to-image/chat` - Image editing using uploaded base64 inputs.
- `POST /api/v1/text-to-video/chat` - Video synthesis stub.

### WebSockets
- `WS /api/v1/ws` - Unified WebSocket interface. Receives a structured payload containing `"type"` (e.g. `text-to-text`) and `"payload"` (chat parameters), returning streamed response chunks dynamically.

---

## 💻 Frontend Client
The React + TS + Tailwind v4 frontend client features:
- **Automatic Reconnection:** WebSocket state machine recovers if gateway restarts.
- **Pure State Updates:** Prevents token duplication issues caused by React StrictMode double rendering.
- **Model Switcher:** Quick options in the sidebar to swap active Ollama models.
- **Interactive Renderers:** Special card renders for text formatting, zoomable image outputs, and standard video player cards.
