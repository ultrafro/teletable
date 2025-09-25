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

logger = logging.getLogger(__name__)


class TeleTableRobotServer:
    """WebSocket server for receiving hand tracking data from TeleTable."""
    
    def __init__(self, host: str = "localhost", port: int = 8765):
        """
        Initialize the TeleTable Robot Server.
        
        Args:
            host: The host address to bind the server to
            port: The port number to listen on
        """
        self.host = host
        self.port = port
        self.robot_controller = RobotController()
        self.connected_clients: Set = set()
        logger.info(f"TeleTableRobotServer initialized on {host}:{port}")
        
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
