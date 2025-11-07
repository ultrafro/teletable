"use client";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import RobotVisualizer from "../RobotVisualizer";
import {
  BothHands,
  DataFrame,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "../teletable.model";
import { useRobotWebSocket } from "../hooks/useRobotWebSocket";
import ControlPageControlPanel from "./ControlPageControlPanel";
import { useCamera } from "../hooks/useCamera";

export default function ControlTest() {
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [directMode, setDirectMode] = useState(false);
  const [directValues, setDirectValues] = useState([0, 0, 0, 0, 0, 0]);

  const currentState = useRef<Record<string, DataFrame>>({
    left: {
      joints: directValues,
      type: "SO101",
    },
    right: {
      joints: directValues,
      type: "SO101",
    },
  });

  useEffect(() => {
    if (!directMode) {
      return;
    }

    for (let i = 0; i < directValues.length; i++) {
      currentState.current.left.joints[i] = directValues[i];
      currentState.current.right.joints[i] = directValues[i];
    }
  }, [directValues, directMode]);

  // Initialize and start camera on mount
  useEffect(() => {
    const initCamera = async () => {
      const deviceId = await camera.initializeCamera();
      if (deviceId) {
        await camera.startCamera(deviceId);
      }
    };
    initCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect camera stream to video element
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // Initialize robot WebSocket connection
  const robotWS = useRobotWebSocket();

  console.log("robotWS.isConnected", robotWS.isConnected);

  const handleJointValuesUpdate = useCallback(
    (robotId: string, jointValues: number[]) => {
      //console.log("jointValues", jointValues);
      //console.log("robotWS.isConnected", robotWS.isConnected);
      if (!robotWS.isConnected) {
        return;
      }
      //console.log("Joint values for", robotId, ":", jointValues);
      robotWS.sendHandData(robotId, [...jointValues]);
    },
    [robotWS.isConnected, robotWS.sendHandData]
  );

  // Send direct values to robots when in direct mode
  useEffect(() => {
    if (directMode && robotWS.isConnected) {
      robotWS.sendHandData("left", [...directValues]);
      robotWS.sendHandData("right", [...directValues]);
    }
  }, [directMode, directValues, robotWS.isConnected, robotWS.sendHandData]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left side - Robot Visualizer */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full bg-foreground/5 rounded-lg border border-foreground/10 p-6 flex flex-col">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Robot Control Test
          </h2>
          <div className="flex-1 relative">
            <RobotVisualizer
              currentState={currentState}
              remotelyControlled={directMode}
              onJointValuesUpdate={handleJointValuesUpdate}
            />
          </div>
        </div>
      </div>
      <div className="w-80 p-6 border-l border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto">
          {/* Camera selection */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-foreground mb-2">
              Camera
            </label>
            <select
              value={camera.selectedDeviceId || ""}
              onChange={(e) => {
                if (e.target.value) {
                  camera.selectDevice(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              disabled={camera.isLoading || camera.devices.length === 0}
            >
              {camera.devices.length === 0 ? (
                <option value="">No cameras available</option>
              ) : (
                <>
                  <option value="">Select a camera</option>
                  {camera.devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Video stream */}
          <div className="rounded-lg overflow-hidden border border-foreground/10 shadow-lg flex-shrink-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
            />
          </div>
          <ControlPageControlPanel
            robotWS={robotWS}
            directMode={directMode}
            setDirectMode={setDirectMode}
            directValues={directValues}
            setDirectValues={setDirectValues}
          />
        </div>
      </div>
    </div>
  );
}
