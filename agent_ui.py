#!/usr/bin/env python3
"""
Peak View Windows — Web UI for the Zero-Slop Agent
Opens in your browser at http://localhost:5050
"""

import os
import threading
from pathlib import Path

import anthropic
from flask import Flask, request, jsonify, send_from_directory, Response

WORKSPACE = Path(__file__).parent
STYLE_GUIDE_PATH = WORKSPACE / "master-style-guide-v6.0.md"
STYLE_GUIDE = STYLE_GUIDE_PATH.read_text()

SYSTEM_PROMPT = f"""You are the Zero-Slop Website Agent for Peak View Windows and Doors, Clancy Booher's residential window and door installation business in Bend, Oregon.

Your entire purpose is to generate copy, HTML, and website content that strictly follows the Master Style Guide below. You never break the rules.

When asked for copy: produce clean Markdown.
When asked to write or update a file: return the complete updated file wrapped in a fenced code block labeled with the filename, like this:

```html:index.html
...full file content here...
```

Always return the full file, never a partial snippet.
Never explain unless asked. Just produce the output.

---

{STYLE_GUIDE}
"""

app = Flask(__name__)
history = []
SITE_EXTENSIONS = {".html", ".css", ".js"}

def get_client():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=key)

def list_site_files():
    files = [
        {"name": f.name, "size": f.stat().st_size}
        for f in WORKSPACE.iterdir()
        if f.suffix in SITE_EXTENSIONS and f.is_file()
    ]
    return sorted(files, key=lambda x: x["name"])

def read_site_file(name):
    path = WORKSPACE / name
    if not path.exists() or path.suffix not in SITE_EXTENSIONS:
        return None
    return path.read_text()

def write_site_file(name, content):
    path = WORKSPACE / name
    if path.suffix not in SITE_EXTENSIONS:
        return False
    path.write_text(content)
    return True

# ── HTML (returned as raw Response to avoid Jinja2 processing JS template literals) ──

PAGE_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Peak View — Website Agent</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --black:#0a0a0a;--dark:#141414;--card:#1e1e1e;--border:#2a2a2a;
  --text:#e8e8e8;--dim:#777;--red:#c0392b;--red2:#a93226;
  --green:#27ae60;--mono:'SF Mono','Fira Code','Courier New',monospace
}
body{background:var(--black);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{background:var(--dark);border-bottom:1px solid var(--border);padding:11px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0}
header h1{font-size:14px;font-weight:600}
header span{font-size:12px;color:var(--dim);margin-left:auto}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green)}
.layout{display:flex;flex:1;overflow:hidden}

/* sidebar */
aside{width:200px;background:var(--dark);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}
.s-title{font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;padding:12px 14px 6px}
.s-title.sep{border-top:1px solid var(--border);margin-top:4px;padding-top:10px}
.file-list{overflow-y:auto;max-height:200px}
.fi{display:flex;align-items:center;gap:7px;padding:6px 14px;cursor:pointer;font-size:12px;color:var(--text)}
.fi:hover{background:var(--card)}
.fi .ext{font-size:9px;color:var(--dim);font-family:var(--mono);background:var(--border);padding:1px 4px;border-radius:3px;flex-shrink:0}
.qb{display:block;width:calc(100% - 20px);margin:2px 10px;padding:6px 10px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:11px;text-align:left;cursor:pointer;border-radius:5px}
.qb:hover{border-color:var(--red);color:#fff}

/* preview toggle */
.preview-btns{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--border);margin-top:auto}
.pbtn{flex:1;padding:5px;font-size:11px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:4px;cursor:pointer}
.pbtn.active{border-color:var(--red);color:var(--red)}

/* chat */
.chat-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.msg{max-width:820px;width:100%}
.msg.user{align-self:flex-end}
.msg.user .bubble{background:var(--red);color:#fff;border-radius:14px 14px 4px 14px;padding:10px 14px;font-size:13px;line-height:1.5;white-space:pre-wrap}
.msg.agent{align-self:flex-start}
.msg.agent .bubble{background:var(--card);border:1px solid var(--border);border-radius:4px 14px 14px 14px;padding:14px 16px;font-size:13px;line-height:1.7}
.lbl{font-size:10px;color:var(--dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
.bubble h1,.bubble h2,.bubble h3{color:#fff;margin:12px 0 5px;font-size:14px}
.bubble p{margin-bottom:9px}
.bubble p:last-of-type{margin-bottom:0}
.bubble ul,.bubble ol{padding-left:18px;margin-bottom:9px}
.bubble li{margin-bottom:3px}
.bubble strong{color:#fff}
.bubble em{color:#ccc}
.bubble code{font-family:var(--mono);font-size:11px;background:var(--border);padding:1px 5px;border-radius:3px}
.bubble pre{background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:12px;overflow-x:auto;margin:10px 0}
.bubble pre code{background:none;padding:0;font-size:11px;line-height:1.6;color:#d4d4d4}
.file-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.apply-btn{font-size:11px;padding:5px 12px;border-radius:5px;border:1px solid var(--green);background:transparent;color:var(--green);cursor:pointer}
.apply-btn:hover{background:var(--green);color:#000}
.apply-btn.done{background:var(--green);color:#000;pointer-events:none}

/* input */
.input-bar{border-top:1px solid var(--border);padding:12px 16px;display:flex;gap:8px;flex-shrink:0;background:var(--dark)}
#inp{flex:1;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 13px;font-size:13px;font-family:inherit;resize:none;height:42px;min-height:42px;max-height:140px;line-height:1.5}
#inp:focus{outline:none;border-color:var(--red)}
#sbtn{background:var(--red);border:none;color:#fff;padding:0 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;flex-shrink:0}
#sbtn:hover{background:var(--red2)}
#sbtn:disabled{opacity:.4;cursor:not-allowed}

/* preview panel */
.preview-panel{width:0;flex-shrink:0;border-left:1px solid var(--border);background:var(--dark);overflow:hidden;transition:width .25s;display:flex;flex-direction:column}
.preview-panel.open{width:480px}
.preview-head{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.preview-head span{font-size:12px;color:var(--dim);font-family:var(--mono)}
.preview-head select{background:var(--card);border:1px solid var(--border);color:var(--text);font-size:11px;padding:3px 6px;border-radius:4px}
.preview-head button{background:none;border:none;color:var(--dim);cursor:pointer;font-size:16px;padding:0 4px}
#preview-frame{flex:1;border:none;background:#fff}

/* modal */
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:center;justify-content:center}
.modal.open{display:flex}
.modal-box{background:var(--dark);border:1px solid var(--border);border-radius:10px;width:88vw;max-width:780px;max-height:78vh;display:flex;flex-direction:column;overflow:hidden}
.modal-head{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.modal-head span{font-size:12px;font-family:var(--mono);color:var(--dim)}
.modal-head button{background:none;border:none;color:var(--dim);font-size:18px;cursor:pointer}
.modal-body{flex:1;overflow:auto;padding:14px}
.modal-body pre{font-family:var(--mono);font-size:11px;line-height:1.6;white-space:pre-wrap;color:var(--text)}

/* typing */
.typing{display:flex;gap:4px;align-items:center;padding:4px 0}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--dim);animation:bop 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes bop{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>
<header>
  <div class="dot"></div>
  <h1>Peak View Website Agent</h1>
  <span>Style Guide v6.0 active</span>
</header>
<div class="layout">

  <!-- sidebar -->
  <aside>
    <div class="s-title">Site Files</div>
    <div class="file-list" id="file-list"></div>
    <div class="s-title sep">Quick Copy</div>
    <button class="qb" onclick="q('Homepage hero — headline, subheadline, 2-sentence body')">Homepage hero</button>
    <button class="qb" onclick="q('Full Windows page copy')">Windows page</button>
    <button class="qb" onclick="q('Full Doors page copy')">Doors page</button>
    <button class="qb" onclick="q('About section copy')">About section</button>
    <button class="qb" onclick="q('Contact and CTA section copy')">Contact / CTA</button>
    <button class="qb" onclick="q('SEO meta title and description for homepage')">SEO tags</button>
    <div class="preview-btns">
      <button class="pbtn" id="pbtn" onclick="togglePreview()">Live Preview</button>
    </div>
  </aside>

  <!-- chat -->
  <div class="chat-wrap">
    <div class="messages" id="messages">
      <div class="msg agent">
        <div class="lbl">Agent</div>
        <div class="bubble">
          <p>Ready. Tell me what to write or which page to work on.</p>
          <p>Say things like <strong>"Rewrite the hero in index.html"</strong> or <strong>"Write a windows page and save it"</strong> — I'll return the full file with a one-click Save button.</p>
        </div>
      </div>
    </div>
    <div class="input-bar">
      <textarea id="inp" placeholder="Tell me what to write or edit..." rows="1"></textarea>
      <button id="sbtn" onclick="send()">Send</button>
    </div>
  </div>

  <!-- live preview panel -->
  <div class="preview-panel" id="preview-panel">
    <div class="preview-head">
      <select id="preview-select" onchange="loadPreview()">
        <option value="index.html">index.html</option>
      </select>
      <button onclick="reloadPreview()" title="Reload">↺</button>
    </div>
    <iframe id="preview-frame" src="about:blank"></iframe>
  </div>
</div>

<!-- file viewer modal -->
<div class="modal" id="fmodal">
  <div class="modal-box">
    <div class="modal-head">
      <span id="mfname"></span>
      <button onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body"><pre id="mfcontent"></pre></div>
  </div>
</div>

<script>
const msgsEl = document.getElementById('messages');
const inpEl  = document.getElementById('inp');
const sbtnEl = document.getElementById('sbtn');
let previewOpen = false;
let _pending = {};

// ── file list ──
async function loadFiles() {
  const files = await fetch('/api/files').then(r => r.json());
  const el = document.getElementById('file-list');
  el.innerHTML = files.map(f =>
    `<div class="fi" onclick="viewFile('${f.name}')"><span class="ext">${f.name.split('.').pop()}</span>${f.name}</div>`
  ).join('');
  // update preview select
  const sel = document.getElementById('preview-select');
  const cur = sel.value;
  sel.innerHTML = files.filter(f => f.name.endsWith('.html')).map(f =>
    `<option value="${f.name}"${f.name===cur?' selected':''}>${f.name}</option>`
  ).join('');
}
loadFiles();

// ── file viewer modal ──
async function viewFile(name) {
  const data = await fetch('/api/read/' + name).then(r => r.json());
  document.getElementById('mfname').textContent = name;
  document.getElementById('mfcontent').textContent = data.content || '(empty)';
  document.getElementById('fmodal').classList.add('open');
}
function closeModal() { document.getElementById('fmodal').classList.remove('open'); }

// ── live preview ──
function togglePreview() {
  previewOpen = !previewOpen;
  document.getElementById('preview-panel').classList.toggle('open', previewOpen);
  document.getElementById('pbtn').classList.toggle('active', previewOpen);
  if (previewOpen) loadPreview();
}
function loadPreview() {
  const sel = document.getElementById('preview-select').value;
  document.getElementById('preview-frame').src = '/site/' + sel + '?t=' + Date.now();
}
function reloadPreview() { loadPreview(); }

// ── quick commands ──
function q(text) { inpEl.value = text; send(); }

// ── textarea auto-resize ──
inpEl.addEventListener('input', function() {
  this.style.height = '42px';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});
inpEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

// ── messages ──
function addMsg(role, htmlContent, extra) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.innerHTML = `<div class="lbl">${role==='user'?'You':'Agent'}</div><div class="bubble">${htmlContent}${extra||''}</div>`;
  msgsEl.appendChild(d);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return d;
}
function addTyping() {
  const d = document.createElement('div');
  d.className = 'msg agent'; d.id = 'typing';
  d.innerHTML = '<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  msgsEl.appendChild(d);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}
function removeTyping() { const t = document.getElementById('typing'); if(t) t.remove(); }

// ── markdown renderer ──
function md(raw) {
  // escape HTML first
  let t = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // fenced code blocks with optional filename label  ```lang:filename
  t = t.replace(/```(?:[a-z]*)(?::([^\n]+))?\n([\s\S]*?)```/g, (_, fname, code) => {
    const label = fname ? `<div style="font-size:10px;color:var(--dim);margin-bottom:4px">${fname.trim()}</div>` : '';
    return `<pre>${label}<code>${code}</code></pre>`;
  });

  // inline code
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // bold / italic
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // headings
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // lists
  t = t.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  t = t.replace(/(<li>.*<\/li>(\n|$))+/g, s => `<ul>${s}</ul>`);

  // paragraphs — split on double newline, wrap non-tag lines
  t = t.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[123]|ul|ol|pre|li)/.test(block)) return block;
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('');

  return t;
}

// ── send ──
async function send() {
  const text = inpEl.value.trim();
  if (!text) return;
  inpEl.value = '';
  inpEl.style.height = '42px';
  sbtnEl.disabled = true;

  addMsg('user', text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  addTyping();

  try {
    const res  = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({message: text})
    });
    const data = await res.json();
    removeTyping();

    // parse file blocks from raw reply for Apply buttons
    const fileRe = /```(?:[a-z]+):([^\n]+)\n([\s\S]*?)```/g;
    const matches = [];
    let m;
    while ((m = fileRe.exec(data.reply)) !== null) {
      matches.push({filename: m[1].trim(), content: m[2]});
    }

    let actions = '';
    if (matches.length) {
      matches.forEach((f, i) => {
        _pending[`${data.id}-${i}`] = f;
        actions += `<button class="apply-btn" id="ab-${data.id}-${i}" onclick="applyFile(${data.id},${i})">Save to ${f.filename}</button>`;
      });
      actions = `<div class="file-actions">${actions}</div>`;
    }

    addMsg('agent', md(data.reply), actions);
  } catch(e) {
    removeTyping();
    addMsg('agent', `<p style="color:#e74c3c">Error: ${e.message}</p>`);
  }

  sbtnEl.disabled = false;
  inpEl.focus();
}

// ── apply file ──
async function applyFile(msgId, idx) {
  const key = `${msgId}-${idx}`;
  const f = _pending[key];
  if (!f) return;
  const btn = document.getElementById(`ab-${key}`);
  btn.textContent = 'Saving...';
  const res = await fetch('/api/write', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({filename: f.filename, content: f.content})
  });
  const data = await res.json();
  if (data.ok) {
    btn.textContent = 'Saved ✓';
    btn.classList.add('done');
    loadFiles();
    if (previewOpen) setTimeout(reloadPreview, 300);
  } else {
    btn.textContent = 'Error';
  }
}
</script>
</body>
</html>
"""

# ── routes ──

@app.route("/")
def index():
    return Response(PAGE_HTML, mimetype="text/html")

@app.route("/api/files")
def api_files():
    return jsonify(list_site_files())

@app.route("/api/read/<filename>")
def api_read(filename):
    content = read_site_file(filename)
    return jsonify({"content": content})

@app.route("/api/write", methods=["POST"])
def api_write():
    data = request.json
    ok = write_site_file(data["filename"], data["content"])
    return jsonify({"ok": ok})

@app.route("/site/<path:filename>")
def site_files(filename):
    return send_from_directory(str(WORKSPACE), filename)

_counter = 0
_lock = threading.Lock()

@app.route("/api/chat", methods=["POST"])
def api_chat():
    global _counter, history
    user_message = (request.json or {}).get("message", "").strip()
    if not user_message:
        return jsonify({"reply": "Nothing received.", "id": 0})

    # auto-attach file content if a site file is mentioned
    extra = ""
    for f in WORKSPACE.iterdir():
        if f.suffix in SITE_EXTENSIONS and f.name.lower() in user_message.lower():
            try:
                extra = f"Current content of {f.name}:\n\n```\n{f.read_text()}\n```\n\n"
            except Exception:
                pass
            break

    full_msg = extra + user_message if extra else user_message
    history.append({"role": "user", "content": full_msg})

    try:
        client = get_client()
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=history,
        )
        reply = resp.content[0].text
        history.append({"role": "assistant", "content": reply})
    except Exception as e:
        reply = f"API error: {e}"

    with _lock:
        _counter += 1
        msg_id = _counter

    return jsonify({"reply": reply, "id": msg_id})


if __name__ == "__main__":
    import webbrowser
    print("\nPeak View Website Agent — http://localhost:5050\n")
    threading.Timer(1.2, lambda: webbrowser.open("http://localhost:5050")).start()
    app.run(port=5050, debug=False, use_reloader=False)
