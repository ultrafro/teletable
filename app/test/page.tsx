"use client";

import { useState, useCallback, useEffect } from "react";
import { useRobotWebSocket } from "../hooks/useRobotWebSocket";

const JOINT_NAMES = [
  "Shoulder Pan",
  "Shoulder Lift",
  "Elbow Flex",
  "Wrist Flex (Pitch)",
  "Wrist Roll",
  "Gripper",
];

const DEFAULT_JOINTS = [0, 0, 0, 0, 0, 50];

interface RobotControlPanelProps {
  robotId: string;
  label: string;
  isConnected: boolean;
  onSendJoints: (robotId: string, joints: number[]) => void;
}

function RobotControlPanel({
  robotId,
  label,
  isConnected,
  onSendJoints,
}: RobotControlPanelProps) {
  const [joints, setJoints] = useState<number[]>([...DEFAULT_JOINTS]);
  const [directInputs, setDirectInputs] = useState<string[]>(
    DEFAULT_JOINTS.map(String)
  );
  const [autoSend, setAutoSend] = useState(false);

  const updateJoint = (index: number, value: number) => {
    const newJoints = [...joints];
    newJoints[index] = value;
    setJoints(newJoints);
    setDirectInputs(newJoints.map(String));

    if (autoSend && isConnected) {
      onSendJoints(robotId, newJoints);
    }
  };

  const updateDirectInput = (index: number, value: string) => {
    const newInputs = [...directInputs];
    newInputs[index] = value;
    setDirectInputs(newInputs);

    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      const newJoints = [...joints];
      newJoints[index] = parsed;
      setJoints(newJoints);

      if (autoSend && isConnected) {
        onSendJoints(robotId, newJoints);
      }
    }
  };

  const handleSend = () => {
    if (isConnected) {
      onSendJoints(robotId, joints);
    }
  };

  const handleReset = () => {
    setJoints([...DEFAULT_JOINTS]);
    setDirectInputs(DEFAULT_JOINTS.map(String));
  };

  return (
    <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{label}</h2>
        <span className="text-sm text-foreground/70">ID: {robotId}</span>
      </div>

      <div className="space-y-4">
        {JOINT_NAMES.map((name, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">
                {name}
              </label>
              <span className="text-sm text-foreground/60">
                {joints[index].toFixed(2)}
              </span>
            </div>

            <div className="flex gap-3 items-center">
              {/* Slider */}
              <input
                type="range"
                min={index === 5 ? 0 : -180}
                max={index === 5 ? 100 : 180}
                step="0.1"
                value={joints[index]}
                onChange={(e) => updateJoint(index, parseFloat(e.target.value))}
                className="flex-1 h-2 bg-foreground/20 rounded-lg appearance-none cursor-pointer"
              />

              {/* Direct input (no bounds) */}
              <input
                type="text"
                value={directInputs[index]}
                onChange={(e) => updateDirectInput(index, e.target.value)}
                className="w-24 px-2 py-1 text-sm bg-background border border-foreground/20 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-foreground/10 space-y-3">
        {/* Auto-send toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            className="w-4 h-4 rounded border-foreground/30"
          />
          <span className="text-sm text-foreground/70">
            Auto-send on change
          </span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={!isConnected}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Joints
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestPage() {
  const [wsUrl, setWsUrl] = useState("ws://localhost:9000");
  const robotWS = useRobotWebSocket(wsUrl);

  const handleSendJoints = useCallback(
    (robotId: string, joints: number[]) => {
      robotWS.sendJointValuesToRobot(robotId, joints);
    },
    [robotWS]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-foreground/10">
        <h1 className="text-2xl font-bold">Robot Joint Test</h1>
        <p className="text-sm text-foreground/70 mt-1">
          Direct joint control for testing
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Connection Section */}
        <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10 mb-8">
          <h2 className="text-xl font-semibold mb-4">Connection</h2>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                WebSocket URL
              </label>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ws://localhost:9000"
              />
            </div>

            <div className="flex gap-2">
              {!robotWS.isConnected ? (
                <button
                  onClick={robotWS.connect}
                  disabled={robotWS.isConnecting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {robotWS.isConnecting ? "Connecting..." : "Connect"}
                </button>
              ) : (
                <button
                  onClick={robotWS.disconnect}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Connection Status */}
          <div className="mt-4 flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                robotWS.isConnected
                  ? "bg-green-500"
                  : robotWS.isConnecting
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-sm text-foreground/70">
              {robotWS.isConnected
                ? "Connected"
                : robotWS.isConnecting
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>

          {robotWS.lastError && (
            <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm">
              {robotWS.lastError}
            </div>
          )}
        </div>

        {/* Robot Control Panels */}
        <div className="grid md:grid-cols-2 gap-6">
          <RobotControlPanel
            robotId="left"
            label="Left Robot"
            isConnected={robotWS.isConnected}
            onSendJoints={handleSendJoints}
          />
          <RobotControlPanel
            robotId="right"
            label="Right Robot"
            isConnected={robotWS.isConnected}
            onSendJoints={handleSendJoints}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-foreground/5 rounded-xl p-6 border border-foreground/10">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleSendJoints("left", [0, 0, 0, 0, 0, 50])}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Left: Home Position
            </button>
            <button
              onClick={() => handleSendJoints("right", [0, 0, 0, 0, 0, 50])}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Right: Home Position
            </button>
            <button
              onClick={() => {
                handleSendJoints("left", [0, 0, 0, 0, 0, 0]);
              }}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Left: Open Gripper
            </button>
            <button
              onClick={() => {
                handleSendJoints("left", [0, 0, 0, 0, 0, 100]);
              }}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Left: Close Gripper
            </button>
            <button
              onClick={() => {
                handleSendJoints("right", [0, 0, 0, 0, 0, 0]);
              }}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Right: Open Gripper
            </button>
            <button
              onClick={() => {
                handleSendJoints("right", [0, 0, 0, 0, 0, 100]);
              }}
              disabled={!robotWS.isConnected}
              className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors disabled:opacity-50"
            >
              Right: Close Gripper
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
