"use client";
import { useCallback, useState, useEffect, useMemo } from "react";
import RobotVisualizer from "../RobotVisualizer";
import {
  BothHands,
  DataFrame,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "../teletable.model";
import { useRobotWebSocket } from "../hooks/useRobotWebSocket";
import ControlPageControlPanel from "./ControlPageControlPanel";

export default function ControlTest() {
  const currentState = useMemo<Record<string, DataFrame>>(
    () => ({
      left: {
        joints: [0, 0, 0, 0, 0, 0],
        type: "SO101",
      },
      right: {
        joints: [0, 0, 0, 0, 0, 0],
        type: "SO101",
      },
    }),
    []
  );

  // Initialize robot WebSocket connection
  const robotWS = useRobotWebSocket();

  console.log("robotWS.isConnected", robotWS.isConnected);

  const handleJointValuesUpdate = useCallback(
    (robotId: string, jointValues: number[]) => {
      //console.log("robotWS.isConnected", robotWS.isConnected);
      if (!robotWS.isConnected) {
        return;
      }
      //console.log("Joint values for", robotId, ":", jointValues);
      robotWS.sendHandData(robotId, [...jointValues]);
    },
    [robotWS.isConnected, robotWS.sendHandData]
  );

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
              remotelyControlled={false}
              onJointValuesUpdate={handleJointValuesUpdate}
            />
          </div>
        </div>
      </div>
      <div className="w-80 p-6 border-l border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto">
          <ControlPageControlPanel robotWS={robotWS} />
        </div>
      </div>
    </div>
  );
}
