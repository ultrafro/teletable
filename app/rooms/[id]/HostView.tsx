import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useCamera } from "@/app/hooks/useCamera";
import { RoomData } from "./roomUI.model";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useAuth } from "@/app/lib/auth";
import { MediaConnection } from "peerjs";
import {
  BothHands,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "@/app/teletable.model";
import { useUpdateHandsFromClientData } from "./useUpdateHandsFromClient";
import { useRobotWebSocket } from "@/app/hooks/useRobotWebSocket";
import RobotVisualizer from "@/app/RobotVisualizer";
import { useHostActions } from "./useHostActions";
import { copyHands } from "./copyHands";

export default function HostView({
  roomData,
  peerJS,
}: {
  roomData: RoomData;
  peerJS: UsePeerJSResult;
}) {
  const { user } = useAuth();
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInitializingStream, setIsInitializingStream] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isTestControlEnabled, setIsTestControlEnabled] = useState(false);
  const [currentHands, setCurrentHands] = useState<BothHands>(() => ({
    left: JSON.parse(JSON.stringify(DefaultLeftHandDetection)),
    right: JSON.parse(JSON.stringify(DefaultRightHandDetection)),
  }));

  // Initialize robot WebSocket connection
  const robotWS = useRobotWebSocket();

  const handleJointValuesUpdate = useCallback(
    (robotId: string, jointValues: number[]) => {
      //console.log("robotWS.isConnected", robotWS.isConnected);
      if (!robotWS.isConnected) {
        return;
      }
      //console.log("Joint values for", robotId, ":", jointValues);
      robotWS.sendHandData(robotId, [...jointValues, 20]);
    },
    [robotWS.isConnected, robotWS.sendHandData]
  );

  // // Callback to handle hand updates from clients
  // const handleHandsUpdate = useCallback(
  //   (hands: BothHands) => {
  //     // Ignore client updates when test control is enabled
  //     if (isTestControlEnabled) {
  //       return;
  //     }

  //     // Update current hands state with client data
  //     //setCurrentHands(hands);
  //     copyHands(hands, currentHands);

  //     // Send hand data to robot server if connected
  //     if (robotWS.isConnected) {
  //       robotWS.sendHandData(hands);
  //     }
  //   },
  //   [robotWS, isTestControlEnabled]
  // );

  // useUpdateHandsFromClientData(currentHands, peerJS, handleHandsUpdate);

  // // Callback to handle direct control updates from the robot visualizer
  // const handleDirectControlUpdate = useCallback(
  //   (hands: BothHands) => {
  //     if (isTestControlEnabled) {
  //       copyHands(hands, currentHands);

  //       // Send hand data to robot server if connected
  //       if (robotWS.isConnected) {
  //         robotWS.sendHandData(hands);
  //       }
  //     }
  //   },
  //   [isTestControlEnabled, robotWS]
  // );

  // Display camera stream in video element when available
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // Handle incoming video calls from clients
  useEffect(() => {
    if (peerJS.mediaConnections.length > 0) {
      // Find calls that haven't been answered yet
      const unansweredCalls = peerJS.mediaConnections.filter(
        (call) => !call.open && call.peer !== peerJS.peerId
      );

      unansweredCalls.forEach((incomingCall) => {
        console.log("Answering incoming call from client:", incomingCall.peer);
        // Answer the call with camera stream if available, otherwise with empty stream
        // The host should always answer calls to establish the connection
        peerJS.answerCall(incomingCall, camera.stream || undefined);

        // If we don't have a camera stream yet, log a warning
        if (!camera.stream) {
          console.warn(
            "Answered call without camera stream - client may not see video until stream is ready"
          );
        }
      });
    }
  }, [peerJS.mediaConnections, camera.stream, peerJS]);

  const {
    handleMakeRoomReady,
    handleEndStream,
    handleApproveRequest,
    handleDenyRequest,
    handleRevokeControl,
  } = useHostActions(
    user,
    roomData,
    camera,
    peerJS,
    setIsInitializingStream,
    setIsEndingStream,
    setIsProcessingRequest
  );

  const isRoomReady = roomData.hostPeerId !== null;

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Left side - Big screen for camera feed */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full bg-foreground/5 rounded-lg border border-foreground/10 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Host Camera Feed
            </h2>
            <div className="flex items-center space-x-4">
              {!isRoomReady ? (
                <button
                  onClick={handleMakeRoomReady}
                  disabled={isInitializingStream}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInitializingStream ? "Initializing..." : "Make Room Ready"}
                </button>
              ) : (
                <button
                  onClick={handleEndStream}
                  disabled={isEndingStream}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEndingStream ? "Ending..." : "End Stream"}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 bg-background rounded-lg border border-foreground/10 overflow-hidden">
            {camera.stream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <svg
                      className="w-8 h-8 text-foreground/50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-foreground/70 text-lg">
                    {isRoomReady
                      ? "Camera preview will appear here"
                      : 'Click "Make Room Ready" to start camera'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {camera.error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              <strong>Camera Error:</strong> {camera.error}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Control panel column */}
      <div className="w-80 p-6 border-l border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto">
          {/* Connection Status Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Connection Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Room Status</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isRoomReady ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {isRoomReady ? "Ready for Control" : "Not Ready"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">PeerJS</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      peerJS.isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {peerJS.isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Camera</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      camera.stream ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {camera.stream ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Video Calls</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      peerJS.mediaConnections.length > 0
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {peerJS.mediaConnections.length} active
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Robot Server</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      robotWS.isConnected
                        ? "bg-green-500"
                        : robotWS.isConnecting
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {robotWS.isConnected
                      ? "Connected"
                      : robotWS.isConnecting
                      ? "Connecting..."
                      : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Robot Server Control Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Robot Server Control
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                {!robotWS.isConnected ? (
                  <button
                    onClick={robotWS.connect}
                    disabled={robotWS.isConnecting}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {robotWS.isConnecting ? "Connecting..." : "Connect"}
                  </button>
                ) : (
                  <button
                    onClick={robotWS.disconnect}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={robotWS.reconnect}
                  disabled={robotWS.isConnecting}
                  className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reconnect
                </button>
              </div>

              {robotWS.lastError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                  <strong>Connection Error:</strong> {robotWS.lastError}
                </div>
              )}

              <div className="text-xs text-foreground/60">
                <p>
                  <strong>Default:</strong> ws://localhost:9000
                </p>
                <p>
                  Make sure your Python robot server is running and listening on
                  this port.
                </p>
              </div>
            </div>
          </div>

          {/* Client Approval/Disapproval Menu */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Client Management
            </h3>
            <div className="space-y-3">
              {roomData.currentControllingClientId ? (
                <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      Client {roomData.currentControllingClientId} is
                      controlling
                    </span>
                    <button
                      onClick={() =>
                        handleRevokeControl(
                          roomData.currentControllingClientId!
                        )
                      }
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isProcessingRequest}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-foreground/70 text-sm">
                  No clients currently controlling
                </p>
              )}

              {roomData.info?.requestingClientIds &&
                Object.keys(roomData.info.requestingClientIds).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Pending Requests:
                    </p>
                    {Object.keys(roomData.info.requestingClientIds).map(
                      (clientId) => (
                        <div
                          key={clientId}
                          className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-700 text-sm"
                        >
                          <div className="flex flex-col space-y-2">
                            <span>Client {clientId} requesting control</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveRequest(clientId)}
                                className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isProcessingRequest}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDenyRequest(clientId)}
                                className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isProcessingRequest}
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

              {(!roomData.info?.requestingClientIds ||
                Object.keys(roomData.info.requestingClientIds).length === 0) &&
                !roomData.currentControllingClientId && (
                  <p className="text-foreground/50 text-sm">
                    No pending control requests
                  </p>
                )}
            </div>
          </div>

          {/* Robot Control Preview Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Robot Control Preview
              </h3>
              <button
                onClick={() => setIsTestControlEnabled(!isTestControlEnabled)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isTestControlEnabled
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                {isTestControlEnabled ? "Disable Test Control" : "Test Control"}
              </button>
            </div>
            {/* {isTestControlEnabled && (
              <div className="mb-3 p-2 bg-orange-100 border border-orange-300 rounded text-orange-700 text-sm">
                <strong>Test Control Active:</strong> Client hand updates are
                ignored. Use the 3D controls to move the robot hands directly.
              </div>
            )} */}
          </div>
          <RobotVisualizer
            currentHands={currentHands}
            // showDirectControl={isTestControlEnabled}
            onJointValuesUpdate={handleJointValuesUpdate}
          />
        </div>
      </div>
    </div>
  );
}
