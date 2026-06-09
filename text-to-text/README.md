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

---

## 🦙 Ollama Integration & Model Management

### 1. Installation of Ollama
To run local models, you need to install Ollama:
- **macOS / Windows**: Download the installer from the [official Ollama download page](https://ollama.com/download).
- **Linux**: Install using the official script:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
- **Verification**: Verify that the installation is successful by running:
  ```bash
  ollama --version
  ```

### 2. Dynamically Discovered Models
The application dynamically fetches and groups all active models from your local Ollama instance. Currently, the following models on your machine are detected:
- **Ultra-Lightweight / Fast**:
  - `qwen2.5-coder:1.5b` (Qwen 2.5 Coder 1.5B)
  - `sadiq-bd/llama3.2-1b-uncensored:latest` (Llama 3.2 Uncensored 1.5B)
  - `llama3.2:1b` (Llama 3.2 1.2B)
  - `qwen2.5:0.5b` (Qwen 2.5 0.5B)
  - `XDPXI/Codex-0.2-Mini:0.5b` (Codex 0.2 Mini 0.5B)
- **Balanced / Lightweight**:
  - `llama3.2:latest` (Llama 3.2 3.2B) - Default model
  - `sadiq-bd/llama3.2-3b-uncensored:latest` (Llama 3.2 Uncensored 3.6B)
  - `phi3.5:latest` (Phi 3.5 3.8B)

### 3. Adding New Ollama Models (Fully Automated)
To configure and use a new model in the project, the process is fully automated:
1. **Pull the model locally** via Ollama CLI:
   ```bash
   ollama pull <model_name>
   ```
   *Example:*
   ```bash
   ollama pull mistral
   ```
2. **Automatic Detection & Categorization**: The backend `GET /api/v1/text-to-text/models` endpoint automatically detects the newly pulled model, parses its parameter size and family metadata, classifies it into a performance tier (e.g., *Ultra-Lightweight / Fast*, *Balanced / Lightweight*, *Standard / Capable*, or *Large / Advanced*), and marks whether it is an uncensored variant.
3. **UI Integration**: The frontend dynamic model dropdown groups and populates the model selector under the correct `optgroup` category automatically upon reloading the application. No manual code changes are required in either the frontend or backend!
