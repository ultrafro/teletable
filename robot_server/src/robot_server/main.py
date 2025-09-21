#!/usr/bin/env python3
"""
WebSocket server for receiving hand tracking data from the TeleTable host.
This script receives hand position and orientation data and can be used to control a robot.

Usage:
    python -m robot_server.main [--port PORT] [--host HOST]
    OR
    robot-server [--port PORT] [--host HOST]

Default: ws://localhost:8765
"""

import asyncio
import websockets
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, Any

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RobotController:
    """
    Robot controller class that processes hand tracking data.
    
    This is a template class - replace the methods below with your actual robot control logic.
    """
    
    def __init__(self):
        self.last_update = None
        self.is_controlling = False
        logger.info("Robot controller initialized")
    
    def process_hand_data(self, hands_data: Dict[str, Any]) -> None:
        """
        Process incoming hand tracking data and control the robot.
        
        Args:
            hands_data: Dictionary containing left and right hand data
                       Each hand contains: position, orientation, open, detected, etc.
        """
        self.last_update = datetime.now()
        
        left_hand = hands_data.get('left', {})
        right_hand = hands_data.get('right', {})
        
        # Check if hands are detected
        left_detected = left_hand.get('detected', False)
        right_detected = right_hand.get('detected', False)
        
        if not (left_detected or right_detected):
            if self.is_controlling:
                logger.info("No hands detected - stopping robot control")
                self.stop_robot()
                self.is_controlling = False
            return
        
        if not self.is_controlling:
            logger.info("Hands detected - starting robot control")
            self.start_robot()
            self.is_controlling = True
        
        # Process left hand
        if left_detected:
            self.control_left_arm(left_hand)
        
        # Process right hand
        if right_detected:
            self.control_right_arm(right_hand)
    
    def control_left_arm(self, hand_data: Dict[str, Any]) -> None:
        """Control left robot arm based on left hand data."""
        position = hand_data.get('position', {})
        orientation = hand_data.get('orientation', {})
        gripper_pos = hand_data.get('gripperPosition', {})
        gripper_orient = hand_data.get('gripperOrientation', {})
        openness = hand_data.get('open', 0)
        
        logger.debug(f"Left hand - Pos: ({position.get('x', 0):.3f}, {position.get('y', 0):.3f}, {position.get('z', 0):.3f}), "
                    f"Gripper: {openness:.3f}")
        
        # TODO: Replace with your robot control logic
        # Example:
        # self.robot.move_left_arm(
        #     x=position.get('x', 0),
        #     y=position.get('y', 0), 
        #     z=position.get('z', 0),
        #     qx=orientation.get('x', 0),
        #     qy=orientation.get('y', 0),
        #     qz=orientation.get('z', 0),
        #     qw=orientation.get('w', 1)
        # )
        # self.robot.set_left_gripper(openness)
    
    def control_right_arm(self, hand_data: Dict[str, Any]) -> None:
        """Control right robot arm based on right hand data."""
        position = hand_data.get('position', {})
        orientation = hand_data.get('orientation', {})
        gripper_pos = hand_data.get('gripperPosition', {})
        gripper_orient = hand_data.get('gripperOrientation', {})
        openness = hand_data.get('open', 0)
        
        logger.debug(f"Right hand - Pos: ({position.get('x', 0):.3f}, {position.get('y', 0):.3f}, {position.get('z', 0):.3f}), "
                    f"Gripper: {openness:.3f}")
        
        # TODO: Replace with your robot control logic
        # Example:
        # self.robot.move_right_arm(
        #     x=position.get('x', 0),
        #     y=position.get('y', 0),
        #     z=position.get('z', 0),
        #     qx=orientation.get('x', 0),
        #     qy=orientation.get('y', 0),
        #     qz=orientation.get('z', 0),
        #     qw=orientation.get('w', 1)
        # )
        # self.robot.set_right_gripper(openness)
    
    def start_robot(self) -> None:
        """Initialize robot for control."""
        logger.info("🤖 Starting robot control")
        # TODO: Add robot initialization code here
        # Example:
        # self.robot.enable()
        # self.robot.set_control_mode('position')
    
    def stop_robot(self) -> None:
        """Stop robot control and return to safe state."""
        logger.info("🛑 Stopping robot control")
        # TODO: Add robot stopping/safe state code here
        # Example:
        # self.robot.move_to_home_position()
        # self.robot.disable()

class TeleTableRobotServer:
    """WebSocket server for receiving hand tracking data from TeleTable."""
    
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.robot_controller = RobotController()
        self.connected_clients = set()
        
    async def handle_client(self, websocket):
        """Handle a new WebSocket client connection."""
        client_addr = websocket.remote_address
        logger.info(f"🔗 New client connected: {client_addr}")
        self.connected_clients.add(websocket)
        
        try:
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "message": "Connected to TeleTable Robot Server",
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(welcome_msg))
            
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
        message_type = data.get("type")
        
        if message_type == "hand_data":
            # Process hand tracking data
            hands = data.get("hands", {})
            timestamp = data.get("timestamp", 0)
            
            # Log received data (comment out for production to reduce log noise)
            logger.debug(f"📥 Received hand data at {timestamp}")
            
            # Send to robot controller
            self.robot_controller.process_hand_data(hands)
            
            # Optional: Send acknowledgment back to client
            # ack_msg = {
            #     "type": "ack",
            #     "timestamp": timestamp
            # }
            # await websocket.send(json.dumps(ack_msg))
            
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
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            # Keep the server running
            await asyncio.Future()  # Run forever

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="TeleTable Robot WebSocket Server")
    parser.add_argument("--host", default="localhost", help="Host to bind to (default: localhost)")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    server = TeleTableRobotServer(host=args.host, port=args.port)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()
