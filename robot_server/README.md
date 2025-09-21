# TeleTable Robot Server

WebSocket server for receiving hand tracking data from TeleTable and controlling physical robots.

## Installation

### Prerequisites

- Python 3.8 or higher
- UV (for dependency management)

### Install UV

If you don't have UV installed:

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS/Linux:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or visit: https://docs.astral.sh/uv/getting-started/installation/

### Setup and Run

1. **Navigate to the robot_server directory:**

   ```bash
   cd robot_server
   ```

2. **Install dependencies:**

   ```bash
   uv sync
   ```

3. **Run the server:**

   ```bash
   # Using UV run
   uv run robot-server

   # With custom options
   uv run robot-server --port 9999 --debug
   ```

## Usage

### Command Line Options

```bash
uv run robot-server --help
```

Options:

- `--host HOST`: Host to bind to (default: localhost)
- `--port PORT`: Port to listen on (default: 8765)
- `--debug`: Enable debug logging

### Development

```bash
# Install development dependencies (included in uv sync by default)
uv sync

# Run tests
uv run pytest

# Format code
uv run black src/

# Lint code
uv run flake8 src/
```

## Architecture

The server consists of:

- **`RobotController`**: Processes hand tracking data and controls the robot
- **`TeleTableRobotServer`**: WebSocket server that handles client connections
- **`main()`**: Entry point with argument parsing

## Customizing Robot Control

Edit the `RobotController` class in `src/robot_server/main.py`:

```python
class RobotController:
    def control_left_arm(self, hand_data):
        # Add your robot control logic here
        position = hand_data.get('position', {})
        # self.robot.move_left_arm(x=position['x'], ...)

    def control_right_arm(self, hand_data):
        # Add your robot control logic here
        pass
```

## Integration with TeleTable

1. Start this robot server: `uv run robot-server`
2. Open TeleTable host page in browser
3. Create/join a room and make it ready
4. The host will connect to `ws://localhost:8765` by default
5. When clients send hand data, it will be relayed to this server

## Hand Data Format

The server receives JSON messages with this structure:

```json
{
  "type": "hand_data",
  "timestamp": 1234567890123,
  "hands": {
    "left": {
      "detected": true,
      "position": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "open": 0.8,
      "gripperPosition": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "gripperOrientation": { "x": 0, "y": 0, "z": 0, "w": 1 }
    },
    "right": {
      /* same format */
    }
  }
}
```
