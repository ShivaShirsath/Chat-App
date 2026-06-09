import os
import re
import json
import httpx
import asyncio
import difflib
import subprocess
import platform
from typing import Callable, Awaitable
from app.core.config import settings

class AgentService:
    """
    Service that runs an autonomous agent loop using local Ollama models.
    Supports tool execution (read, write, list files, execute shell commands)
    and tracks file changes dynamically via unified diffs.
    """

    def __init__(self, base_url: str = settings.OLLAMA_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.response_queue = asyncio.Queue()

    def _generate_tree(self, path: str, max_depth: int = 3) -> str:
        lines = []
        def walk(current_path, prefix="", depth=1):
            if depth > max_depth:
                return
            try:
                items = sorted(os.listdir(current_path))
            except Exception:
                return
            
            # Filter ignored dirs
            filtered_items = []
            for item in items:
                if item in ["node_modules", ".git", "__pycache__", "venv", ".idea", ".vscode", "dist", "build"]:
                    continue
                filtered_items.append(item)
                
            for i, item in enumerate(filtered_items):
                is_last = (i == len(filtered_items) - 1)
                item_path = os.path.join(current_path, item)
                is_dir = os.path.isdir(item_path)
                
                connector = "└── " if is_last else "├── "
                display_name = f"{item}/" if is_dir else item
                lines.append(f"{prefix}{connector}{display_name}")
                
                if is_dir:
                    new_prefix = prefix + ("    " if is_last else "│   ")
                    walk(item_path, new_prefix, depth + 1)
                    
        walk(path)
        return "\n".join(lines)

    def _discover_environment(self, folder_path: str) -> str:
        env_info = []
        
        # 1. Check folder name & type
        env_info.append(f"Workspace Path: {folder_path}")
        env_info.append(f"Workspace Folder Name: {os.path.basename(folder_path)}")
        env_info.append(f"Operating System: {platform.system()} ({platform.release()})")

        # 2. Check installed system tools and versions
        system_tools = []
        for exec_cmd, label in [
            (["node", "-v"], "Node.js"),
            (["npm", "-v"], "NPM"),
            (["yarn", "-v"], "Yarn"),
            (["pnpm", "-v"], "PNPM"),
            (["bun", "-v"], "Bun"),
            (["python3", "--version"], "Python 3"),
            (["pip3", "--version"], "Pip 3"),
            (["git", "--version"], "Git"),
            (["docker", "--version"], "Docker"),
            (["go", "version"], "Go"),
            (["cargo", "--version"], "Cargo/Rust"),
            (["ruby", "-v"], "Ruby")
        ]:
            try:
                res = subprocess.run(exec_cmd, capture_output=True, text=True, timeout=1.5)
                if res.returncode == 0:
                    ver = res.stdout.strip().split("\n")[0]
                    system_tools.append(f"{label} ({ver})")
            except Exception:
                pass
        
        if system_tools:
            env_info.append(f"Available System Runtimes/CLI Tools: {', '.join(system_tools)}")
        else:
            env_info.append("Available System Runtimes/CLI Tools: None detected or subprocess error.")

        # 3. Detect and inspect key project files
        pkg_json = os.path.join(folder_path, "package.json")
        req_txt = os.path.join(folder_path, "requirements.txt")
        pyproj = os.path.join(folder_path, "pyproject.toml")
        tsconfig = os.path.join(folder_path, "tsconfig.json")
        git_dir = os.path.join(folder_path, ".git")
        dockerfile = os.path.join(folder_path, "Dockerfile")
        cargo_toml = os.path.join(folder_path, "Cargo.toml")
        gemfile = os.path.join(folder_path, "Gemfile")
        composer_json = os.path.join(folder_path, "composer.json")

        project_type_tags = []
        lib_info = []

        if os.path.exists(git_dir):
            project_type_tags.append("Git Repository")
            
        if os.path.exists(pkg_json):
            project_type_tags.append("NodeJS/NPM Project")
            try:
                with open(pkg_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    deps = data.get("dependencies", {}) or {}
                    dev_deps = data.get("devDependencies", {}) or {}
                    all_deps = {**deps, **dev_deps}
                    if all_deps:
                        deps_list = [f"{k}@{v}" for k, v in all_deps.items()]
                        lib_info.append(f"Node.js Packages: {', '.join(deps_list)}")
            except Exception as e:
                lib_info.append(f"Node.js package.json detected but failed to parse: {str(e)}")

        if os.path.exists(tsconfig):
            project_type_tags.append("TypeScript Context")

        if os.path.exists(req_txt):
            project_type_tags.append("Python Project (requirements.txt)")
            try:
                with open(req_txt, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
                    if lines:
                        lib_info.append(f"Python Packages (requirements.txt): {', '.join(lines)}")
            except Exception as e:
                lib_info.append(f"Python requirements.txt detected but failed to read: {str(e)}")

        if os.path.exists(pyproj):
            project_type_tags.append("Python Project (pyproject.toml)")

        if os.path.exists(dockerfile):
            project_type_tags.append("Docker Setup")

        if os.path.exists(cargo_toml):
            project_type_tags.append("Rust Cargo Project")

        if os.path.exists(gemfile):
            project_type_tags.append("Ruby Project")

        if os.path.exists(composer_json):
            project_type_tags.append("PHP Composer Project")

        if project_type_tags:
            env_info.append(f"Project Signatures Detected: {', '.join(project_type_tags)}")
        else:
            env_info.append("Project Signatures Detected: Generic / No standard configuration files.")

        if lib_info:
            env_info.append("Dependencies Discovered:\n" + "\n".join([f"  - {line}" for line in lib_info]))

        # 4. Generate visual tree structure of folder
        visual_tree = self._generate_tree(folder_path)
        if visual_tree:
            env_info.append("Workspace File Tree (up to 3 levels deep):\n" + visual_tree)
        else:
            env_info.append("Workspace File Tree: (Directory is empty)")

        return "\n".join(env_info)

    async def run_agent(
        self,
        folder_path: str,
        instruction: str,
        model_name: str,
        event_callback: Callable[[dict], Awaitable[None]]
    ):
        """
        Runs the agent loop on a target folder with the user instruction.
        Invokes event_callback to stream events to the client.
        """
        # Validate target folder
        if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
            await event_callback({
                "type": "error",
                "message": f"Target folder path does not exist or is not a directory: {folder_path}"
            })
            return

        # Initialize state
        file_diffs = {}  # rel_path -> diff_string
        history = []
        max_steps = 12
        step = 0
        
        # Read file list for initial context
        initial_files = self._get_folder_tree(folder_path)
        files_context = "\n".join(initial_files) if initial_files else "(No files in workspace)"
        
        # Run environment discovery
        env_discovered = self._discover_environment(folder_path)

        system_prompt = f"""You are an expert software engineering agent executing tasks in a local workspace directory.
You must be precise, safe, and scoped to the user's request.

YOUR ENVIRONMENT & OS CONTEXT:
{env_discovered}

CURRENT FILES IN WORKSPACE (FLAT LIST):
{files_context}

OPERATING SYSTEM: {platform.system()}

TOOLS AVAILABLE:
1. `list_dir`
   List all files in the current folder (or a sub-folder).
   Format:
   {{"tool": "list_dir", "parameters": {{"path": "optional_relative_subpath"}}}}

2. `read_file`
   Read the contents of a file.
   Format:
   {{"tool": "read_file", "parameters": {{"path": "relative_file_path"}}}}

3. `write_file`
   Write or overwrite a file with new contents.
   Format:
   {{"tool": "write_file", "parameters": {{"path": "relative_file_path", "content": "entire_file_contents_here"}}}}

4. `run_command`
   Run a shell command inside the folder.
   Format:
   {{"tool": "run_command", "parameters": {{"command": "shell_command_here"}}}}

5. `request_permission`
   If you are unsure about which way to proceed, need clarification from the user, or want the user to approve a major command/file change, call this tool to ask them.
   Format:
   {{"tool": "request_permission", "parameters": {{"question": "your question/clarification text", "options": ["option1", "option2", ...]}}}}

6. `finish`
   Indicate you have completed the task.
   Format:
   {{"tool": "finish", "parameters": {{"summary": "A detailed final response and summary of results, containing the files list, output details, or final answer to the user request. This will be shown directly to the user as the final response. If you read file lists or command outputs, include them in this summary."}}}}


RULES OF THUMB FOR HIGH PERFORMANCE AND CORRECTNESS:
- Strict Task Limitation: Do ONLY what is requested in the user's instruction. If the user instruction is 'list the files', your only goal is to list the files and folders and display them, then call `finish` immediately. Do NOT read package.json, edit code, or run startup servers unless the user instruction specifically asked you to do so. Doing extra steps is a severe safety violation.
- Precision Before Action: Prefer the smallest safe tool call that advances the requested task. For edits, read the relevant file first and modify only the necessary files.
- Safe Commands: Do not run destructive commands, install dependencies, start long-running servers, change git history, or access unrelated folders unless the user explicitly requests it or grants permission.
- Run Shell Commands for Listing: If the user explicitly asks to list files, list directories, or run commands, you should use the `run_command` tool to execute the native OS command (`ls` or `ls -la` for macOS/Darwin/Linux, `dir` for Windows). This shows the raw command execution processes in the user's terminal logs.
- Explore First: Check the file tree and flat list carefully. Read the relevant source files using `read_file` before making any modifications. Never overwrite files without knowing their current contents.
- Strict Permissions: If you are unsure of the user's intent, run into conflicting implementation ideas, or are about to run a destructive/installation command, you MUST use the `request_permission` tool. Do not guess.
- Single JSON Response: You must respond with EXACTLY one valid JSON object containing your thoughts and the action you want to take. Do not wrap it in markdown fences. Do not write text before or after the JSON object.

JSON RESPONSE FORMAT EXAMPLE:
{{
  "thought": "The user wants to list the files. Since the operating system is macOS (Darwin), I will run the native shell command 'ls' using the 'run_command' tool.",
  "action": {{
    "tool": "run_command",
    "parameters": {{
      "command": "ls"
    }}
  }}
}}
"""

        history.append({"role": "system", "content": system_prompt})
        history.append({"role": "user", "content": f"User Instruction: {instruction}"})

        # Clear queue
        while not self.response_queue.empty():
            self.response_queue.get_nowait()

        await event_callback({
            "type": "thought",
            "content": f"Discovered workspace runtimes & frameworks:\n{env_discovered}"
        })

        while step < max_steps:
            step += 1
            
            # Send current step to client
            await event_callback({
                "type": "thought",
                "content": f"Step {step}/{max_steps}: Querying model for next action..."
            })

            # Call Ollama API
            url = f"{self.base_url}/api/chat"
            payload = {
                "model": model_name,
                "messages": history,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1  # Low temperature for highly structured tool calls
                }
            }

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    response_text = data.get("message", {}).get("content", "")
            except Exception as e:
                await event_callback({
                    "type": "error",
                    "message": f"Failed to communicate with Ollama: {str(e)}"
                })
                break

            # Parse action
            parsed = self._parse_json(response_text)
            thought = parsed.get("thought", "Analyzing workspace...")
            action = parsed.get("action", {}) or {}
            tool = action.get("tool")
            params = action.get("parameters", {}) or {}

            # Append model's response to history
            history.append({"role": "assistant", "content": response_text})

            # Stream thought to client
            await event_callback({
                "type": "thought",
                "content": thought
            })

            if not tool:
                await event_callback({
                    "type": "error",
                    "message": f"Model failed to choose a valid tool. Output:\n{response_text}"
                })
                break

            # Execute tool
            tool_output = ""
            if tool == "finish":
                summary = params.get("summary", "Task completed.")
                await event_callback({
                    "type": "thought",
                    "content": f"Agent finished. Summary: {summary}"
                })
                await event_callback({
                    "type": "done",
                    "summary": summary
                })
                break

            elif tool == "request_permission":
                question = params.get("question", "Do I have permission to proceed?")
                options = params.get("options", ["Yes", "No"])
                
                await event_callback({
                    "type": "permission_request",
                    "question": question,
                    "options": options
                })
                
                # Wait for user input from the WebSocket queue
                try:
                    user_response = await asyncio.wait_for(self.response_queue.get(), timeout=300.0)
                    tool_output = f"User selected/answered: {user_response}"
                    await event_callback({
                        "type": "thought",
                        "content": f"User feedback received: {user_response}"
                    })
                except asyncio.TimeoutError:
                    tool_output = "Error: User response timed out after 5 minutes."
                    await event_callback({
                        "type": "error",
                        "message": "User response timed out."
                    })
                    break

            elif tool == "list_dir":
                subpath = params.get("path", "") or ""
                target = os.path.join(folder_path, subpath)
                if not os.path.abspath(target).startswith(os.path.abspath(folder_path)):
                    tool_output = "Error: Path traversal detected. You cannot escape the target workspace folder."
                elif not os.path.exists(target):
                    tool_output = f"Error: Path does not exist: {subpath}"
                else:
                    try:
                        items = os.listdir(target)
                        tool_output = f"Files in {subpath or '/'}:\n" + "\n".join(items)
                        await event_callback({
                            "type": "terminal",
                            "content": f"[TOOL CALL] list_dir({subpath})\nResult: {len(items)} items found.\n"
                        })
                    except Exception as e:
                        tool_output = f"Error listing directory: {str(e)}"

            elif tool == "read_file":
                rel_path = params.get("path", "")
                target = os.path.join(folder_path, rel_path)
                if not os.path.abspath(target).startswith(os.path.abspath(folder_path)):
                    tool_output = "Error: Path traversal detected."
                elif not os.path.exists(target):
                    tool_output = f"Error: File not found: {rel_path}"
                else:
                    try:
                        with open(target, "r", encoding="utf-8") as f:
                            tool_output = f.read()
                        await event_callback({
                            "type": "terminal",
                            "content": f"[TOOL CALL] read_file({rel_path})\nResult: Read {len(tool_output)} characters.\n"
                        })
                    except Exception as e:
                        tool_output = f"Error reading file: {str(e)}"

            elif tool == "write_file":
                rel_path = params.get("path", "")
                content = params.get("content", "")
                target = os.path.join(folder_path, rel_path)
                if not os.path.abspath(target).startswith(os.path.abspath(folder_path)):
                    tool_output = "Error: Path traversal detected."
                else:
                    try:
                        os.makedirs(os.path.dirname(target), exist_ok=True)
                        original_content = ""
                        if os.path.exists(target):
                            with open(target, "r", encoding="utf-8", errors="ignore") as f:
                                original_content = f.read()
                        
                        with open(target, "w", encoding="utf-8") as f:
                            f.write(content)
                        
                        tool_output = f"Successfully wrote file to {rel_path}"
                        await event_callback({
                            "type": "terminal",
                            "content": f"[TOOL CALL] write_file({rel_path})\nResult: Wrote {len(content)} characters.\n"
                        })
                        
                        # Generate diff
                        orig_lines = original_content.splitlines(keepends=True)
                        new_lines = content.splitlines(keepends=True)
                        diff = list(difflib.unified_diff(
                            orig_lines,
                            new_lines,
                            fromfile=f"a/{rel_path}",
                            tofile=f"b/{rel_path}"
                        ))
                        diff_str = "".join(diff)
                        file_diffs[rel_path] = diff_str
                        
                        # Stream the updated diffs to client
                        await event_callback({
                            "type": "diff",
                            "diffs": file_diffs
                        })
                    except Exception as e:
                        tool_output = f"Error writing file: {str(e)}"

            elif tool == "run_command":
                cmd = params.get("command", "")
                if not cmd:
                    tool_output = "Error: No command specified."
                else:
                    await event_callback({
                        "type": "terminal",
                        "content": f"$ {cmd}\n"
                    })
                    try:
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(
                            None,
                            lambda: subprocess.run(
                                cmd,
                                shell=True,
                                cwd=folder_path,
                                capture_output=True,
                                text=True,
                                timeout=15.0
                            )
                        )
                        stdout_str = result.stdout or ""
                        stderr_str = result.stderr or ""
                        exit_code = result.returncode
                        
                        terminal_log = ""
                        if stdout_str:
                            terminal_log += stdout_str
                        if stderr_str:
                            terminal_log += stderr_str
                        terminal_log += f"\nProcess exited with code {exit_code}\n"
                        
                        await event_callback({
                            "type": "terminal",
                            "content": terminal_log
                        })
                        
                        tool_output = f"Exit code: {exit_code}\nOutput:\n{stdout_str}\n{stderr_str}"
                    except subprocess.TimeoutExpired:
                        await event_callback({
                            "type": "terminal",
                            "content": "Command timed out (exceeded 15s limit).\n"
                        })
                        tool_output = "Error: Command timed out after 15 seconds."
                    except Exception as e:
                        await event_callback({
                            "type": "terminal",
                            "content": f"Command execution failed: {str(e)}\n"
                        })
                        tool_output = f"Error executing command: {str(e)}"
            else:
                tool_output = f"Error: Unknown tool '{tool}'."

            # Feed tool result back to the model
            history.append({"role": "user", "content": f"Tool output:\n{tool_output}"})
            
        else:
            # Reached max steps
            await event_callback({
                "type": "error",
                "message": "Max steps reached without finishing."
            })

    def _get_folder_tree(self, path: str) -> list:
        file_list = []
        try:
            for root, dirs, files in os.walk(path):
                # Ignore common folders
                if any(ignored in root for ignored in ["node_modules", ".git", "__pycache__", "venv"]):
                    continue
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, path)
                    file_list.append(rel_path)
        except Exception:
            pass
        return file_list[:100]  # Cap context at first 100 files

    def _normalize_parsed(self, parsed: dict) -> dict:
        """
        Normalizes the parsed JSON dictionary to be extremely robust.
        - Supports root-level 'tool' and 'parameters'.
        - Maps alternate parameter names.
        """
        normalized = {
            "thought": parsed.get("thought", "Analyzing workspace..."),
            "action": {}
        }
        
        # Extract action block or fall back to root-level keys. Some smaller
        # models put tool parameters directly beside the tool name, so keep a
        # root-level parameter fallback as well.
        action = parsed.get("action")
        if isinstance(action, dict):
            tool = action.get("tool")
            params = action.get("parameters")
        else:
            tool = parsed.get("tool")
            params = parsed.get("parameters")

        direct_params = {
            key: parsed.get(key)
            for key in (
                "command", "cmd", "path", "file", "filename", "content",
                "text", "dir", "folder", "question", "prompt", "options",
                "summary", "result", "response"
            )
            if parsed.get(key) is not None
        }
            
        if not tool:
            return normalized
            
        if not isinstance(params, dict):
            params = {}
        params = {**direct_params, **params}
            
        # Normalize tool names
        tool = tool.strip().lower()
        
        # Normalize parameter keys based on the tool
        normalized_params = {}
        if tool == "run_command":
            cmd = params.get("command") or params.get("cmd") or ""
            normalized_params["command"] = cmd
        elif tool == "write_file":
            path = params.get("path") or params.get("file") or params.get("filename") or ""
            content = params.get("content") or params.get("text") or ""
            normalized_params["path"] = path
            normalized_params["content"] = content
        elif tool == "read_file":
            path = params.get("path") or params.get("file") or params.get("filename") or ""
            normalized_params["path"] = path
        elif tool == "list_dir":
            path = params.get("path") or params.get("dir") or params.get("folder") or ""
            normalized_params["path"] = path
        elif tool == "request_permission":
            question = params.get("question") or params.get("prompt") or "Do I have permission to proceed?"
            options = params.get("options") or ["Yes", "No"]
            normalized_params["question"] = question
            normalized_params["options"] = options
        elif tool == "finish":
            summary = params.get("summary") or params.get("result") or params.get("response") or "Task completed."
            normalized_params["summary"] = summary
        else:
            # Keep original params for custom tools
            normalized_params = params
            
        normalized["action"] = {
            "tool": tool,
            "parameters": normalized_params
        }
        return normalized

    def _parse_json(self, text: str) -> dict:
        stripped = text.strip()
        
        # Remove markdown code fence blocks if present
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            stripped = "\n".join(lines).strip()
            
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start != -1 and end != -1:
            stripped = stripped[start:end+1]
            
        try:
            parsed = json.loads(stripped)
            return self._normalize_parsed(parsed)
        except Exception:
            # Fallback regex parser for small models
            import re
            thought_match = re.search(r'"thought"\s*:\s*"([^"]+)"', stripped)
            tool_match = re.search(r'"tool"\s*:\s*"([^"]+)"', stripped)
            
            thought = thought_match.group(1) if thought_match else "Analyzing..."
            tool = tool_match.group(1) if tool_match else None
            
            parsed_fallback = {
                "thought": thought,
                "tool": tool,
                "parameters": {}
            }
            
            if tool == "finish":
                summary_match = re.search(r'"summary"\s*:\s*"([^"]+)"', stripped)
                parsed_fallback["parameters"]["summary"] = summary_match.group(1) if summary_match else "Task completed."
            elif tool == "request_permission":
                q_match = re.search(r'"question"\s*:\s*"([^"]+)"', stripped)
                parsed_fallback["parameters"]["question"] = q_match.group(1) if q_match else "Do I have permission to proceed?"
            elif tool == "write_file":
                path_match = re.search(r'"path"\s*:\s*"([^"]+)"', stripped)
                content_match = re.search(r'"content"\s*:\s*"([\s\S]+?)"\s*\}\s*\}', stripped)
                if path_match and content_match:
                    parsed_fallback["parameters"]["path"] = path_match.group(1)
                    try:
                        parsed_fallback["parameters"]["content"] = content_match.group(1).encode().decode('unicode-escape')
                    except Exception:
                        parsed_fallback["parameters"]["content"] = content_match.group(1)
            elif tool == "run_command":
                cmd_match = re.search(r'"command"\s*:\s*"([^"]+)"', stripped)
                if cmd_match:
                    parsed_fallback["parameters"]["command"] = cmd_match.group(1)
            
            return self._normalize_parsed(parsed_fallback)
