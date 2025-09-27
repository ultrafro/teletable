# Device Scanning and Selection

The TeleTable Robot Server now includes automatic device scanning and selection capabilities for robot serial ports.

## Features

- **Automatic device discovery**: Scans for all available serial devices
- **Interactive device selection**: User-friendly menu to choose the correct device
- **Auto-selection**: Intelligent automatic device selection based on common patterns
- **Device information**: Shows detailed information about each discovered device

## Usage

### 1. List Available Devices

To see all available serial devices:

```bash
uv run robot_server.main --list-devices
```

Example output:

```
📱 Found 2 serial device(s):
================================================================================
  1. /dev/ttyUSB0
     Description: USB-Serial Controller D
     Hardware ID: USB VID:PID=1A86:7523 SER=537F0309

  2. /dev/ttyACM0
     Description: Arduino Uno
     Hardware ID: USB VID:PID=2341:0043 SER=95535353535351F041B1
```

### 2. Interactive Device Selection

When starting the robot server in real robot mode without specifying a port, the system will automatically scan and prompt for device selection:

```bash
uv run robot_server.main --ik --urdf robot.urdf
```

The system will:

1. Scan for available devices
2. Display all found devices
3. Prompt you to select the correct one

Example interaction:

```
🤖 Real robot mode detected - scanning for devices...
🔍 Scanning for connected devices...

📱 Found 2 serial device(s):
================================================================================
  1. /dev/ttyUSB0
     Description: USB-Serial Controller D
     Hardware ID: USB VID:PID=1A86:7523 SER=537F0309

  2. /dev/ttyACM0
     Description: Arduino Uno
     Hardware ID: USB VID:PID=2341:0043 SER=95535353535351F041B1

Select a device:
Enter device number (1-2) or 'q' to quit: 1
✅ Selected device: /dev/ttyUSB0
🔌 Using robot port: /dev/ttyUSB0
```

### 3. Automatic Device Selection

For automated setups or scripts, you can use auto-selection:

```bash
uv run robot_server.main --ik --urdf robot.urdf --auto-select-device
```

The system will automatically select a suitable device based on common patterns like:

- Arduino devices
- USB serial controllers
- Common robot device identifiers

### 4. Manual Port Specification

You can still manually specify a port as before:

```bash
uv run robot_server.main --ik --urdf robot.urdf --port-robot /dev/ttyUSB0
```

## Command Line Options

- `--list-devices`: List all available serial devices and exit
- `--auto-select-device`: Automatically select a suitable device without prompting
- `--port-robot PORT`: Manually specify the robot serial port

## Dependencies

The device scanning functionality requires the `pyserial` library, which is automatically included as a dependency. If you need to install it manually:

```bash
uv add pyserial
```

## Troubleshooting

### No Devices Found

If no devices are found:

1. Ensure your robot/device is connected via USB
2. Check that the device is powered on
3. Verify USB cable is working
4. On Linux, check device permissions (`ls -l /dev/tty*`)

### Permission Errors (Linux)

If you get permission errors when accessing devices:

```bash
# Add your user to the dialout group
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

### Device Not Listed

If your device isn't appearing in the list:

1. Try unplugging and reconnecting the device
2. Check `dmesg | tail` (Linux) or Device Manager (Windows) to see if the device is recognized
3. Install appropriate drivers for your device

## Technical Details

The device scanner:

- Uses `serial.tools.list_ports` to enumerate devices
- Provides device path, description, and hardware ID
- Supports automatic pattern matching for common robot devices
- Gracefully handles cases where `pyserial` is not available

The implementation is cross-platform and works on:

- Linux (e.g., `/dev/ttyUSB0`, `/dev/ttyACM0`)
- Windows (e.g., `COM1`, `COM2`)
- macOS (e.g., `/dev/tty.usbserial-*`)
