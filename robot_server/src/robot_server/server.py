"""
TeleTable Robot Server WebSocket implementation.

This module contains the TeleTableRobotServer class that handles WebSocket connections
from TeleTable hosts and processes hand tracking data for robot control.
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Dict, Any, Set

from .robot_controller import RobotController
from .ik_robot_controller import IKRobotController

logger = logging.getLogger(__name__)


class TeleTableRobotServer:
    """WebSocket server for receiving hand tracking data from TeleTable."""
    
    def __init__(self, host: str = "localhost", port: int = 8765, 
                 use_ik_controller: bool = False,
                 urdf_path: str = None,
                 robot_config_path: str = None,
                 robot_port: str = None,
                 use_simulation: bool = True):
        """
        Initialize the TeleTable Robot Server.
        
        Args:
            host: The host address to bind the server to
            port: The port number to listen on
            use_ik_controller: Whether to use IK controller for precise pose control
            urdf_path: Path to robot URDF file (for IK controller)
            robot_config_path: Path to robot configuration (for IK controller)
            robot_port: Serial port for robot communication (for IK controller)
            use_simulation: Whether to use simulation mode (for IK controller)
        """
        self.host = host
        self.port = port
        self.use_ik_controller = use_ik_controller
        
        # Initialize robot controllers
        self.robot_controller = RobotController()
        
        if use_ik_controller:
            self.ik_controller = IKRobotController(
                urdf_path=urdf_path,
                robot_config_path=robot_config_path,
                robot_port=robot_port,
                use_simulation=use_simulation
            )
            self.ik_controller.connect()
        else:
            self.ik_controller = None
            
        self.connected_clients: Set = set()
        controller_type = "IK Controller" if use_ik_controller else "Basic Controller"
        logger.info(f"TeleTableRobotServer initialized on {host}:{port} with {controller_type}")
        
    async def handle_client(self, websocket):
        """Handle a new WebSocket client connection."""
        client_addr = websocket.remote_address
        logger.info(f"🔗 New client connected: {client_addr}")
        self.connected_clients.add(websocket)
        logger.info(f"New Client Connection. Connected clients: {len(self.connected_clients)}")
        
        try:
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "message": "Connected to TeleTable Robot Server",
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(welcome_msg))
            logger.info(f"Sent welcome message to client: {client_addr}")
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(websocket, data)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received from {client_addr}: {e}")
                    error_msg = {
                        "type": "error",
                        "message": "Invalid JSON format"
                    }
                    await websocket.send(json.dumps(error_msg))
                except Exception as e:
                    logger.error(f"Error processing message from {client_addr}: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"📱 Client disconnected: {client_addr}")
        except Exception as e:
            logger.error(f"Error handling client {client_addr}: {e}")
        finally:
            self.connected_clients.discard(websocket)
    
    async def process_message(self, websocket, data: Dict[str, Any]):
        """Process incoming WebSocket message."""
        logger.info(f"Got raw message: {data}")

        message_type = data.get("type")
        
        if message_type == "hand_data":
            # Process hand tracking data
            hands = data.get("hands", {})
            timestamp = data.get("timestamp", 0)
            
            # Log received data (comment out for production to reduce log noise)
            logger.debug(f"📥 Received hand data at {timestamp}")
            
            # Send to robot controller
            self.robot_controller.process_hand_data(hands)
            
        elif message_type == "pose_control":
            # Process pose control command for IK controller
            if not self.ik_controller:
                error_msg = {
                    "type": "error",
                    "message": "IK controller not available. Server must be initialized with use_ik_controller=True"
                }
                await websocket.send(json.dumps(error_msg))
                return
            
            # Extract pose parameters
            pose_data = data.get("pose", {})
            x = pose_data.get("x", 0.0)
            y = pose_data.get("y", 0.0) 
            z = pose_data.get("z", 0.0)
            qx = pose_data.get("qx", 0.0)
            qy = pose_data.get("qy", 0.0)
            qz = pose_data.get("qz", 0.0)
            qw = pose_data.get("qw", 1.0)
            gripper = pose_data.get("gripper", None)
            smooth = pose_data.get("smooth", True)
            
            logger.info(f"📍 Pose control command: pos=({x:.3f}, {y:.3f}, {z:.3f}), "
                       f"quat=({qx:.3f}, {qy:.3f}, {qz:.3f}, {qw:.3f})")
            
            # Execute pose control
            success = self.ik_controller.move_to_pose(x, y, z, qx, qy, qz, qw, gripper, smooth)
            
            # Send response
            response_msg = {
                "type": "pose_control_response",
                "success": success,
                "current_pose": self.ik_controller.get_current_pose() if success else None,
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(response_msg))
            
        elif message_type == "get_pose":
            # Get current robot pose
            if not self.ik_controller:
                error_msg = {
                    "type": "error", 
                    "message": "IK controller not available"
                }
                await websocket.send(json.dumps(error_msg))
                return
            
            current_pose = self.ik_controller.get_current_pose()
            response_msg = {
                "type": "current_pose",
                "pose": {
                    "x": current_pose[0],
                    "y": current_pose[1],
                    "z": current_pose[2],
                    "qx": current_pose[3],
                    "qy": current_pose[4],
                    "qz": current_pose[5],
                    "qw": current_pose[6]
                },
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(response_msg))
            
        elif message_type == "home_robot":
            # Move robot to home position
            if not self.ik_controller:
                error_msg = {
                    "type": "error",
                    "message": "IK controller not available"
                }
                await websocket.send(json.dumps(error_msg))
                return
            
            self.ik_controller.home_position()
            response_msg = {
                "type": "home_response",
                "success": True,
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(response_msg))
            
        elif message_type == "ping":
            # Respond to ping with pong
            pong_msg = {
                "type": "pong",
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(pong_msg))
            
        else:
            logger.warning(f"Unknown message type: {message_type}")
    
    async def start_server(self):
        """Start the WebSocket server."""
        logger.info(f"🚀 Starting TeleTable Robot Server on {self.host}:{self.port}")
        logger.info(f"📡 Waiting for connections from TeleTable host...")
        
        try:
            async with websockets.serve(self.handle_client, self.host, self.port):
                # Keep the server running
                await asyncio.Future()  # Run forever
        finally:
            # Cleanup on server shutdown
            if self.ik_controller:
                self.ik_controller.disconnect()
                logger.info("IK controller disconnected")
    
    def __del__(self):
        """Cleanup when server object is destroyed."""
        if hasattr(self, 'ik_controller') and self.ik_controller:
            self.ik_controller.disconnect()
