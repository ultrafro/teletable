# TeleTable Robot Integration (Poetry Version)

This document explains how to set up and use the Poetry-based robot WebSocket integration with TeleTable.

## Overview

The TeleTable host can now relay incoming hand position data to a local Python WebSocket server for robot control. This allows you to control a physical robot using hand gestures captured from remote clients.

## Architecture

```
[Client Browser] --PeerJS--> [Host Browser] --WebSocket--> [Python Robot Server] --> [Physical Robot]
```

1. **Client**: Captures hand gestures using camera and MediaPipe
2. **Host**: Receives hand data via PeerJS and relays to robot server via WebSocket
3. **Robot Server**: Python script (in `robot_server/` folder) that receives hand data and controls the robot
4. **Physical Robot**: Your actual robot hardware

## Setup Instructions

### Prerequisites

- **Python 3.8+**: Make sure Python is installed and in your PATH
- **Poetry**: For dependency management and virtual environments

### Install Poetry

If you don't have Poetry installed:

**Windows (PowerShell):**
```powershell
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | py -
```

**macOS/Linux:**
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

Visit [python-poetry.org](https://python-poetry.org/docs/#installation) for more installation options.

### 1. All-in-One Setup & Run (Recommended)

Use the Poetry-based scripts that automatically handle setup AND start the server:

**Windows:**
```bash
# Double-click or run from command prompt:
run_robot_server.bat

# With custom options:
run_robot_server.bat --port 9999 --debug
```

**macOS/Linux:**
```bash
# Make executable and run:
chmod +x run_robot_server.sh
./run_robot_server.sh

# With custom options:
./run_robot_server.sh --port 9999 --debug
```

These scripts will:
- ✅ Check if Python and Poetry are installed
- ✅ Navigate to the `robot_server/` directory
- ✅ Install dependencies with Poetry (if not already installed)
- ✅ Run the server in Poetry's managed virtual environment

### 2. Manual Setup & Run (Alternative)

If you prefer manual control:

```bash
# Navigate to the robot server directory
cd robot_server

# Install dependencies (creates virtual environment automatically)
poetry install

# Run the server
poetry run robot-server

# Or activate the shell and run directly
poetry shell
robot-server

# With custom options
poetry run robot-server --host 0.0.0.0 --port 9999 --debug
```

### 3. Start TeleTable Host

1. Open TeleTable in your browser
2. Go to `/host` and create a room
3. Enter the room and click "Make Room Ready"
4. The host will automatically attempt to connect to `ws://localhost:8765`

### 4. Connect Clients

1. Share the room ID with clients
2. Clients can join and request control
3. When you approve a client, their hand data will be sent to the robot server

## Project Structure

After setup, your project will contain:
```
teletable/
├── robot_server/           # Robot server package directory
│   ├── src/
│   │   └── robot_server/
│   │       ├── __init__.py
│   │       └── main.py     # Main server script
│   ├── pyproject.toml      # Poetry configuration & dependencies
│   ├── README.md           # Robot server specific docs
│   └── poetry.lock         # Lock file (created after install)
├── run_robot_server.*      # Convenience scripts
└── ...                     # Other TeleTable files
```

## Robot Server Configuration

### Default Settings

- **Host**: localhost
- **Port**: 8765
- **URL**: ws://localhost:8765

### Customizing Robot Control

Edit the `RobotController` class in `robot_server/src/robot_server/main.py`:

```python
class RobotController:
    def control_left_arm(self, hand_data):
        position = hand_data.get('position', {})
        orientation = hand_data.get('orientation', {})
        openness = hand_data.get('open', 0)
        
        # Replace with your robot control logic
        # self.robot.move_left_arm(x=position['x'], y=position['y'], z=position['z'])
        # self.robot.set_left_gripper(openness)
    
    def control_right_arm(self, hand_data):
        # Similar implementation for right arm
        pass
```

## Hand Data Format

The robot server receives hand data in the following format:

```json
{
  "type": "hand_data",
  "timestamp": 1234567890123,
  "hands": {
    "left": {
      "detected": true,
      "position": {"x": 0.1, "y": 0.2, "z": 0.3},
      "orientation": {"x": 0, "y": 0, "z": 0, "w": 1},
      "open": 0.8,
      "base": {"x": 0.1, "y": 0.2, "z": 0.3},
      "indexKnuckle": {"x": 0.1, "y": 0.2, "z": 0.3},
      "pinkyKnuckle": {"x": 0.1, "y": 0.2, "z": 0.3},
      "gripperPosition": {"x": 0.1, "y": 0.2, "z": 0.3},
      "gripperOrientation": {"x": 0, "y": 0, "z": 0, "w": 1}
    },
    "right": {
      // Same format as left hand
    }
  }
}
```

### Field Descriptions

- **detected**: Whether the hand is visible and being tracked
- **position**: 3D position of the hand center
- **orientation**: Quaternion representing hand orientation (x, y, z, w)
- **open**: Hand openness factor (0.0 = closed fist, 1.0 = fully open)
- **base**: Position of the wrist/hand base
- **indexKnuckle**: Position of the index finger knuckle
- **pinkyKnuckle**: Position of the pinky finger knuckle
- **gripperPosition**: Calculated gripper position for robot control
- **gripperOrientation**: Calculated gripper orientation for robot control

## Host UI Features

The TeleTable host interface includes:

### Connection Status Panel
- **Room Status**: Whether the room is ready for control
- **PeerJS**: Connection status to PeerJS server
- **Camera**: Whether the host camera is active
- **Video Calls**: Number of active client connections
- **Robot Server**: WebSocket connection status to the Python server

### Robot Server Control Panel
- **Connect/Disconnect**: Manual control of WebSocket connection
- **Reconnect**: Force reconnection attempt
- **Error Display**: Shows connection errors and troubleshooting info
- **Connection Info**: Displays the WebSocket URL (default: ws://localhost:8765)

## Development

### Adding Dependencies

```bash
cd robot_server
poetry add numpy  # Example: add NumPy for calculations
poetry add --group dev pytest  # Add development dependency
```

### Running Tests

```bash
cd robot_server
poetry run pytest
```

### Code Formatting

```bash
cd robot_server
poetry run black src/
poetry run flake8 src/
```

## Troubleshooting

### Poetry Not Found

1. **Install Poetry** using the commands above
2. **Restart your terminal** after installation
3. **Check installation**: `poetry --version`

### Robot Server Won't Connect

1. **Check if Python server is running**:
   ```bash
   ./run_robot_server.bat  # or .sh
   ```

2. **Verify port is available**:
   ```bash
   # On Windows
   netstat -an | findstr :8765
   
   # On Linux/Mac
   lsof -i :8765
   ```

3. **Check Poetry installation**:
   ```bash
   cd robot_server
   poetry install
   poetry run robot-server
   ```

### Dependencies Issues

```bash
cd robot_server
# Remove lock file and reinstall
rm poetry.lock
poetry install
```

## Benefits of Poetry Setup

- ✅ **Dependency Isolation**: Virtual environment managed automatically
- ✅ **Reproducible Builds**: Lock file ensures consistent dependency versions
- ✅ **Easy Package Management**: Add/remove packages with simple commands
- ✅ **Development Tools**: Built-in support for testing, linting, and formatting
- ✅ **Cross-Platform**: Works consistently across Windows, macOS, and Linux
- ✅ **Professional Structure**: Industry-standard Python project layout
