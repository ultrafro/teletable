"""
Device scanner for listing available serial ports and devices.

This module provides functionality to scan for and select serial devices
that can be used for robot communication.
"""

import logging
import sys
import subprocess
import json
import re
from typing import List, Optional, Tuple, Dict

logger = logging.getLogger(__name__)

try:
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False
    logger.warning("pyserial not available - device scanning disabled")

try:
    import pyudev
    PYUDEV_AVAILABLE = True
except ImportError:
    PYUDEV_AVAILABLE = False
    logger.debug("pyudev not available - using basic device detection")

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.debug("psutil not available - using basic device detection")


def detect_wsl_environment() -> bool:
    """Detect if running in WSL environment."""
    try:
        with open('/proc/version', 'r') as f:
            version_info = f.read().lower()
            return 'microsoft' in version_info or 'wsl' in version_info
    except:
        return False


def get_windows_usb_devices() -> List[Dict[str, str]]:
    """Get list of USB devices from Windows using usbipd."""
    devices = []
    
    try:
        # Try multiple methods to run usbipd from WSL
        commands_to_try = [
            # Method 1: Direct cmd.exe call
            ['cmd.exe', '/c', 'usbipd', 'list'],
            # Method 2: Using wsl.exe to run in Windows context
            ['wsl.exe', '-d', 'Windows', '--', 'usbipd', 'list'],
            # Method 3: Using PowerShell
            ['powershell.exe', '-Command', 'usbipd list'],
            # Method 4: Try to find usbipd in common locations
            ['/mnt/c/Windows/System32/cmd.exe', '/c', 'usbipd', 'list'],
        ]
        
        for cmd in commands_to_try:
            try:
                logger.debug(f"Trying command: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                
                if result.returncode == 0 and result.stdout.strip():
                    logger.debug(f"Success with command: {' '.join(cmd)}")
                    break
                else:
                    logger.debug(f"Command failed: {result.stderr}")
                    continue
                    
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                logger.debug(f"Command failed: {e}")
                continue
        
        if result.returncode != 0 or not result.stdout.strip():
            logger.warning("Could not run usbipd from WSL. Make sure usbipd is installed on Windows.")
            logger.warning("Install with: winget install usbipd")
            return devices
        
        # Parse the output
        lines = result.stdout.strip().split('\n')
        in_connected_section = False
        
        for line in lines:
            line = line.strip()
            if line.startswith('Connected:'):
                in_connected_section = True
                continue
            elif line.startswith('Persisted:') or line.startswith('GUID'):
                in_connected_section = False
                continue
            
            if in_connected_section and line and not line.startswith('BUSID'):
                # Parse line: "2-13   1a86:55d3  USB-Enhanced-SERIAL CH343 (COM3)                              Not shared"
                # Handle the case where "Not shared" might be split across words
                if 'Not shared' in line:
                    line = line.replace('Not shared', 'Not_shared')
                
                parts = line.split()
                if len(parts) >= 3:
                    busid = parts[0]
                    vid_pid = parts[1]
                    
                    # Find the state (last word or last two words if "Not_shared")
                    if parts[-1] == 'Not_shared' or (len(parts) >= 4 and ' '.join(parts[-2:]) == 'Not shared'):
                        state = 'Not shared'
                        device_name = ' '.join(parts[2:-2]) if len(parts) > 4 else ' '.join(parts[2:-1])
                    else:
                        state = parts[-1]
                        device_name = ' '.join(parts[2:-1]) if len(parts) > 3 else parts[2]
                    
                    # Clean up device name
                    device_name = device_name.replace('Not_shared', 'Not shared')
                    
                    devices.append({
                        'busid': busid,
                        'vid_pid': vid_pid,
                        'name': device_name,
                        'state': state
                    })
        
    except Exception as e:
        logger.debug(f"Error getting Windows USB devices: {e}")
    
    return devices


def is_robot_device(device: Dict[str, str]) -> bool:
    """Check if a device is likely a robot device based on name and VID:PID."""
    name = device.get('name', '').lower()
    vid_pid = device.get('vid_pid', '').lower()
    
    # Common robot device patterns
    robot_patterns = [
        'serial', 'uart', 'ch340', 'ch341', 'ch343', 'cp210', 'ft232', 'ftdi',
        'arduino', 'usb-serial', 'usb enhanced', 'usb to serial'
    ]
    
    # Common robot VID:PID patterns
    robot_vid_pids = [
        '1a86:',  # QinHeng Electronics (CH340, CH341, CH343)
        '0403:',  # FTDI
        '10c4:',  # Silicon Labs (CP210x)
        '067b:',  # Prolific Technology
        '2341:',  # Arduino
    ]
    
    # Check name patterns
    for pattern in robot_patterns:
        if pattern in name:
            return True
    
    # Check VID:PID patterns
    for vid_pattern in robot_vid_pids:
        if vid_pattern in vid_pid:
            return True
    
    return False


def bind_usb_device(busid: str) -> bool:
    """Bind a USB device for sharing using usbipd."""
    try:
        # Try multiple methods to run usbipd bind from WSL
        commands_to_try = [
            # Method 1: Direct cmd.exe call
            ['cmd.exe', '/c', 'usbipd', 'bind', '--busid', busid],
            # Method 2: Using PowerShell
            ['powershell.exe', '-Command', f'usbipd bind --busid {busid}'],
            # Method 3: Try to find usbipd in common locations
            ['/mnt/c/Windows/System32/cmd.exe', '/c', 'usbipd', 'bind', '--busid', busid],
        ]
        
        last_error = None
        for cmd in commands_to_try:
            try:
                logger.debug(f"Trying to bind {busid} with: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                
                if result.returncode == 0:
                    logger.info(f"✅ Successfully bound device {busid}")
                    return True
                else:
                    last_error = result.stderr
                    logger.debug(f"Bind command failed: {result.stderr}")
                    continue
                    
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                last_error = str(e)
                logger.debug(f"Bind command failed: {e}")
                continue
        
        # Provide simple error message
        logger.error(f"❌ You need to go to Windows PowerShell as Administrator, then run:")
        logger.error(f"   usbipd bind --busid {busid}")
        logger.error(f"   Then come back here and run: uv run robot-server")
        
        return False
            
    except Exception as e:
        logger.error(f"Error binding device {busid}: {e}")
        return False


def attach_device_to_wsl(busid: str) -> bool:
    """Attach a bound USB device to WSL using usbipd."""
    try:
        # Try multiple methods to run usbipd attach from WSL
        attach_commands = [
            # Method 1: Direct cmd.exe call
            ['cmd.exe', '/c', 'usbipd', 'attach', '--wsl', '--busid', busid],
            # Method 2: Using PowerShell
            ['powershell.exe', '-Command', f'usbipd attach --wsl --busid {busid}'],
            # Method 3: Try to find usbipd in common locations
            ['/mnt/c/Windows/System32/cmd.exe', '/c', 'usbipd', 'attach', '--wsl', '--busid', busid],
        ]
        
        for cmd in attach_commands:
            try:
                logger.debug(f"Trying to attach {busid} with: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                
                if result.returncode == 0:
                    logger.info(f"✅ Successfully attached device {busid} to WSL")
                    return True
                else:
                    logger.debug(f"Attach command failed: {result.stderr}")
                    continue
                    
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                logger.debug(f"Attach command failed: {e}")
                continue
        
        logger.warning(f"Failed to attach device {busid} to WSL")
        return False
            
    except Exception as e:
        logger.error(f"Error attaching device {busid}: {e}")
        return False


def forward_robot_device_to_wsl(busid: str) -> bool:
    """Forward a USB device to WSL using usbipd (bind first if needed)."""
    try:
        # First, try to attach the device
        attach_commands = [
            # Method 1: Direct cmd.exe call
            ['cmd.exe', '/c', 'usbipd', 'attach', '--wsl', '--busid', busid],
            # Method 2: Using PowerShell
            ['powershell.exe', '-Command', f'usbipd attach --wsl --busid {busid}'],
            # Method 3: Try to find usbipd in common locations
            ['/mnt/c/Windows/System32/cmd.exe', '/c', 'usbipd', 'attach', '--wsl', '--busid', busid],
        ]
        
        for cmd in attach_commands:
            try:
                logger.debug(f"Trying to attach {busid} with: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                
                if result.returncode == 0:
                    logger.info(f"✅ Successfully attached device {busid} to WSL")
                    return True
                else:
                    logger.debug(f"Attach command failed: {result.stderr}")
                    
                    # Check if the error indicates the device needs to be bound first
                    if "not shared" in result.stderr.lower() or "bind" in result.stderr.lower():
                        logger.info(f"🔄 Device {busid} needs to be bound first...")
                        if bind_usb_device(busid):
                            # Try attaching again after binding
                            logger.info(f"🔄 Retrying attach after binding...")
                            retry_result = subprocess.run(
                                cmd,
                                capture_output=True,
                                text=True,
                                timeout=20
                            )
                            if retry_result.returncode == 0:
                                logger.info(f"✅ Successfully attached device {busid} to WSL after binding")
                                return True
                            else:
                                logger.warning(f"Attach still failed after binding: {retry_result.stderr}")
                        else:
                            logger.warning(f"Failed to bind device {busid}, cannot attach")
                    continue
                    
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                logger.debug(f"Attach command failed: {e}")
                continue
        
        logger.warning(f"Failed to forward device {busid} with all methods")
        return False
            
    except Exception as e:
        logger.error(f"Error forwarding device {busid}: {e}")
        return False


def get_windows_com_ports() -> List[Dict[str, str]]:
    """Get Windows COM ports using PowerShell."""
    devices = []
    
    try:
        # PowerShell command to get COM ports
        ps_command = """
        Get-WmiObject -Class Win32_SerialPort | Select-Object DeviceID, Name, Description | ConvertTo-Json
        """
        
        result = subprocess.run(
            ['powershell.exe', '-Command', ps_command],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0 and result.stdout.strip():
            import json
            try:
                data = json.loads(result.stdout)
                if isinstance(data, list):
                    for port in data:
                        devices.append({
                            'device': port.get('DeviceID', ''),
                            'name': port.get('Name', ''),
                            'description': port.get('Description', '')
                        })
                elif isinstance(data, dict):
                    devices.append({
                        'device': data.get('DeviceID', ''),
                        'name': data.get('Name', ''),
                        'description': data.get('Description', '')
                    })
            except json.JSONDecodeError:
                logger.debug("Failed to parse PowerShell JSON output")
        
    except Exception as e:
        logger.debug(f"Error getting Windows COM ports: {e}")
    
    return devices


def auto_forward_robot_devices() -> List[str]:
    """Automatically forward robot devices from Windows to WSL."""
    forwarded_devices = []
    
    logger.info("🔍 Scanning Windows for robot devices...")
    windows_devices = get_windows_usb_devices()
    
    if not windows_devices:
        logger.warning("No USB devices found on Windows via usbipd")
        logger.info("🔍 Trying to get COM ports directly...")
        
        # Fallback: Get COM ports directly
        com_ports = get_windows_com_ports()
        if com_ports:
            logger.info(f"Found {len(com_ports)} COM port(s):")
            for port in com_ports:
                logger.info(f"  - {port['device']}: {port['name']}")
            
            # For COM ports, we can't forward them, but we can inform the user
            logger.info("💡 COM ports found. To use these in WSL:")
            logger.info("   1. Install usbipd on Windows: winget install usbipd")
            logger.info("   2. Forward the USB device that creates the COM port")
            logger.info("   3. Or run the robot server directly on Windows")
        
        return forwarded_devices
    
    robot_devices = [d for d in windows_devices if is_robot_device(d)]
    
    if not robot_devices:
        logger.info("No robot devices found on Windows")
        return forwarded_devices
    
    logger.info(f"Found {len(robot_devices)} potential robot device(s):")
    for device in robot_devices:
        logger.info(f"  - {device['busid']}: {device['name']} ({device['vid_pid']})")
    
    # Forward each robot device
    binding_required = False
    for device in robot_devices:
        busid = device['busid']
        if device['state'] == 'Not shared':
            logger.info(f"🔄 Forwarding {device['name']} ({busid}) to WSL...")
            if forward_robot_device_to_wsl(busid):
                forwarded_devices.append(busid)
            else:
                binding_required = True
        else:
            logger.info(f"Device {busid} already shared - attempting to attach to WSL...")
            # Device is bound but may not be attached to WSL yet
            if attach_device_to_wsl(busid):
                forwarded_devices.append(busid)
            else:
                logger.warning(f"Failed to attach device {busid} to WSL")
    
    # If binding was required but failed, provide simple instructions
    if binding_required and not forwarded_devices:
        # Get the first device that needs binding
        device_to_bind = next((d for d in robot_devices if d['state'] == 'Not shared'), None)
        if device_to_bind:
            logger.error(f"❌ You need to go to Windows PowerShell as Administrator, then run:")
            logger.error(f"   usbipd bind --busid {device_to_bind['busid']}")
            logger.error(f"   Then come back here and run: uv run robot-server")
    
    return forwarded_devices


def list_serial_devices(auto_forward: bool = True) -> List[Tuple[str, str, str]]:
    """
    List all available serial devices with enhanced WSL support and auto-forwarding.
    
    Args:
        auto_forward: If True, automatically forward robot devices from Windows to WSL
    
    Returns:
        List of tuples containing (device_path, description, hardware_id)
    """
    if not SERIAL_AVAILABLE:
        logger.error("pyserial not installed. Install with: uv add pyserial")
        return []
    
    devices = []
    is_wsl = detect_wsl_environment()
    
    if is_wsl:
        logger.info("🔍 WSL environment detected - using enhanced device detection")
        
        # Auto-forward robot devices from Windows if requested
        if auto_forward:
            logger.info("🔄 Attempting to auto-forward robot devices from Windows...")
            forwarded_devices = auto_forward_robot_devices()
            if forwarded_devices:
                logger.info(f"✅ Forwarded {len(forwarded_devices)} device(s) to WSL")
                # Wait a moment for devices to be available
                import time
                time.sleep(2)
            else:
                logger.info("No robot devices found to forward")
    
    try:
        # Primary method: pyserial
        ports = serial.tools.list_ports.comports()
        for port in ports:
            devices.append((
                port.device,
                port.description or "Unknown device", 
                port.hwid or "Unknown hardware ID"
            ))
        
        # Enhanced detection for WSL/Linux
        if is_wsl and not devices:
            logger.info("🔍 No devices found via pyserial, trying alternative methods...")
            devices.extend(_scan_devices_alternative())
        
        # Sort by device path for consistent ordering
        devices.sort(key=lambda x: x[0])
        
        if is_wsl and not devices:
            logger.warning("⚠️  WSL detected but no USB devices found.")
            logger.warning("   This is common in WSL - USB devices need to be forwarded from Windows.")
            logger.warning("   Consider using USB/IP or running on Windows directly.")
        
    except Exception as e:
        logger.error(f"Error scanning for serial devices: {e}")
        
    return devices


def _scan_devices_alternative() -> List[Tuple[str, str, str]]:
    """Alternative device scanning methods for WSL/Linux."""
    devices = []
    
    # Method 1: Check common device paths
    import os
    import glob
    
    common_paths = [
        '/dev/ttyUSB*',
        '/dev/ttyACM*', 
        '/dev/ttyS*',
        '/dev/serial/by-id/*',
        '/dev/serial/by-path/*'
    ]
    
    logger.debug("🔍 Scanning alternative device paths...")
    for pattern in common_paths:
        try:
            found_devices = glob.glob(pattern)
            logger.debug(f"Pattern {pattern}: found {len(found_devices)} devices")
            for device in found_devices:
                logger.debug(f"Checking device: {device}")
                if os.path.exists(device) and os.access(device, os.R_OK | os.W_OK):
                    # Try to get more info about the device
                    description = "USB Serial Device"
                    hwid = "Unknown"
                    
                    # Try to get device info from sysfs
                    try:
                        device_name = os.path.basename(device)
                        sysfs_path = f"/sys/class/tty/{device_name}/device"
                        if os.path.exists(sysfs_path):
                            # Try to read vendor/product info
                            vendor_path = os.path.join(sysfs_path, "idVendor")
                            product_path = os.path.join(sysfs_path, "idProduct")
                            if os.path.exists(vendor_path) and os.path.exists(product_path):
                                with open(vendor_path, 'r') as f:
                                    vendor = f.read().strip()
                                with open(product_path, 'r') as f:
                                    product = f.read().strip()
                                hwid = f"USB VID:PID={vendor}:{product}"
                    except Exception as e:
                        logger.debug(f"Error reading device info for {device}: {e}")
                    
                    logger.debug(f"Adding device: {device} - {description} - {hwid}")
                    devices.append((device, description, hwid))
                else:
                    logger.debug(f"Device {device} not accessible")
        except Exception as e:
            logger.debug(f"Error scanning {pattern}: {e}")
    
    # Method 2: Use pyudev if available
    if PYUDEV_AVAILABLE:
        try:
            logger.debug("🔍 Using pyudev for device detection...")
            context = pyudev.Context()
            for device in context.list_devices(subsystem='tty'):
                device_path = device.device_node
                if device_path and any(pattern.replace('*', '') in device_path for pattern in ['ttyUSB', 'ttyACM']):
                    description = device.get('ID_MODEL', 'Unknown device')
                    hwid = f"USB VID:PID={device.get('ID_VENDOR_ID', 'unknown')}:{device.get('ID_MODEL_ID', 'unknown')}"
                    logger.debug(f"pyudev found device: {device_path} - {description} - {hwid}")
                    devices.append((device_path, description, hwid))
        except Exception as e:
            logger.debug(f"Error using pyudev: {e}")
    
    # Method 3: Check if usbip devices are available
    try:
        logger.debug("🔍 Checking for usbip devices...")
        usbip_devices = glob.glob('/dev/bus/usb/*/*')
        if usbip_devices:
            logger.debug(f"Found {len(usbip_devices)} usbip devices")
            # Check if any of these correspond to serial devices
            for usb_device in usbip_devices:
                logger.debug(f"USB device: {usb_device}")
    except Exception as e:
        logger.debug(f"Error checking usbip devices: {e}")
    
    logger.debug(f"Alternative scanning found {len(devices)} devices")
    return devices


def display_devices(devices: List[Tuple[str, str, str]]) -> None:
    """
    Display available devices in a formatted list.
    
    Args:
        devices: List of (device_path, description, hardware_id) tuples
    """
    if not devices:
        print("❌ No serial devices found.")
        print("   Make sure your robot is connected and powered on.")
        return
    
    print(f"\n📱 Found {len(devices)} serial device(s):")
    print("=" * 80)
    
    for i, (device, description, hwid) in enumerate(devices):
        print(f"  {i + 1}. {device}")
        print(f"     Description: {description}")
        print(f"     Hardware ID: {hwid}")
        print()


def select_device_interactive(devices: List[Tuple[str, str, str]]) -> Optional[str]:
    """
    Interactively select a device from the list.
    
    Args:
        devices: List of (device_path, description, hardware_id) tuples
        
    Returns:
        Selected device path or None if cancelled
    """
    if not devices:
        return None
    
    while True:
        try:
            print("Select a device:")
            choice = input(f"Enter device number (1-{len(devices)}) or 'q' to quit: ").strip().lower()
            
            if choice == 'q' or choice == 'quit':
                print("Device selection cancelled.")
                return None
            
            device_num = int(choice)
            if 1 <= device_num <= len(devices):
                selected_device = devices[device_num - 1][0]
                print(f"✅ Selected device: {selected_device}")
                return selected_device
            else:
                print(f"❌ Invalid selection. Please enter a number between 1 and {len(devices)}.")
                
        except ValueError:
            print("❌ Invalid input. Please enter a number or 'q' to quit.")
        except KeyboardInterrupt:
            print("\n\nDevice selection cancelled.")
            return None


def auto_select_device(devices: List[Tuple[str, str, str]], preferred_patterns: List[str] = None) -> Optional[str]:
    """
    Automatically select a device based on common patterns.
    
    Args:
        devices: List of (device_path, description, hardware_id) tuples
        preferred_patterns: List of string patterns to look for in device descriptions
        
    Returns:
        Selected device path or None if no suitable device found
    """
    if not devices:
        return None
    
    if preferred_patterns is None:
        preferred_patterns = [
            "arduino", "usb", "serial", "uart", "ch340", "ch341", "cp210", "ft232", "so101"
        ]
    
    # Try to find a device matching preferred patterns
    for pattern in preferred_patterns:
        for device, description, hwid in devices:
            if (pattern.lower() in description.lower() or 
                pattern.lower() in device.lower() or
                pattern.lower() in hwid.lower()):
                logger.info(f"Auto-selected device: {device} (matched pattern: {pattern})")
                return device
    
    # If no pattern matches, return the first device
    first_device = devices[0][0]
    logger.info(f"Auto-selected first device: {first_device}")
    return first_device


def scan_and_select_device(auto_select: bool = False, 
                          interactive: bool = True,
                          preferred_patterns: List[str] = None) -> Optional[str]:
    """
    Scan for devices and select one either automatically or interactively.
    
    Args:
        auto_select: If True, automatically select a device using patterns
        interactive: If True, allow interactive selection when auto_select fails
        preferred_patterns: Patterns to use for auto-selection
        
    Returns:
        Selected device path or None
    """
    print("🔍 Scanning for connected devices...")
    devices = list_serial_devices()
    
    if not devices:
        return None
    
    display_devices(devices)
    
    if auto_select:
        selected = auto_select_device(devices, preferred_patterns)
        if selected:
            return selected
        elif not interactive:
            print("❌ Auto-selection failed and interactive mode disabled.")
            return None
    
    if interactive:
        return select_device_interactive(devices)
    
    return None


def diagnose_wsl_usb_issues() -> None:
    """Provide diagnostic information for WSL USB issues."""
    print("\n" + "="*60)
    print("🔧 WSL USB Device Diagnostics")
    print("="*60)
    
    is_wsl = detect_wsl_environment()
    print(f"WSL Environment: {'Yes' if is_wsl else 'No'}")
    
    if is_wsl:
        print("\n📋 WSL USB Troubleshooting Steps:")
        print("1. Install USB/IP on Windows:")
        print("   - Download from: https://github.com/cezanne/usbip-win")
        print("   - Or use: winget install usbipd")
        print()
        print("2. Forward USB device from Windows to WSL:")
        print("   - List devices: usbipd wsl list")
        print("   - Attach device: usbipd wsl attach --busid <BUSID>")
        print()
        print("3. Alternative: Use Windows directly")
        print("   - Run the robot server in Windows PowerShell/CMD")
        print("   - Or use Windows Terminal with WSL integration")
        print()
        print("4. Check device permissions in WSL:")
        print("   - ls -l /dev/tty*")
        print("   - sudo chmod 666 /dev/ttyUSB* (if devices exist)")
        print()
    
    # Check system information
    if PSUTIL_AVAILABLE:
        try:
            import platform
            print(f"Platform: {platform.platform()}")
            print(f"Architecture: {platform.architecture()}")
        except:
            pass
    
    # Check for common device paths
    import os
    import glob
    
    print("\n🔍 Checking common device paths:")
    device_paths = ['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/serial/*']
    for pattern in device_paths:
        devices = glob.glob(pattern)
        if devices:
            print(f"  {pattern}: {len(devices)} devices found")
            for device in devices[:3]:  # Show first 3
                print(f"    - {device}")
        else:
            print(f"  {pattern}: No devices found")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    # Test the device scanner
    print("Device Scanner Test")
    print("=" * 30)
    
    # Run diagnostics first
    diagnose_wsl_usb_issues()
    
    device = scan_and_select_device(auto_select=False, interactive=True)
    if device:
        print(f"\nFinal selection: {device}")
    else:
        print("\nNo device selected.")
