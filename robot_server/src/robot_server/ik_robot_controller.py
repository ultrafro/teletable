"""
Inverse Kinematics Robot Controller for precise end-effector pose control.

This module contains the IKRobotController class that accepts x,y,z,qx,qy,qz,qw 
pose commands and uses IK to compute joint angles for the robot arm.
"""

import logging
import numpy as np
from typing import Dict

logger = logging.getLogger(__name__)


class IKRobotController:
    """
    Inverse Kinematics Robot Controller for precise end-effector pose control.
    
    This controller accepts x,y,z,qx,qy,qz,qw pose commands and uses IK to compute
    joint angles for the robot arm.
    """
    
    def __init__(self, 
                 urdf_path: str = None,
                 robot_config_path: str = None,
                 robot_port: str = None,
                 use_simulation: bool = True,
                 workspace_limits: Dict[str, tuple] = None):
        """
        Initialize IK Robot Controller.
        
        Args:
            urdf_path: Path to robot URDF file for kinematics
            robot_config_path: Path to robot configuration
            robot_port: Serial port for robot communication
            use_simulation: If True, only simulate movements without actual robot
            workspace_limits: Dict with keys 'x', 'y', 'z' and values as (min, max) tuples
        """
        self.use_simulation = use_simulation
        self.robot_port = robot_port
        self.is_connected = False
        self.current_pose = np.eye(4)  # Current end-effector pose
        self.current_joint_positions = np.zeros(6)  # 5 arm joints + gripper
        self.target_pose = np.eye(4)
        
        # Set default workspace limits (in meters)
        self.workspace_limits = workspace_limits or {
            'x': (-0.3, 0.3),
            'y': (-0.3, 0.3), 
            'z': (0.05, 0.4)
        }
        
        # Initialize robot components
        self.robot = None
        self.kinematics = None
        
        # Motion parameters
        self.max_linear_velocity = 0.1  # m/s
        self.max_angular_velocity = 1.0  # rad/s
        self.interpolation_steps = 10
        
        if not use_simulation:
            self._initialize_real_robot(urdf_path, robot_config_path, robot_port)
        else:
            logger.info("IK Robot Controller initialized in simulation mode")
    
    def _initialize_real_robot(self, urdf_path: str, robot_config_path: str, robot_port: str):
        """Initialize real robot connection and kinematics."""
        try:
            # Import LeRobot components
            from lerobot.robots.so101_follower.so101_follower import SO101Follower
            from lerobot.robots.so101_follower.config_so101_follower import SO101FollowerConfig
            from lerobot.model.kinematics import RobotKinematics
            
            # Load robot configuration
            if robot_config_path:
                from pathlib import Path
                import shutil
                
                logger.info(f"📋 Calibration file available: {robot_config_path}")
                
                # Extract robot folder and ID from the calibration file path
                calibration_path = Path(robot_config_path)
                robot_folder = calibration_path.parent
                robot_id = robot_folder.name  # Use folder name as robot ID
                
                logger.info(f"🤖 Robot ID: {robot_id}")
                logger.info(f"📁 Robot folder: {robot_folder}")
                
                # Check if calibration file needs to be renamed to match robot ID
                expected_calibration_file = robot_folder / f"{robot_id}.json"
                if calibration_path != expected_calibration_file:
                    logger.info(f"📋 Renaming calibration file from {calibration_path.name} to {expected_calibration_file.name}")
                    shutil.copy2(calibration_path, expected_calibration_file)
                    logger.info(f"✅ Calibration file copied to: {expected_calibration_file}")
                
                # Create config object with proper calibration directory and robot ID
                config = SO101FollowerConfig(
                    port=robot_port or "/dev/ttyUSB0",
                    use_degrees=False,
                    id=robot_id,
                    calibration_dir=robot_folder
                )
                logger.info(f"🔧 Created SO101FollowerConfig with calibration_dir={robot_folder}, id={robot_id}")
            else:
                # Use default configuration with selected port
                config = SO101FollowerConfig(
                    port=robot_port or "/dev/ttyUSB0",  # Use selected port or default
                    use_degrees=False
                )
                logger.warning("⚠️ No calibration file provided, using default configuration")
            
            # Initialize robot
            logger.info(f"🔧 Initializing SO101Follower with config: port={config.port}, id={config.id}, calibration_dir={config.calibration_dir}")
            self.robot = SO101Follower(config)
            
            # Initialize kinematics solver
            if urdf_path:
                joint_names = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll"]
                self.kinematics = RobotKinematics(
                    urdf_path=urdf_path,
                    target_frame_name="gripper_frame_link",
                    joint_names=joint_names
                )
            
            logger.info("IK Robot Controller initialized with real robot")
            
        except ImportError as e:
            logger.warning(f"LeRobot not available, falling back to simulation: {e}")
            self.use_simulation = True
        except Exception as e:
            logger.error(f"Failed to initialize real robot: {e}")
            self.use_simulation = True
    
    def connect(self):
        """Connect to the robot."""
        if self.use_simulation:
            self.is_connected = True
            logger.info("Connected to simulated robot")
            return
        
        try:
            if self.robot:
                self.robot.connect()
                self.is_connected = True
                # Get initial joint positions
                obs = self.robot.get_observation()
                self.current_joint_positions = np.array([
                    obs.get("shoulder_pan.pos", 0),
                    obs.get("shoulder_lift.pos", 0),
                    obs.get("elbow_flex.pos", 0),
                    obs.get("wrist_flex.pos", 0),
                    obs.get("wrist_roll.pos", 0),
                    obs.get("gripper.pos", 50)
                ])
                
                # Compute initial pose using forward kinematics
                if self.kinematics:
                    self.current_pose = self.kinematics.forward_kinematics(self.current_joint_positions[:5])
                
                logger.info("Connected to real robot")
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            self.is_connected = False
    
    def disconnect(self):
        """Disconnect from the robot."""
        if not self.use_simulation and self.robot:
            try:
                self.robot.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting robot: {e}")
        
        self.is_connected = False
        logger.info("Disconnected from robot")
    
    def pose_to_matrix(self, x: float, y: float, z: float, 
                      qx: float, qy: float, qz: float, qw: float) -> np.ndarray:
        """
        Convert position and quaternion to 4x4 transformation matrix.
        
        Args:
            x, y, z: Position in meters
            qx, qy, qz, qw: Quaternion (normalized)
            
        Returns:
            4x4 transformation matrix
        """
        # Normalize quaternion
        q_norm = np.sqrt(qx*qx + qy*qy + qz*qz + qw*qw)
        if q_norm > 0:
            qx, qy, qz, qw = qx/q_norm, qy/q_norm, qz/q_norm, qw/q_norm
        
        # Convert quaternion to rotation matrix
        R = np.array([
            [1 - 2*(qy*qy + qz*qz), 2*(qx*qy - qz*qw), 2*(qx*qz + qy*qw)],
            [2*(qx*qy + qz*qw), 1 - 2*(qx*qx + qz*qz), 2*(qy*qz - qx*qw)],
            [2*(qx*qz - qy*qw), 2*(qy*qz + qx*qw), 1 - 2*(qx*qx + qy*qy)]
        ])
        
        # Create 4x4 transformation matrix
        T = np.eye(4)
        T[:3, :3] = R
        T[:3, 3] = [x, y, z]
        
        return T
    
    def matrix_to_pose(self, T: np.ndarray) -> tuple:
        """
        Convert 4x4 transformation matrix to position and quaternion.
        
        Returns:
            (x, y, z, qx, qy, qz, qw)
        """
        x, y, z = T[:3, 3]
        R = T[:3, :3]
        
        # Convert rotation matrix to quaternion
        trace = np.trace(R)
        if trace > 0:
            s = np.sqrt(trace + 1.0) * 2
            qw = 0.25 * s
            qx = (R[2, 1] - R[1, 2]) / s
            qy = (R[0, 2] - R[2, 0]) / s
            qz = (R[1, 0] - R[0, 1]) / s
        else:
            if R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
                s = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
                qw = (R[2, 1] - R[1, 2]) / s
                qx = 0.25 * s
                qy = (R[0, 1] + R[1, 0]) / s
                qz = (R[0, 2] + R[2, 0]) / s
            elif R[1, 1] > R[2, 2]:
                s = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
                qw = (R[0, 2] - R[2, 0]) / s
                qx = (R[0, 1] + R[1, 0]) / s
                qy = 0.25 * s
                qz = (R[1, 2] + R[2, 1]) / s
            else:
                s = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
                qw = (R[1, 0] - R[0, 1]) / s
                qx = (R[0, 2] + R[2, 0]) / s
                qy = (R[1, 2] + R[2, 1]) / s
                qz = 0.25 * s
        
        return x, y, z, qx, qy, qz, qw
    
    def check_workspace_limits(self, x: float, y: float, z: float) -> bool:
        """Check if target position is within workspace limits."""
        return (self.workspace_limits['x'][0] <= x <= self.workspace_limits['x'][1] and
                self.workspace_limits['y'][0] <= y <= self.workspace_limits['y'][1] and
                self.workspace_limits['z'][0] <= z <= self.workspace_limits['z'][1])
    
    def interpolate_poses(self, start_pose: np.ndarray, end_pose: np.ndarray, steps: int) -> list:
        """
        Generate interpolated poses between start and end poses.
        
        Args:
            start_pose: Starting 4x4 transformation matrix
            end_pose: Target 4x4 transformation matrix  
            steps: Number of interpolation steps
            
        Returns:
            List of interpolated 4x4 transformation matrices
        """
        poses = []
        
        # Extract positions and orientations
        start_pos = start_pose[:3, 3]
        end_pos = end_pose[:3, 3]
        
        start_x, start_y, start_z, start_qx, start_qy, start_qz, start_qw = self.matrix_to_pose(start_pose)
        end_x, end_y, end_z, end_qx, end_qy, end_qz, end_qw = self.matrix_to_pose(end_pose)
        
        for i in range(steps + 1):
            t = i / steps
            
            # Linear interpolation for position
            pos = start_pos + t * (end_pos - start_pos)
            
            # SLERP for quaternion interpolation
            dot = start_qx*end_qx + start_qy*end_qy + start_qz*end_qz + start_qw*end_qw
            
            # If dot product is negative, use -q to ensure shorter path
            if dot < 0:
                end_qx, end_qy, end_qz, end_qw = -end_qx, -end_qy, -end_qz, -end_qw
                dot = -dot
            
            # If quaternions are very close, use linear interpolation
            if dot > 0.9995:
                qx = start_qx + t * (end_qx - start_qx)
                qy = start_qy + t * (end_qy - start_qy)
                qz = start_qz + t * (end_qz - start_qz)
                qw = start_qw + t * (end_qw - start_qw)
            else:
                # SLERP
                theta_0 = np.arccos(abs(dot))
                theta = theta_0 * t
                sin_theta_0 = np.sin(theta_0)
                sin_theta = np.sin(theta)
                
                s0 = np.cos(theta) - dot * sin_theta / sin_theta_0
                s1 = sin_theta / sin_theta_0
                
                qx = s0 * start_qx + s1 * end_qx
                qy = s0 * start_qy + s1 * end_qy
                qz = s0 * start_qz + s1 * end_qz
                qw = s0 * start_qw + s1 * end_qw
            
            # Normalize quaternion
            q_norm = np.sqrt(qx*qx + qy*qy + qz*qz + qw*qw)
            if q_norm > 0:
                qx, qy, qz, qw = qx/q_norm, qy/q_norm, qz/q_norm, qw/q_norm
            
            # Create interpolated pose
            interpolated_pose = self.pose_to_matrix(pos[0], pos[1], pos[2], qx, qy, qz, qw)
            poses.append(interpolated_pose)
        
        return poses
    
    def move_to_pose(self, x: float, y: float, z: float,
                    qx: float, qy: float, qz: float, qw: float,
                    gripper_position: float = None,
                    smooth: bool = True) -> bool:
        """
        Move robot end-effector to specified pose using inverse kinematics.
        
        Args:
            x, y, z: Target position in meters
            qx, qy, qz, qw: Target orientation as quaternion
            gripper_position: Gripper position (0-100), None to keep current
            smooth: Whether to use smooth interpolated motion
            
        Returns:
            True if movement was successful, False otherwise
        """
        if not self.is_connected:
            logger.warning("Robot not connected")
            return False
        
        # Check workspace limits
        if not self.check_workspace_limits(x, y, z):
            logger.warning(f"Target position ({x:.3f}, {y:.3f}, {z:.3f}) outside workspace limits")
            return False
        
        # Convert to transformation matrix
        target_pose = self.pose_to_matrix(x, y, z, qx, qy, qz, qw)
        
        try:
            if self.use_simulation:
                # Simulation mode
                if smooth:
                    poses = self.interpolate_poses(self.current_pose, target_pose, self.interpolation_steps)
                    for pose in poses:
                        self.current_pose = pose
                        logger.debug(f"Simulated move to pose: {self.matrix_to_pose(pose)}")
                else:
                    self.current_pose = target_pose
                
                # Update gripper position
                if gripper_position is not None:
                    self.current_joint_positions[5] = np.clip(gripper_position, 0, 100)
                
                logger.info(f"Simulated move to pose: ({x:.3f}, {y:.3f}, {z:.3f}), "
                           f"quat: ({qx:.3f}, {qy:.3f}, {qz:.3f}, {qw:.3f})")
                return True
            
            else:
                # Real robot mode
                if not self.kinematics:
                    logger.error("Kinematics solver not initialized")
                    return False
                
                # Compute inverse kinematics
                target_joints = self.kinematics.inverse_kinematics(
                    self.current_joint_positions,
                    target_pose
                )
                
                # Prepare action dictionary
                action = {
                    "shoulder_pan.pos": target_joints[0],
                    "shoulder_lift.pos": target_joints[1], 
                    "elbow_flex.pos": target_joints[2],
                    "wrist_flex.pos": target_joints[3],
                    "wrist_roll.pos": target_joints[4],
                }
                
                # Add gripper if specified
                if gripper_position is not None:
                    action["gripper.pos"] = np.clip(gripper_position, 0, 100)
                else:
                    action["gripper.pos"] = self.current_joint_positions[5]
                
                # Send action to robot
                if smooth:
                    # Generate smooth trajectory
                    poses = self.interpolate_poses(self.current_pose, target_pose, self.interpolation_steps)
                    for pose in poses:
                        joints = self.kinematics.inverse_kinematics(self.current_joint_positions, pose)
                        step_action = {
                            "shoulder_pan.pos": joints[0],
                            "shoulder_lift.pos": joints[1],
                            "elbow_flex.pos": joints[2], 
                            "wrist_flex.pos": joints[3],
                            "wrist_roll.pos": joints[4],
                            "gripper.pos": action["gripper.pos"]
                        }
                        self.robot.send_action(step_action)
                        self.current_joint_positions = joints
                else:
                    self.robot.send_action(action)
                    self.current_joint_positions = target_joints
                
                self.current_pose = target_pose
                logger.info(f"Moved robot to pose: ({x:.3f}, {y:.3f}, {z:.3f})")
                return True
                
        except Exception as e:
            logger.error(f"Failed to move to pose: {e}")
            return False
    
    def get_current_pose(self) -> tuple:
        """
        Get current end-effector pose.
        
        Returns:
            (x, y, z, qx, qy, qz, qw) tuple
        """
        return self.matrix_to_pose(self.current_pose)
    
    def home_position(self):
        """Move robot to home position."""
        # Default home pose (adjust as needed)
        self.move_to_pose(0.2, 0.0, 0.2, 0.0, 0.0, 0.0, 1.0, gripper_position=50.0)
        logger.info("Moved to home position")
        
    def move_in_circle(self, center_x: float = 0.2, center_y: float = 0.0, center_z: float = 0.2,
                      radius: float = 0.05, duration_seconds: float = 2.0) -> None:
        """
        Move the end effector in a continuous circle for debugging purposes.
        
        Args:
            center_x, center_y, center_z: Center point of the circle
            radius: Radius of the circle in meters
            duration_seconds: Time to complete one full circle
        """
        import time
        import math
        
        if not self.is_connected:
            logger.warning("Robot not connected, cannot move in circle")
            return
        
        logger.info(f"🔄 Starting circular motion: center=({center_x:.3f}, {center_y:.3f}, {center_z:.3f}), radius={radius:.3f}m")
        
        steps_per_circle = 50
        sleep_time = duration_seconds / steps_per_circle
        
        try:
            circle_count = 0
            while True:
                for step in range(steps_per_circle):
                    # Calculate position on circle
                    angle = (step / steps_per_circle) * 2 * math.pi
                    x = center_x + radius * math.cos(angle)
                    y = center_y + radius * math.sin(angle)
                    z = center_z
                    
                    # Use default orientation (pointing down)
                    qx, qy, qz, qw = 0.0, 0.0, 0.0, 1.0
                    
                    # Move to position (without smooth interpolation for faster motion)
                    success = self.move_to_pose(x, y, z, qx, qy, qz, qw, smooth=False)
                    
                    if not success:
                        logger.warning("Failed to move in circle, stopping")
                        return
                    
                    time.sleep(sleep_time)
                
                circle_count += 1
                if circle_count % 10 == 0:
                    logger.info(f"🔄 Completed {circle_count} circles")
                    
        except KeyboardInterrupt:
            logger.info("🛑 Circular motion stopped by user")
        except Exception as e:
            logger.error(f"❌ Error during circular motion: {e}")
