#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# check python
if ! command -v python3 &>/dev/null; then
    echo "Error: python3 not found."
    exit 1
fi

# check API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY is not set."
    echo "Run: export ANTHROPIC_API_KEY=your-key-here"
    exit 1
fi

# install deps if needed
if ! python3 -c "import anthropic, flask, rich" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
fi

python3 clancy_agent.py
