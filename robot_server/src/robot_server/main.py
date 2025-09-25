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
import argparse
import logging

from .server import TeleTableRobotServer

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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
