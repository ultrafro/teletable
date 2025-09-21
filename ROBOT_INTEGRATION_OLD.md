# TeleTable Robot Integration

This document explains how to set up and use the robot WebSocket integration with TeleTable.

## Overview

The TeleTable host can now relay incoming hand position data to a local Python WebSocket server for robot control. This allows you to control a physical robot using hand gestures captured from remote clients.

## Architecture

```
[Client Browser] --PeerJS--> [Host Browser] --WebSocket--> [Python Robot Server] --> [Physical Robot]
```

1. **Client**: Captures hand gestures using camera and MediaPipe
2. **Host**: Receives hand data via PeerJS and relays to robot server via WebSocket
3. **Robot Server**: Python script that receives hand data and controls the robot
4. **Physical Robot**: Your actual robot hardware

## Setup Instructions

### 1. All-in-One Setup & Run (Recommended)

Use the all-in-one scripts that automatically handle setup AND start the server:

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

- ✅ Check if virtual environment exists (create if needed)
- ✅ Check if dependencies are installed (install if needed)
- ✅ Activate virtual environment automatically
- ✅ Start the robot server

### 2. Separate Setup & Run (Alternative)

If you prefer separate setup and run steps:

**Windows:**

```bash
# One-time setup:
setup_robot_server.bat

# Start server anytime:
start_robot_server.bat
```

**macOS/Linux:**

```bash
# One-time setup:
chmod +x setup_robot_server.sh start_robot_server.sh
./setup_robot_server.sh

# Start server anytime:
./start_robot_server.sh
```

### 3. Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Create virtual environment in the project directory
python -m venv robot_env

# Activate the virtual environment
# On Windows:
robot_env\Scripts\activate
# On macOS/Linux:
source robot_env/bin/activate

# Install dependencies (virtual environment must be activated)
pip install -r requirements.txt
```

### 4. Start the Robot Server (Manual Method)

**Easy Method (Recommended):**

**Windows:**

```bash
# Double-click or run from command prompt:
start_robot_server.bat

# With custom options:
start_robot_server.bat --port 9999 --debug
```

**macOS/Linux:**

```bash
# Make executable and run:
chmod +x start_robot_server.sh
./start_robot_server.sh

# With custom options:
./start_robot_server.sh --port 9999 --debug
```

**Manual Method:**

```bash
# Activate virtual environment first:
# Windows: robot_env\Scripts\activate
# macOS/Linux: source robot_env/bin/activate

# Then start the server:
python robot_server.py

# Custom options:
python robot_server.py --host 0.0.0.0 --port 9999 --debug
```

### 5. Start TeleTable Host

1. Open TeleTable in your browser
2. Go to `/host` and create a room
3. Enter the room and click "Make Room Ready"
4. The host will automatically attempt to connect to `ws://localhost:8765`

### 6. Connect Clients

1. Share the room ID with clients
2. Clients can join and request control
3. When you approve a client, their hand data will be sent to the robot server

## Robot Server Configuration

### Default Settings

- **Host**: localhost
- **Port**: 8765
- **URL**: ws://localhost:8765

### Customizing Robot Control

Edit the `RobotController` class in `robot_server.py`:

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
      "position": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "open": 0.8,
      "base": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "indexKnuckle": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "pinkyKnuckle": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "gripperPosition": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "gripperOrientation": { "x": 0, "y": 0, "z": 0, "w": 1 }
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

The TeleTable host interface now includes:

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

## Troubleshooting

### Virtual Environment Issues

1. **Virtual environment not found**:

   ```bash
   # Re-create the virtual environment
   python -m venv robot_env
   ```

2. **Can't activate virtual environment**:

   ```bash
   # On Windows, if you get execution policy errors:
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

   # Then try activating again:
   robot_env\Scripts\activate
   ```

3. **Dependencies not found after activation**:

   ```bash
   # Make sure you're in the right directory and venv is activated
   # Then reinstall dependencies:
   pip install -r requirements.txt
   ```

4. **Check if virtual environment is active**:
   - Your terminal prompt should show `(robot_env)` at the beginning
   - You can also check with: `which python` (should point to robot_env folder)

### Robot Server Won't Connect

1. **Check if Python server is running**:

   ```bash
   python robot_server.py
   ```

2. **Verify port is available**:

   ```bash
   # On Windows
   netstat -an | findstr :8765

   # On Linux/Mac
   lsof -i :8765
   ```

3. **Check firewall settings**: Ensure localhost connections are allowed

4. **Try different port**:
   ```bash
   python robot_server.py --port 9999
   ```
   Then update the WebSocket URL in the TeleTable code if needed.

### No Hand Data Received

1. **Check client permissions**: Ensure camera access is granted
2. **Verify client approval**: Make sure you've approved the client's control request
3. **Check hand detection**: Ensure hands are visible and well-lit
4. **Monitor logs**: Check the Python server logs for incoming data

### Connection Drops

- The system includes automatic reconnection with exponential backoff
- Check network stability between host browser and Python server
- Monitor the Python server logs for error messages

## Security Considerations

- By default, the server only binds to localhost (127.0.0.1)
- For remote connections, use `--host 0.0.0.0` but ensure proper network security
- Consider adding authentication for production deployments
- The WebSocket connection is not encrypted by default

## Performance Tips

- Use `--debug` sparingly in production as it generates verbose logs
- Consider throttling hand data updates if robot control is too sensitive
- Monitor CPU usage on both the host browser and Python server
- For high-frequency control, consider implementing data smoothing in the robot controller
