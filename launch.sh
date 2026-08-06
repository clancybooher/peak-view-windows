#!/bin/bash
cd "$(dirname "$0")"

ENV_FILE=".env"

# load saved key if it exists
if [ -f "$ENV_FILE" ]; then
    export ANTHROPIC_API_KEY=$(cat "$ENV_FILE")
fi

# prompt if still not set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "Paste your Anthropic API key (from console.anthropic.com):"
    read -r key
    echo "$key" > "$ENV_FILE"
    export ANTHROPIC_API_KEY="$key"
    echo "Key saved."
fi

# install deps silently if needed
/usr/bin/python3 -c "import anthropic, flask, rich" 2>/dev/null || pip3 install -r requirements.txt -q

/usr/bin/python3 agent_ui.py
