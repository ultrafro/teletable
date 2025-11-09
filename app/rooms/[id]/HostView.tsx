import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useCamera } from "@/app/hooks/useCamera";
import { RoomData } from "./roomUI.model";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useAuth } from "@/app/lib/auth";
import Peer, { MediaConnection } from "peerjs";
import {
  BothHands,
  DataFrame,
  DefaultDirectValues,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "@/app/teletable.model";
import { useUpdateHandsFromClientData } from "./useUpdateHandsFromClient";
import { useRobotWebSocket } from "@/app/hooks/useRobotWebSocket";
import RobotVisualizer from "@/app/RobotVisualizer";
import { useHostActions } from "./useHostActions";
import { copyHands } from "./copyHands";
import { useUpdateFromClient } from "./useUpdateFromClient";
import { useInviteLink } from "./useInviteLink";
import { usePeer } from "@/app/hooks/usePeer";
import { useIsVideoCallConnected } from "./useIsVideoCallConnected";

export default function HostView({ roomData }: { roomData: RoomData }) {
  const { user, session } = useAuth();
  const camera = useCamera();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInitializingStream, setIsInitializingStream] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isTestControlEnabled, setIsTestControlEnabled] = useState(false);
  const [roomPassword, setRoomPassword] = useState(roomData.roomPW || "");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  // Initialize robot WebSocket connection
  const robotWS = useRobotWebSocket();

  const sendJointValuesToRobot = useCallback(
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

  const onGetLocalStream = useCallback(() => {
    return camera.stream;
  }, [camera.stream]);

  //a use effect that looks at the user request for control, and if it has the room password,
  //it auto approves the request
  useEffect(() => {
    if (
      roomData.info?.requestingClientIds &&
      Object.keys(roomData.info.requestingClientIds).length > 0
    ) {
      for (const clientId in roomData.info.requestingClientIds) {
        const requestPw = roomData.info.requestingClientIds[clientId].pw;
        const roomPw = roomData.roomPW;
        console.log("room data changed", requestPw, roomPw);
        if (
          roomData.info.requestingClientIds[clientId].pw === roomData.roomPW
        ) {
          handleApproveRequest(clientId);
        }
      }
    }
  }, [roomData]);

  const onData = useCallback(
    (data: any) => {
      if (isTestControlEnabled) {
        return;
      }

      try {
        const newData = JSON.parse(data) as Record<string, DataFrame>;
        for (const key in newData) {
          for (let i = 0; i < newData[key].joints.length; i++) {
            if (!currentState.current[key]) {
              currentState.current[key] = {
                joints: [...DefaultDirectValues],
                type: "SO101",
              };
            }
            currentState.current[key].joints[i] = newData[key].joints[i];
          }
        }
        for (const key in currentState.current) {
          sendJointValuesToRobot(key, currentState.current[key].joints);
        }
      } catch (error) {
        console.error("Error parsing data", error, data);
      }
    },
    [isTestControlEnabled, sendJointValuesToRobot]
  );

  const currentState = useRef<Record<string, DataFrame>>({
    left: {
      joints: [...DefaultDirectValues],
      type: "SO101",
    },
    right: {
      joints: [...DefaultDirectValues],
      type: "SO101",
    },
  });

  const peer = usePeer(onData, camera.fakeVideoStream);

  const videoCallConnected = useIsVideoCallConnected(peer);

  // Initialize camera devices when component mounts
  useEffect(() => {
    // Only initialize if devices haven't been loaded yet
    if (camera.devices.length === 0 && !camera.isLoading) {
      camera.initializeCamera().catch((err) => {
        console.error("Failed to initialize camera devices:", err);
      });
    }
  }, []);

  // Display camera stream in video element when available
  useEffect(() => {
    if (videoRef.current) {
      if (camera.stream) {
        videoRef.current.srcObject = camera.stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }

    //tell the peer to switch to the new stream
    if (peer.peer) {
      peer.switchStream(camera.stream || camera.fakeVideoStream);
    }
  }, [camera.stream, camera.fakeVideoStream, peer]);

  const {
    handleMakeRoomReady,
    handleEndStream,
    handleApproveRequest,
    handleDenyRequest,
    handleRevokeControl,
    handleUpdatePassword: handleUpdatePasswordAction,
  } = useHostActions(
    user,
    session,
    roomData,
    camera,
    peer,
    setIsInitializingStream,
    setIsEndingStream,
    setIsProcessingRequest
  );

  //if the room's hostPeerId does not match the peer's id, reset the room's ready state
  const lastHostPeerId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentHostPeerId = peer.peer?.id;

    if (currentHostPeerId !== lastHostPeerId.current) {
      lastHostPeerId.current = currentHostPeerId;
      if (!!roomData.hostPeerId && roomData.hostPeerId !== peer.peer?.id) {
        console.log("ending stream!");
        handleEndStream();
      }
    }
  }, [roomData.hostPeerId, peer.peer?.id, handleEndStream]);

  const isRoomReady = roomData.hostPeerId !== null;

  const { linkCopied, handleCopyInviteLink } = useInviteLink();

  const handleUpdatePassword = useCallback(async () => {
    if (!user || !roomData.roomId) return;

    setIsUpdatingPassword(true);
    handleUpdatePasswordAction(roomPassword.trim() || "").then(() => {
      setIsUpdatingPassword(false);
    });
  }, [user, roomData.roomId, roomPassword]);

  // Update local password state when roomData changes
  useEffect(() => {
    setRoomPassword(roomData.roomPW || "");
  }, [roomData.roomPW]);

  return (
    <div className="h-full flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Left side - Robot Visualizer */}
      <div className="flex-1 p-3 sm:p-4 lg:p-6 min-h-0 min-w-0">
        <div className="h-full bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 lg:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              Robot Control
            </h2>
          </div>
          <div className="flex-1 relative min-h-0">
            <RobotVisualizer
              currentState={currentState}
              remotelyControlled={!isTestControlEnabled}
              onJointValuesUpdate={sendJointValuesToRobot}
            />
          </div>
        </div>
      </div>

      {/* Right side - Control panel column */}
      <div className="w-full lg:w-80 xl:w-96 p-3 sm:p-4 lg:p-6 border-t lg:border-t-0 lg:border-l border-foreground/10 min-h-0 overflow-y-auto">
        <div className="h-full flex flex-col space-y-4 sm:space-y-6 overflow-y-auto">
          {/* Invite Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Invite Others
              </h3>
            </div>
            <p className="text-sm text-foreground/70 mb-3">
              Share this link with others to let them control the robot
            </p>
            <button
              onClick={handleCopyInviteLink}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {linkCopied ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy Invite Link
                </>
              )}
            </button>
          </div>

          {/* Room Password Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Room Password
              </h3>
            </div>
            <p className="text-sm text-foreground/70 mb-3">
              Set a password that clients must provide when requesting control
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="Enter room password (optional)"
                className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-md text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>

          {/* Camera Feed Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Host Camera Feed
              </h3>
              <div className="flex items-center space-x-2">
                {!isRoomReady ? (
                  <button
                    onClick={handleMakeRoomReady}
                    disabled={isInitializingStream}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInitializingStream ? "Initializing..." : "Start"}
                  </button>
                ) : (
                  <button
                    onClick={handleEndStream}
                    disabled={isEndingStream}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEndingStream ? "Ending..." : "End"}
                  </button>
                )}
              </div>
            </div>

            {/* Camera Device Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                Camera Device:
              </label>
              <select
                value={camera.selectedDeviceId || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    camera.selectDevice(e.target.value);
                  }
                }}
                disabled={camera.isLoading}
                className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-md text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {camera.isLoading
                    ? "Detecting cameras..."
                    : camera.devices.length === 0
                    ? "No cameras available"
                    : "Choose a camera..."}
                </option>
                {camera.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
              {camera.isLoading && camera.devices.length === 0 && (
                <p className="text-xs text-foreground/50 mt-1">
                  Requesting camera access to detect available devices...
                </p>
              )}
            </div>

            <div className="rounded-lg overflow-hidden border border-foreground/10 shadow-lg bg-background">
              {camera.stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-background">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-foreground/10 rounded-full flex items-center justify-center mb-2 mx-auto">
                      <svg
                        className="w-6 h-6 text-foreground/50"
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
                    <p className="text-foreground/50 text-xs px-4">
                      {isRoomReady
                        ? "Camera preview will appear here"
                        : 'Click "Start" to begin'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {camera.error && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs">
                <strong>Camera Error:</strong> {camera.error}
              </div>
            )}
          </div>

          {/* Connection Status Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
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
                      peer.isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {peer.isConnected ? "Connected" : "Disconnected"}
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
                      videoCallConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {videoCallConnected ? "Active" : "Inactive"}
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
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
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

          {/* Robot Control Preview Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Test Control
              </h3>
              <button
                onClick={() => setIsTestControlEnabled(!isTestControlEnabled)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isTestControlEnabled
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                {isTestControlEnabled ? "Disable" : "Enable"}
              </button>
            </div>
            {isTestControlEnabled && (
              <div className="p-2 bg-orange-100 border border-orange-300 rounded text-orange-700 text-xs">
                <strong>Test Control Active:</strong> Client hand updates are
                ignored. Use the 3D controls to move the robot hands directly.
              </div>
            )}
          </div>

          {/* Client Approval/Disapproval Menu */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
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
        </div>
      </div>
    </div>
  );
}
