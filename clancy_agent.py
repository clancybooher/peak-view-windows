#!/usr/bin/env python3
"""
Peak View Windows and Doors — Zero-Slop Website Agent
Clancy Booher | peakvieworegon.com | 541-639-3968
"""

import os
import sys
import re
import threading
import webbrowser
from pathlib import Path

import anthropic
from typing import Optional
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.syntax import Syntax
from rich.theme import Theme

# ── setup ──────────────────────────────────────────────────────────────────

WORKSPACE = Path(__file__).parent
STYLE_GUIDE_PATH = WORKSPACE / "master-style-guide-v6.0.md"

theme = Theme({
    "info": "bold cyan",
    "warn": "bold yellow",
    "success": "bold green",
    "error": "bold red",
    "agent": "bold magenta",
})
console = Console(theme=theme)


def load_style_guide() -> str:
    if not STYLE_GUIDE_PATH.exists():
        console.print("[error]master-style-guide-v6.0.md not found. Run from workspace root.[/error]")
        sys.exit(1)
    return STYLE_GUIDE_PATH.read_text()


STYLE_GUIDE = load_style_guide()

SYSTEM_PROMPT = f"""You are the Zero-Slop Website Agent for Peak View Windows and Doors, Clancy Booher's residential window and door installation business in Bend, Oregon.

Your entire purpose is to generate copy, HTML, and website content that strictly follows the Master Style Guide below. You have read and internalized every rule. You never break them.

You can also read, analyze, and edit website files in the workspace when asked.

When generating copy: output clean Markdown unless HTML is explicitly requested.
When generating HTML: output complete, self-contained files with Tailwind CDN. Always include real CTAs with phone number 541-639-3968.
When editing files: read the current file content first, then apply changes precisely.
When asked for a live preview: generate a self-contained HTML file and name it appropriately.

Never explain your reasoning unless asked. Just produce the output.

---

{STYLE_GUIDE}
"""

# ── anthropic client ────────────────────────────────────────────────────────

def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print("[error]ANTHROPIC_API_KEY environment variable not set.[/error]")
        console.print("Set it with: export ANTHROPIC_API_KEY=your-key-here")
        sys.exit(1)
    return anthropic.Anthropic(api_key=api_key)


# ── file utilities ──────────────────────────────────────────────────────────

def list_site_files() -> list[Path]:
    extensions = {".html", ".css", ".js", ".md"}
    return sorted(f for f in WORKSPACE.iterdir() if f.suffix in extensions and f.is_file())


def read_file(path: Path) -> str:
    try:
        return path.read_text()
    except Exception as e:
        return f"[Error reading file: {e}]"


def write_file(path: Path, content: str) -> None:
    path.write_text(content)
    console.print(f"[success]Wrote {path.name}[/success]")


def resolve_file(name: str) -> Optional[Path]:
    candidates = [
        WORKSPACE / name,
        WORKSPACE / (name + ".html"),
        WORKSPACE / (name + ".css"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


# ── preview server ──────────────────────────────────────────────────────────

_server_thread: Optional[threading.Thread] = None
_server_port = 8742


def start_preview_server(port: int = _server_port) -> None:
    global _server_thread
    if _server_thread and _server_thread.is_alive():
        console.print(f"[info]Preview server already running at http://localhost:{port}[/info]")
        webbrowser.open(f"http://localhost:{port}")
        return

    from flask import Flask, send_from_directory
    app = Flask(__name__, static_folder=str(WORKSPACE))

    @app.route("/")
    def index():
        return send_from_directory(str(WORKSPACE), "index.html")

    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory(str(WORKSPACE), filename)

    def run():
        app.run(port=port, debug=False, use_reloader=False)

    _server_thread = threading.Thread(target=run, daemon=True)
    _server_thread.start()
    console.print(f"[success]Preview server started at http://localhost:{port}[/success]")
    webbrowser.open(f"http://localhost:{port}")


# ── command parsing ─────────────────────────────────────────────────────────

def parse_command(text: str) -> dict:
    lower = text.lower().strip()

    if lower in {"quit", "exit", "q"}:
        return {"type": "quit"}

    if lower in {"help", "?"}:
        return {"type": "help"}

    if lower in {"files", "ls", "list"}:
        return {"type": "list_files"}

    if lower in {"preview", "serve", "start server", "start preview"}:
        return {"type": "preview"}

    # "preview <file>" or "open <file>"
    m = re.match(r"(?:preview|open|view)\s+(.+)", lower)
    if m:
        return {"type": "preview_file", "file": m.group(1).strip()}

    # "read <file>" or "show <file>"
    m = re.match(r"(?:read|show|cat)\s+(.+)", lower)
    if m:
        return {"type": "read_file", "file": m.group(1).strip()}

    # "edit <file>" or "update <file>"
    m = re.match(r"(?:edit|update|modify|fix)\s+(.+?)(?:\s*[:-]\s*(.+))?$", text.strip())
    if m:
        return {"type": "edit_file", "file": m.group(1).strip(), "instruction": m.group(2) or ""}

    # "save <content> as <filename>" or "save to <filename>"
    m = re.match(r"save\s+(?:to|as)\s+(.+)", lower)
    if m:
        return {"type": "save_pending", "file": m.group(1).strip()}

    # everything else goes to the AI
    return {"type": "generate", "prompt": text}


# ── conversation history ────────────────────────────────────────────────────

history: list[dict] = []
last_output: str = ""


# ── AI call ─────────────────────────────────────────────────────────────────

def call_ai(client: anthropic.Anthropic, user_message: str, extra_context: str = "") -> str:
    global last_output

    full_message = user_message
    if extra_context:
        full_message = f"{extra_context}\n\n---\n\n{user_message}"

    history.append({"role": "user", "content": full_message})

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=history,
    )

    result = response.content[0].text
    history.append({"role": "assistant", "content": result})
    last_output = result
    return result


# ── command handlers ────────────────────────────────────────────────────────

def handle_help() -> None:
    console.print(Panel(
        """[bold]COMMANDS[/bold]

[info]Content generation:[/info]
  Homepage hero              Generate hero section copy
  Full Windows page          Generate complete windows page copy
  Full Doors page            Generate complete doors page copy
  About section              Generate About section copy
  Contact section            Generate contact/CTA section
  [any natural language]     Generate copy for any request

[info]File operations:[/info]
  files                      List site files
  read index.html            Read a file
  edit index.html: [instruction]   Edit a file with AI
  save to preview.html       Save last output to file

[info]Preview:[/info]
  preview                    Start local server at :8742
  preview index.html         Open specific file in browser

[info]Other:[/info]
  help                       This menu
  quit / exit                Exit agent

[dim]All copy follows Zero-Slop Style Guide v6.0 automatically.[/dim]""",
        title="Peak View Website Agent",
        border_style="magenta",
    ))


def handle_list_files() -> None:
    files = list_site_files()
    console.print("[info]Site files:[/info]")
    for f in files:
        size = f.stat().st_size
        console.print(f"  {f.name} [dim]({size:,} bytes)[/dim]")


def handle_read(file_name: str) -> None:
    path = resolve_file(file_name)
    if not path:
        console.print(f"[error]File not found: {file_name}[/error]")
        return
    content = read_file(path)
    if path.suffix in {".html", ".css", ".js"}:
        console.print(Syntax(content, path.suffix.lstrip("."), theme="monokai", line_numbers=True))
    else:
        console.print(content)


def handle_edit(client: anthropic.Anthropic, file_name: str, instruction: str) -> None:
    path = resolve_file(file_name)
    if not path:
        console.print(f"[error]File not found: {file_name}[/error]")
        return

    content = read_file(path)
    if not instruction:
        instruction = Prompt.ask("What do you want to change")

    context = f"Current content of {path.name}:\n\n```\n{content}\n```"
    prompt = f"Edit {path.name} as follows: {instruction}\n\nReturn the complete updated file content only. No explanation."

    console.print(f"[info]Editing {path.name}...[/info]")
    result = call_ai(client, prompt, context)

    # strip markdown code fences if present
    result = re.sub(r"^```[a-z]*\n", "", result)
    result = re.sub(r"\n```$", "", result)

    write_file(path, result)
    console.print(f"[success]{path.name} updated.[/success]")


def handle_preview_file(file_name: str) -> None:
    path = resolve_file(file_name)
    if not path:
        console.print(f"[error]File not found: {file_name}[/error]")
        return
    start_preview_server()
    webbrowser.open(f"http://localhost:{_server_port}/{path.name}")


def handle_save(file_name: str) -> None:
    global last_output
    if not last_output:
        console.print("[warn]No output to save yet.[/warn]")
        return
    path = WORKSPACE / file_name
    write_file(path, last_output)
    console.print(f"[success]Saved to {path.name}[/success]")


def handle_generate(client: anthropic.Anthropic, prompt: str) -> None:
    # if the prompt mentions a real file, attach its content as context
    extra = ""
    for f in list_site_files():
        if f.name.lower() in prompt.lower():
            extra = f"Current content of {f.name}:\n\n```\n{read_file(f)}\n```"
            break

    console.print("[info]Generating...[/info]")

    with console.status("[agent]Working...[/agent]"):
        result = call_ai(client, prompt, extra)

    # detect if result is HTML
    if result.strip().startswith("<!") or "<html" in result[:200]:
        # save as temp preview
        preview_path = WORKSPACE / "_preview.html"
        write_file(preview_path, result)
        console.print(f"[success]HTML output saved to _preview.html[/success]")
        console.print(Syntax(result[:2000] + ("..." if len(result) > 2000 else ""), "html", theme="monokai"))
        open_it = Prompt.ask("Open in browser?", choices=["y", "n"], default="y")
        if open_it == "y":
            start_preview_server()
            webbrowser.open(f"http://localhost:{_server_port}/_preview.html")
    else:
        console.print(Markdown(result))

    console.print(f"\n[dim]({len(result)} chars | say 'save to filename.html' to save)[/dim]")


# ── main loop ───────────────────────────────────────────────────────────────

def main() -> None:
    console.print(Panel(
        "[bold magenta]Peak View Windows and Doors[/bold magenta]\n"
        "[bold]Zero-Slop Website Agent v6.0[/bold]\n\n"
        "Style guide loaded. Claude ready.\n"
        "Type [bold]help[/bold] for commands or just describe what you need.",
        border_style="magenta",
    ))

    client = get_client()

    while True:
        try:
            raw = Prompt.ask("\n[bold magenta]>[/bold magenta]")
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Exiting.[/dim]")
            break

        raw = raw.strip()
        if not raw:
            continue

        cmd = parse_command(raw)
        ctype = cmd["type"]

        if ctype == "quit":
            console.print("[dim]Done.[/dim]")
            break
        elif ctype == "help":
            handle_help()
        elif ctype == "list_files":
            handle_list_files()
        elif ctype == "preview":
            start_preview_server()
        elif ctype == "preview_file":
            handle_preview_file(cmd["file"])
        elif ctype == "read_file":
            handle_read(cmd["file"])
        elif ctype == "edit_file":
            handle_edit(client, cmd["file"], cmd.get("instruction", ""))
        elif ctype == "save_pending":
            handle_save(cmd["file"])
        elif ctype == "generate":
            try:
                handle_generate(client, cmd["prompt"])
            except anthropic.APIError as e:
                console.print(f"[error]API error: {e}[/error]")
            except Exception as e:
                console.print(f"[error]Error: {e}[/error]")


if __name__ == "__main__":
    main()
