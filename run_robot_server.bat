@echo off
echo TeleTable Robot Server - UV Setup & Run
echo ========================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if UV is installed
uv --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: UV is not installed
    echo.
    echo Please install UV first:
    echo   https://docs.astral.sh/uv/getting-started/installation/
    echo.
    echo Quick install (PowerShell):
    echo   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 ^| iex"
    pause
    exit /b 1
)

REM Navigate to robot_server directory
cd robot_server
if %errorlevel% neq 0 (
    echo ERROR: Could not navigate to robot_server directory
    pause
    exit /b 1
)

REM Check if uv.lock exists (indicates dependencies are installed)
if not exist "uv.lock" (
    echo.
    echo 📦 Installing dependencies with UV...
    uv sync
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
) else (
    echo ✅ Dependencies already installed
)

REM Start the robot server
echo.
echo 🚀 Starting TeleTable Robot Server...
echo Server will run on ws://localhost:8765
echo Press Ctrl+C to stop the server
echo.

uv run robot-server %*