@echo off
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: python not found.
    pause
    exit /b 1
)

if "%ANTHROPIC_API_KEY%"=="" (
    echo Error: ANTHROPIC_API_KEY is not set.
    echo Run: set ANTHROPIC_API_KEY=your-key-here
    pause
    exit /b 1
)

python -c "import anthropic, flask, rich" 2>nul
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

python clancy_agent.py
pause
