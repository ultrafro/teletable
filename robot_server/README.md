# TeleTable Robot Server

WebSocket server for receiving hand tracking data from TeleTable and controlling physical robots with advanced Inverse Kinematics (IK) capabilities.

## Features

### Core Capabilities

- **Hand Tracking Integration**: Process hand tracking data from TeleTable
- **Precise Pose Control**: Control robot end-effector position and orientation using Cartesian coordinates and quaternions
- **Inverse Kinematics**: Automatically compute joint angles to achieve desired poses
- **LeRobot Integration**: Full integration with LeRobot SO101 Follower robot and kinematics solver
- **Safety Features**: Workspace limits, smooth motion interpolation, and error handling
- **Simulation Mode**: Test control logic without requiring a physical robot
- **Device Auto-Discovery**: Automatic scanning and mapping of connected robots

### Key Robot Control Features

1. **Pose Control**: Move robot to specific x,y,z,qx,qy,qz,qw poses
2. **Smooth Motion**: Interpolated trajectories with SLERP quaternion interpolation
3. **Workspace Limits**: Configurable safety boundaries
4. **Real Robot Support**: Full SO101 Follower integration via LeRobot
5. **Simulation Mode**: Complete simulation environment for testing

## Installation

### Prerequisites

- Python 3.10 or higher
- UV (for dependency management)

### Windows Setup Requirements

**Important**: If you are running on Windows, you need to set up WSL (Windows Subsystem for Linux), then run `uv sync`, and run the robot from there.

Make sure you build your Windows kernel first:

```bash
sudo apt install -y python3-dev build-essential linux-libc-dev libevdev-dev
```

This won't work on regular PowerShell/terminal in Windows because the placo requirement from LeRobot does not have Windows builds.

### Install UV

If you don't have UV installed:

**Windows (use WSL - required for this project):**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows (PowerShell - not recommended for this project):**

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

3. **For Real Robot Support (Optional) - Install LeRobot:**

   To use actual robots instead of simulation, you have two options:

   **Option A: Use local LeRobot (if you have it cloned):**

   ```bash
   # If you have LeRobot at c:\side\robot\lerobot, this will use local reference
   uv sync --group robot-hardware
   ```

   **Option B: Download LeRobot from GitHub:**

   ```bash
   # This will clone the full LeRobot repository (~hundreds of MB)
   uv add "lerobot @ git+https://github.com/huggingface/lerobot.git"
   ```

   **Note**: LeRobot is a large dependency. If you only want simulation mode, skip this step.

4. **Run the server:**

   ```bash
   uv run robot-server
   ```

## Usage

### Starting the Server

**Working Directory**: Make sure you're in the `robot_server/` directory before running commands.

#### Current Implementation (Simplified Mode)

The current implementation uses a simplified setup that scans for devices and configures robots automatically:

```bash
cd robot_server/
uv run robot-server
```

This will:

1. Check for existing config.json and prompt user to reuse it
2. If no config or user declines, scan for connected robots
3. Map robot folders to connected devices
4. Save configuration to config.json
5. Start IK mode WebSocket server on port 9000

### Robot Configuration

The server looks for robot configurations in `src/robot_server/robots/`. Each robot folder should contain:

- `calib.urdf` - Robot URDF file for kinematics
- `calibration.json` - Robot calibration parameters

Example robot folder structure:

```
src/robot_server/robots/
└── follower_1/
    ├── calib.urdf
    └── calibration.json
```

### WebSocket Message API

The server supports multiple message types for robot control:

#### Hand Tracking Data

Traditional hand tracking data from TeleTable:

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

#### Pose Control

Move robot to a specific pose:

```json
{
  "type": "pose_control",
  "pose": {
    "x": 0.2, // Position in meters
    "y": 0.0,
    "z": 0.15,
    "qx": 0.0, // Quaternion orientation
    "qy": 0.0,
    "qz": 0.0,
    "qw": 1.0,
    "gripper": 50.0, // Optional: 0-100
    "smooth": true // Optional: use smooth interpolation
  }
}
```

#### Get Current Pose

Query robot's current end-effector pose:

```json
{
  "type": "get_pose"
}
```

Response:

```json
{
  "type": "current_pose",
  "pose": {
    "x": 0.2,
    "y": 0.0,
    "z": 0.15,
    "qx": 0.0,
    "qy": 0.0,
    "qz": 0.0,
    "qw": 1.0
  },
  "timestamp": "2025-01-27T10:30:00"
}
```

#### Home Robot

Move robot to home position:

```json
{
  "type": "home_robot"
}
```

#### Connection Test

```json
{
  "type": "ping"
}
```

## Configuration

### Coordinate System

- **Position**: Meters in robot base frame
- **Orientation**: Quaternion (qx, qy, qz, qw) where qw is the scalar component
- **Gripper**: 0-100 scale (0=closed, 100=open)

### Default Workspace Limits

```python
workspace_limits = {
    'x': (-0.3, 0.3),  # ±30cm
    'y': (-0.3, 0.3),  # ±30cm
    'z': (0.05, 0.4)   # 5cm to 40cm height
}
```

### Motion Parameters

- **Max Linear Velocity**: 0.1 m/s
- **Max Angular Velocity**: 1.0 rad/s
- **Interpolation Steps**: 10 (for smooth motion)

## Development

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

## Integration with TeleTable

1. Start this robot server: `uv run robot-server`
2. Open TeleTable host page in browser
3. Create/join a room and make it ready
4. The host will connect to `ws://localhost:9000` by default
5. When clients send hand data, it will be relayed to this server

The IK controller seamlessly integrates with the existing TeleTable hand tracking system:

1. **Hand Tracking**: Continue using existing hand_data messages
2. **Pose Control**: Add precise pose control for specific tasks
3. **Hybrid Control**: Combine hand tracking with programmatic pose control

## Dependencies

### Required for Real Robot

- LeRobot library with SO101 Follower support
- Placo kinematics library
- Robot URDF file
- NumPy (for mathematical operations)

### Required for Simulation

- NumPy (for mathematical operations)
- Standard Python libraries

## Architecture

The server consists of:

- **`TeleTableRobotServer`**: WebSocket server that handles client connections
- **`IKRobotController`**: Advanced robot control with inverse kinematics
- **`RobotController`**: Basic robot control interface
- **Device Scanner**: Automatic detection of connected robots
- **Configuration Manager**: Handles robot-to-device mapping

## Example Client Code

### Python WebSocket Client

```python
import asyncio
import websockets
import json

async def control_robot():
    uri = "ws://localhost:9000"
    async with websockets.connect(uri) as websocket:
        # Move to a specific pose
        message = {
            "type": "pose_control",
            "pose": {
                "x": 0.2, "y": 0.1, "z": 0.15,
                "qx": 0.0, "qy": 0.0, "qz": 0.0, "qw": 1.0,
                "gripper": 75.0,
                "smooth": True
            }
        }
        await websocket.send(json.dumps(message))
        response = await websocket.recv()
        print(f"Response: {response}")

        # Get current pose
        await websocket.send(json.dumps({"type": "get_pose"}))
        pose_response = await websocket.recv()
        print(f"Current pose: {pose_response}")

# Run the client
asyncio.run(control_robot())
```

### JavaScript WebSocket Client

```javascript
const ws = new WebSocket("ws://localhost:9000");

ws.onopen = function () {
  // Move robot to pose
  const command = {
    type: "pose_control",
    pose: {
      x: 0.2,
      y: 0.0,
      z: 0.15,
      qx: 0.0,
      qy: 0.0,
      qz: 0.0,
      qw: 1.0,
      gripper: 50.0,
      smooth: true,
    },
  };
  ws.send(JSON.stringify(command));
};

ws.onmessage = function (event) {
  const response = JSON.parse(event.data);
  console.log("Robot response:", response);
};
```

## Error Handling

The server includes comprehensive error handling:

- **Workspace Limits**: Prevents dangerous movements outside safe zone
- **Connection Errors**: Graceful handling of robot disconnection
- **IK Failures**: Fallback strategies for unsolvable poses
- **Import Errors**: Automatic fallback to simulation if LeRobot unavailable

## Troubleshooting

### Common Issues

1. **"Failed to spawn: robot_server.main"**

   - Use the correct command: `uv run robot-server`
   - Make sure you're in the `robot_server/` directory

2. **"No serial devices found"**

   - Check robot is connected via USB/serial
   - Verify robot is powered on
   - Check device permissions on Linux/macOS

3. **"LeRobot not available, falling back to simulation"**

   - Install LeRobot dependencies: `uv sync --group robot-hardware`
   - LeRobot is required for real robot control
   - Simulation mode works without LeRobot

4. **"No robot folders found"**

   - Ensure robot configurations exist in `src/robot_server/robots/`
   - Check that each robot folder has `calib.urdf` and `calibration.json`

5. **"Target position outside workspace limits"**

   - Check your x,y,z coordinates are within configured limits
   - Adjust workspace_limits if needed

6. **"Failed to connect to robot"**

   - Check robot serial port connection
   - Verify robot is powered and calibrated
   - Use simulation mode for testing without hardware

7. **IK Solver Failures**
   - Ensure target pose is reachable by the robot
   - Check for joint limits and singularities
   - Try different approach angles

### Debug Mode

Enable detailed logging (when implemented):

```bash
uv run robot-server --debug
```

**Note**: Currently, the simplified implementation runs with INFO level logging by default. Debug flags will be added in future versions.

## Custom Robot Configuration

For real robot operation, create robot configuration files in the robots directory:

```python
# calibration.json example
{
  "port": "/dev/ttyUSB0",
  "use_degrees": false,
  "max_relative_target": 10.0
}
```

### Custom Workspace Limits

```python
# Custom workspace for your specific setup
workspace_limits = {
    'x': (-0.4, 0.4),
    'y': (-0.2, 0.2),
    'z': (0.1, 0.5)
}
```

This allows for sophisticated robot control scenarios where coarse hand tracking can be supplemented with precise pose commands when needed.
