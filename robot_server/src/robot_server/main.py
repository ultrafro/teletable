#!/usr/bin/env python3
"""
TeleTable Robot Server - Simplified single mode operation.

Usage:
    cd robot_server/
    uv run robot-server                # Normal operation
    uv run robot-server -justmove     # Debug mode: continuous circular motion

Normal operation:
1. Check for existing config.json and prompt user to reuse it
2. If no config or user declines, scan for connected robots
3. Map robot folders to connected devices  
4. Save configuration to config.json
5. Start IK mode WebSocket server on port 9000

Debug mode (-justmove):
1. Use existing config.json or create minimal config
2. Move the robot end effector in a continuous circle for debugging
"""

import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .server import TeleTableRobotServer
from .ik_robot_controller import IKRobotController
from .device_scanner import list_serial_devices, display_devices, diagnose_wsl_usb_issues, get_windows_usb_devices, get_windows_com_ports, is_robot_device, auto_forward_robot_devices, bind_usb_device

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_existing_config() -> Optional[Dict]:
    """Load existing config.json if it exists."""
    config_path = Path("config.json")
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Found existing configuration: {config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load config.json: {e}")
            return None
    return None


def ask_user_to_reuse_config(config: Dict) -> bool:
    """Ask user if they want to reuse the existing configuration."""
    print("\n" + "="*60)
    print("🔧 Found existing configuration:")
    print("="*60)
    
    for i, robot_config in enumerate(config.get('robots', []), 1):
        print(f"  Robot {i}:")
        print(f"    Folder: {robot_config.get('folder')}")
        print(f"    Device: {robot_config.get('device')}")
        print(f"    URDF: {robot_config.get('urdf')}")
        print(f"    Calibration: {robot_config.get('calibration')}")
        print()
    
    while True:
        try:
            response = input("Do you want to use this existing configuration? [y/N]: ").strip().lower()
            if response in ['y', 'yes']:
                return True
            elif response in ['n', 'no', '']:
                return False
            else:
                print("Please enter 'y' for yes or 'n' for no.")
        except KeyboardInterrupt:
            print("\nOperation cancelled.")
            return False


def get_robot_folders() -> List[Path]:
    """Get all robot folders from ./robot_server/robots directory."""
    robots_dir = Path("src/robot_server/robots")
    
    if not robots_dir.exists():
        logger.error(f"Robots directory not found: {robots_dir}")
        return []
    
    robot_folders = []
    for item in robots_dir.iterdir():
        if item.is_dir():
            # Check if folder contains required files
            urdf_file = item / "calib.urdf"
            calibration_file = item / "calibration.json"
            
            if urdf_file.exists() and calibration_file.exists():
                robot_folders.append(item)
            else:
                logger.warning(f"Skipping {item.name}: missing calib.urdf or calibration.json")
    
    return robot_folders


def map_robots_to_devices(robot_folders: List[Path], devices: List[Tuple[str, str, str]]) -> List[Dict]:
    """Interactively map robot folders to connected devices."""
    if not devices:
        logger.error("No devices found to map to robots")
        return []
    
    if not robot_folders:
        logger.error("No robot folders found")
        return []
    
    print("\n" + "="*60)
    print("🔗 Robot to Device Mapping")
    print("="*60)
    
    robot_configs = []
    used_devices = set()
    
    for robot_folder in robot_folders:
        print(f"\n📁 Robot folder: {robot_folder.name}")
        print(f"   URDF: {robot_folder / 'calib.urdf'}")
        print(f"   Calibration: {robot_folder / 'calibration.json'}")
        print()
        
        # Show available devices (excluding already used ones)
        available_devices = [(device, desc, hwid) for device, desc, hwid in devices 
                           if device not in used_devices]
        
        if not available_devices:
            print("❌ No more devices available for mapping")
            break
        
        print("Available devices:")
        for i, (device, description, hwid) in enumerate(available_devices):
            print(f"  {i + 1}. {device}")
            print(f"     Description: {description}")
            print(f"     Hardware ID: {hwid}")
            print()
        
        # Get user selection
        while True:
            try:
                choice = input(f"Select device for {robot_folder.name} (1-{len(available_devices)}) or 's' to skip: ").strip().lower()
                
                if choice == 's' or choice == 'skip':
                    print(f"Skipping {robot_folder.name}")
                    break
                
                device_num = int(choice)
                if 1 <= device_num <= len(available_devices):
                    selected_device = available_devices[device_num - 1][0]
                    used_devices.add(selected_device)
                    
                    robot_config = {
                        'folder': str(robot_folder),
                        'device': selected_device,
                        'urdf': str(robot_folder / 'calib.urdf'),
                        'calibration': str(robot_folder / 'calibration.json')
                    }
                    robot_configs.append(robot_config)
                    
                    print(f"✅ Mapped {robot_folder.name} to {selected_device}")
                    break
                else:
                    print(f"❌ Invalid selection. Please enter a number between 1 and {len(available_devices)}.")
                    
            except ValueError:
                print("❌ Invalid input. Please enter a number or 's' to skip.")
            except KeyboardInterrupt:
                print("\nOperation cancelled.")
                return []
    
    return robot_configs


def save_config(robot_configs: List[Dict]) -> None:
    """Save robot configuration to config.json."""
    config = {
        'robots': robot_configs,
        'server': {
            'host': 'localhost',
            'port': 9000
        }
    }
    
    try:
        with open('config.json', 'w') as f:
            json.dump(config, f, indent=2)
        logger.info("Configuration saved to config.json")
    except Exception as e:
        logger.error(f"Failed to save config.json: {e}")
        raise


def start_server_with_config(config: Dict) -> None:
    """Start the TeleTable Robot Server with the given configuration."""
    robot_configs = config.get('robots', [])
    
    if not robot_configs:
        logger.error("No robot configurations found")
        return
    
    # For now, use the first robot configuration
    # TODO: Support multiple robots
    robot_config = robot_configs[0]
    
    logger.info(f"🤖 Starting server with robot: {robot_config['folder']}")
    logger.info(f"📁 URDF: {robot_config['urdf']}")
    logger.info(f"🔌 Device: {robot_config['device']}")
    
    # Initialize server
    server = TeleTableRobotServer(
        host=config['server']['host'],
        port=config['server']['port'],
        use_ik_controller=True,
        urdf_path=robot_config['urdf'],
        robot_config_path=robot_config['calibration'],
        robot_port=robot_config['device'],
        use_simulation=False
    )
    
    # Log startup information
    logger.info(f"🚀 Starting TeleTable Robot Server in IK Real Robot mode")
    logger.info(f"🌐 WebSocket server will start on {config['server']['host']}:{config['server']['port']}")
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")


def run_justmove_mode(config: Dict) -> None:
    """Run the robot in continuous circular motion for debugging."""
    robot_configs = config.get('robots', [])
    
    if not robot_configs:
        logger.error("No robot configurations found")
        return
    
    # Use the first robot configuration
    robot_config = robot_configs[0]
    
    logger.info(f"🔄 Starting JustMove mode with robot: {robot_config['folder']}")
    logger.info(f"📁 URDF: {robot_config['urdf']}")
    logger.info(f"🔌 Device: {robot_config['device']}")
    
    # Initialize IK controller
    ik_controller = IKRobotController(
        urdf_path=robot_config['urdf'],
        robot_config_path=robot_config['calibration'],
        robot_port=robot_config['device'],
        use_simulation=False
    )
    
    # Connect to robot
    ik_controller.connect()
    
    if not ik_controller.is_connected:
        logger.error("❌ Failed to connect to robot. Cannot run JustMove mode.")
        return
    
    logger.info("🔄 Starting continuous circular motion. Press Ctrl+C to stop.")
    
    try:
        # Move to home position first
        ik_controller.home_position()
        
        # Start circular motion
        ik_controller.move_in_circle(
            center_x=0.2,
            center_y=0.0, 
            center_z=0.2,
            radius=0.05,
            duration_seconds=3.0
        )
    except KeyboardInterrupt:
        logger.info("🛑 JustMove mode stopped by user")
    except Exception as e:
        logger.error(f"❌ JustMove mode error: {e}")
    finally:
        ik_controller.disconnect()


def create_minimal_config_for_justmove() -> Optional[Dict]:
    """Create a minimal configuration for JustMove mode if none exists."""
    logger.info("🔧 Creating minimal configuration for JustMove mode...")
    
    # Scan for devices
    devices = list_serial_devices(auto_forward=True)
    if not devices:
        logger.error("❌ No serial devices found. Please connect your robot and try again.")
        return None
    
    display_devices(devices)
    
    # Get robot folders
    robot_folders = get_robot_folders()
    if not robot_folders:
        logger.error("❌ No robot folders found.")
        return None
    
    # Use the first robot folder and first device for quick setup
    robot_folder = robot_folders[0]
    device = devices[0][0]  # First device port
    
    logger.info(f"✅ Auto-selected robot: {robot_folder.name}")
    logger.info(f"✅ Auto-selected device: {device}")
    
    robot_config = {
        'folder': str(robot_folder),
        'device': device,
        'urdf': str(robot_folder / 'calib.urdf'),
        'calibration': str(robot_folder / 'calibration.json')
    }
    
    config = {
        'robots': [robot_config],
        'server': {
            'host': 'localhost',
            'port': 9000
        }
    }
    
    # Save for future use
    try:
        save_config([robot_config])
        logger.info("💾 Configuration saved for future use")
    except Exception as e:
        logger.warning(f"⚠️ Could not save config: {e}")
    
    return config


def main():
    """Main entry point."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="TeleTable Robot Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run robot-server                    # Normal server operation with auto-forwarding
  uv run robot-server -justmove         # Debug mode: continuous circular motion
  uv run robot-server --diagnose-usb    # Run USB device diagnostics
  uv run robot-server --scan-windows    # Scan Windows for USB devices and COM ports
  uv run robot-server --show-commands   # Show exact commands needed for USB setup
  uv run robot-server --scan-and-forward # Scan and forward robot devices from Windows
  uv run robot-server --bind-device 2-13 # Bind a specific USB device for sharing
  uv run robot-server --no-auto-forward # Disable automatic USB forwarding
        """
    )
    parser.add_argument(
        '-justmove', 
        action='store_true',
        help='Run in debug mode with continuous circular motion'
    )
    parser.add_argument(
        '--diagnose-usb',
        action='store_true',
        help='Run USB device diagnostics and exit'
    )
    parser.add_argument(
        '--auto-forward',
        action='store_true',
        default=True,
        help='Automatically forward robot devices from Windows to WSL (default: True)'
    )
    parser.add_argument(
        '--no-auto-forward',
        action='store_true',
        help='Disable automatic USB device forwarding'
    )
    parser.add_argument(
        '--scan-and-forward',
        action='store_true',
        help='Scan Windows for robot devices and forward them to WSL, then exit'
    )
    parser.add_argument(
        '--scan-windows',
        action='store_true',
        help='Scan Windows for USB devices and COM ports, then exit'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )
    parser.add_argument(
        '--bind-device',
        metavar='BUSID',
        help='Bind a specific USB device for sharing (e.g., 2-13)'
    )
    parser.add_argument(
        '--show-commands',
        action='store_true',
        help='Show exact commands needed to set up USB forwarding'
    )
    
    args = parser.parse_args()
    
    # Enable debug logging if requested
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logging.getLogger('robot_server').setLevel(logging.DEBUG)
    
    if args.diagnose_usb:
        diagnose_wsl_usb_issues()
        return
    
    if args.show_commands:
        logger.info("🔍 Scanning Windows for robot devices...")
        usb_devices = get_windows_usb_devices()
        robot_devices = [d for d in usb_devices if is_robot_device(d)]
        
        if robot_devices:
            print("\n" + "="*60)
            print("🔧 Exact Commands to Set Up USB Forwarding")
            print("="*60)
            print("1. Open Windows PowerShell as Administrator")
            print("2. Run these exact commands:")
            print()
            for device in robot_devices:
                if device['state'] == 'Not shared':
                    print(f"   usbipd bind --busid {device['busid']}")
            print()
            print("3. Then run this command in WSL:")
            print("   uv run robot-server --scan-and-forward")
            print()
            print("💡 Alternative: Run directly on Windows")
            print("   cd C:\\side\\teletable\\robot_server")
            print("   uv run robot-server")
            print("="*60)
        else:
            logger.info("No robot devices found on Windows")
        return
    
    if args.bind_device:
        logger.info(f"🔗 Binding USB device {args.bind_device} for sharing...")
        if bind_usb_device(args.bind_device):
            logger.info(f"✅ Device {args.bind_device} bound successfully")
            logger.info("💡 You can now run: uv run robot-server --scan-and-forward")
        else:
            logger.error(f"❌ Failed to bind device {args.bind_device}")
        return
    
    if args.scan_windows:
        logger.info("🔍 Scanning Windows for USB devices and COM ports...")
        
        # Scan USB devices
        usb_devices = get_windows_usb_devices()
        if usb_devices:
            logger.info(f"📱 Found {len(usb_devices)} USB device(s) on Windows:")
            for device in usb_devices:
                is_robot = is_robot_device(device)
                robot_indicator = "🤖" if is_robot else "📱"
                logger.info(f"  {robot_indicator} {device['busid']}: {device['name']} ({device['vid_pid']}) - {device['state']}")
        else:
            logger.info("No USB devices found via usbipd")
        
        # Scan COM ports
        com_ports = get_windows_com_ports()
        if com_ports:
            logger.info(f"🔌 Found {len(com_ports)} COM port(s) on Windows:")
            for port in com_ports:
                logger.info(f"  🔌 {port['device']}: {port['name']}")
        else:
            logger.info("No COM ports found")
        
        return
    
    if args.scan_and_forward:
        logger.info("🔍 Scanning and forwarding robot devices...")
        forwarded_devices = auto_forward_robot_devices()
        if forwarded_devices:
            logger.info(f"✅ Forwarded {len(forwarded_devices)} device(s)")
            # Wait and then scan for devices
            import time
            time.sleep(2)
            devices = list_serial_devices(auto_forward=False)
            if devices:
                logger.info("📱 Available devices in WSL:")
                display_devices(devices)
            else:
                logger.warning("No devices found in WSL after forwarding")
        else:
            logger.info("No robot devices found to forward")
        return
    
    if args.justmove:
        logger.info("🔄 TeleTable Robot Server - JustMove Debug Mode")
        
        # Try to load existing config first
        config = load_existing_config()
        
        if not config:
            config = create_minimal_config_for_justmove()
            if not config:
                logger.error("❌ Failed to create configuration for JustMove mode")
                return
        
        run_justmove_mode(config)
        return
    
    # Normal operation mode
    logger.info("🚀 TeleTable Robot Server - Normal Mode")
    
    # Step 1: Check for existing config
    existing_config = load_existing_config()
    
    if existing_config and ask_user_to_reuse_config(existing_config):
        logger.info("✅ Using existing configuration")
        start_server_with_config(existing_config)
        return
    
    # Step 2: Scan for connected devices
    logger.info("🔍 Scanning for connected devices...")
    auto_forward = args.auto_forward and not args.no_auto_forward
    devices = list_serial_devices(auto_forward=auto_forward)
    
    if not devices:
        logger.error("❌ No serial devices found. Please connect your robot(s) and try again.")
        return
    
    display_devices(devices)
    
    # Step 3: Get robot folders
    robot_folders = get_robot_folders()
    
    if not robot_folders:
        logger.error("❌ No robot folders found in robot_server/src/robot_server/robots/")
        return
    
    # Step 4: Map robots to devices
    robot_configs = map_robots_to_devices(robot_folders, devices)
    
    if not robot_configs:
        logger.error("❌ No robot-to-device mappings created")
        return
    
    # Step 5: Save configuration
    config = {
        'robots': robot_configs,
        'server': {
            'host': 'localhost',
            'port': 9000
        }
    }
    
    save_config(robot_configs)
    
    # Step 6: Start server
    logger.info("🎯 Configuration complete! Starting server...")
    start_server_with_config(config)


if __name__ == "__main__":
    main()
