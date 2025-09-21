#!/bin/bash

echo "TeleTable Robot Server - UV Setup & Run"
echo "========================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "ERROR: Python is not installed or not in PATH"
    echo "Please install Python 3.8+ and try again"
    exit 1
fi

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo "ERROR: UV is not installed"
    echo
    echo "Please install UV first:"
    echo "  https://docs.astral.sh/uv/getting-started/installation/"
    echo
    echo "Quick install:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Navigate to robot_server directory
cd robot_server || {
    echo "ERROR: Could not navigate to robot_server directory"
    exit 1
}

# Check if uv.lock exists (indicates dependencies are installed)
if [ ! -f "uv.lock" ]; then
    echo
    echo "📦 Installing dependencies with UV..."
    uv sync
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Start the robot server
echo
echo "🚀 Starting TeleTable Robot Server..."
echo "Server will run on ws://localhost:8765"
echo "Press Ctrl+C to stop the server"
echo

uv run robot-server "$@"