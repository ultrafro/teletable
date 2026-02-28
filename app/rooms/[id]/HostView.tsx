"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useMultiCamera, CameraStream } from "@/app/hooks/useMultiCamera";
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
  StereoLayout,
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
import { useAutoApproveRequestWithPassword, useMakeRoomReadyOnLoad, useResetRoomWhenHostDisconnects, useUpdateHostPeerIdWhenItChanges } from "./HostView.hooks";
import { useMonodepthStream } from "@/app/hooks/useMonodepthStream";

export default function HostView({ roomData }: { roomData: RoomData }) {
  const { user, session } = useAuth();
  const multiCamera = useMultiCamera();

  // Create video refs for camera previews
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const lastBroadcastTrackIdsRef = useRef<Map<string, string | null>>(new Map());
  const [isInitializingStream, setIsInitializingStream] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isTestControlEnabled, setIsTestControlEnabled] = useState(false);
  const [roomPassword, setRoomPassword] = useState(roomData.roomPW || "");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  // Track stereo layout per camera
  const [stereoLayouts, setStereoLayouts] = useState<Map<string, StereoLayout>>(new Map());
  // Track which camera is being previewed in fullscreen modal
  const [fullscreenPreviewDeviceId, setFullscreenPreviewDeviceId] = useState<string | null>(null);
  // Initialize robot WebSocket connection
  const robotWS = useRobotWebSocket();

  // Monodepth processing
  const monodepth = useMonodepthStream({
    depthSize: 256,
    depthScale: 0.25,
    colormap: "grayscale",
    targetFps: 60,
  });
  // Track which cameras are using monodepth processing
  const [monodepthCameraIds, setMonodepthCameraIds] = useState<Set<string>>(new Set());
  // Track processed streams for monodepth cameras
  const processedStreamsRef = useRef<Map<string, MediaStream>>(new Map());



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
          robotWS.sendJointValuesToRobot(key, currentState.current[key].joints);
        }
      } catch (error) {
        console.error("Error parsing data", error, data);
      }
    },
    [isTestControlEnabled, robotWS.sendJointValuesToRobot]
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

  const peer = usePeer(onData);

  const videoCallConnected = useIsVideoCallConnected(peer);

  // Initialize camera devices when component mounts
  useEffect(() => {
    // Only initialize if devices haven't been loaded yet
    if (multiCamera.devices.length === 0 && !multiCamera.isLoading) {
      multiCamera.initializeCameras().catch((err) => {
        console.error("Failed to initialize camera devices:", err);
      });
    }
  }, []);

  // Sync camera streams with peer when streams change
  useEffect(() => {
    if (!peer.peer) return;

    // Get current broadcast camera IDs from peer
    const currentBroadcastIds = new Set(peer.getBroadcastCameraIds());

    // Get enabled streams from multiCamera
    const enabledStreams = multiCamera.getEnabledStreams();
    const enabledStreamIds = new Set(enabledStreams.map(s => s.deviceId));
    console.log(
      "[HostCamSync] state",
      {
        enabledStreamCount: enabledStreams.length,
        broadcastCount: currentBroadcastIds.size,
        enabledStreamIds: Array.from(enabledStreamIds),
        broadcastIds: Array.from(currentBroadcastIds),
      }
    );

    // Add new streams that are enabled but not yet broadcasting
    for (const cameraStream of enabledStreams) {
      // Use processed stream if monodepth is active for this camera
      const streamToUse = processedStreamsRef.current.get(cameraStream.deviceId) || cameraStream.stream;
      const layout = stereoLayouts.get(cameraStream.deviceId) || "mono";
      const layoutMetadata = layout === "monodepth" ? monodepth.layoutMetadata || undefined : undefined;

      if (!currentBroadcastIds.has(cameraStream.deviceId)) {
        console.log("[HostCamSync] add", cameraStream.deviceId, cameraStream.label, "stereo:", layout);
        peer.addCameraStream(cameraStream.deviceId, streamToUse, cameraStream.label, layout, layoutMetadata);
        lastBroadcastTrackIdsRef.current.set(
          cameraStream.deviceId,
          streamToUse.getVideoTracks()[0]?.id || null
        );
      } else {
        // Only switch tracks when the underlying video track changes. Replacing every render
        // causes visible flicker on clients.
        const nextTrackId = streamToUse.getVideoTracks()[0]?.id || null;
        const lastTrackId = lastBroadcastTrackIdsRef.current.get(cameraStream.deviceId) || null;
        if (nextTrackId && nextTrackId !== lastTrackId) {
          console.log("[HostCamSync] switch", cameraStream.deviceId, cameraStream.label);
          peer.switchStream(cameraStream.deviceId, streamToUse);
          lastBroadcastTrackIdsRef.current.set(cameraStream.deviceId, nextTrackId);
        }
      }
    }

    // Remove streams that are no longer enabled
    for (const cameraId of currentBroadcastIds) {
      if (!enabledStreamIds.has(cameraId)) {
        console.log("[HostCamSync] remove", cameraId);
        peer.removeCameraStream(cameraId);
        lastBroadcastTrackIdsRef.current.delete(cameraId);
        // Also cleanup processed streams
        processedStreamsRef.current.delete(cameraId);
      }
    }
  }, [multiCamera.streams, multiCamera.enabledCameraIds, peer.peer, stereoLayouts]);

  // Handler to update stereo layout for a camera
  const handleStereoLayoutChange = useCallback(async (deviceId: string, layout: StereoLayout) => {
    setStereoLayouts(prev => {
      const next = new Map(prev);
      next.set(deviceId, layout);
      return next;
    });

    const cameraStream = multiCamera.streams.get(deviceId);
    if (!cameraStream) {
      return;
    }

    if (layout === "monodepth") {
      // Load model if not ready
      if (!monodepth.isModelReady && !monodepth.isModelLoading) {
        const loaded = await monodepth.loadModel();
        if (!loaded) {
          console.error("[HostView] Failed to load monodepth model");
          // Revert to mono layout
          setStereoLayouts(prev => {
            const next = new Map(prev);
            next.set(deviceId, "mono");
            return next;
          });
          return;
        }
      }

      // Wait for model to be ready
      if (monodepth.isModelLoading) {
        // Model is loading, wait for it
        const checkReady = () => {
          return new Promise<void>((resolve) => {
            const interval = setInterval(() => {
              if (monodepth.isModelReady) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
          });
        };
        await checkReady();
      }

      // Process the camera stream
      const processedStream = monodepth.startProcessing(cameraStream.stream);
      if (processedStream) {
        processedStreamsRef.current.set(deviceId, processedStream);
        setMonodepthCameraIds(prev => new Set([...prev, deviceId]));
        // Switch to processed stream with layout metadata
        peer.switchStream(deviceId, processedStream);
        peer.updateStereoLayout(deviceId, layout, monodepth.layoutMetadata || undefined);
      }
    } else {
      // If switching away from monodepth, stop processing and use raw stream
      if (monodepthCameraIds.has(deviceId)) {
        processedStreamsRef.current.delete(deviceId);
        setMonodepthCameraIds(prev => {
          const next = new Set(prev);
          next.delete(deviceId);
          return next;
        });
        // Switch back to raw stream
        peer.switchStream(deviceId, cameraStream.stream);
      }
      // Update the peer's stored layout (clients will get it on reconnect), no monodepth metadata
      peer.updateStereoLayout(deviceId, layout, undefined);
    }
  }, [peer, multiCamera.streams, monodepth, monodepthCameraIds]);

  // Update video preview elements when streams change
  useEffect(() => {
    multiCamera.streams.forEach((cameraStream, deviceId) => {
      const videoEl = videoRefs.current.get(deviceId);
      if (!videoEl) return;

      // Use processed stream if monodepth is active, otherwise use raw stream
      const isMonodepth = stereoLayouts.get(deviceId) === "monodepth";
      const streamToShow = isMonodepth
        ? (processedStreamsRef.current.get(deviceId) || cameraStream.stream)
        : cameraStream.stream;

      if (streamToShow && videoEl.srcObject !== streamToShow) {
        videoEl.srcObject = streamToShow;
        void videoEl.play().catch(() => {
          // Ignore autoplay rejections for muted inline previews.
        });
      }
    });
  }, [multiCamera.streams, stereoLayouts, monodepthCameraIds]);

  // Create an adapter for useHostActions that expects UseCameraResult
  const cameraAdapter = useMemo(() => ({
    stopCamera: () => multiCamera.stopAllCameras(),
  }), [multiCamera]);

  const {
    handleMakeRoomReady,
    handleEndStream,
    handleApproveRequest,
    handleDenyRequest,
    handleRevokeControl,
    handleUpdatePassword: handleUpdatePasswordAction,
    handleUpdateHostPeerId,
  } = useHostActions(
    user,
    session,
    roomData,
    cameraAdapter as any,
    peer,
    setIsInitializingStream,
    setIsEndingStream,
    setIsProcessingRequest
  );

  useAutoApproveRequestWithPassword(roomData, handleApproveRequest);
  //useResetRoomWhenHostDisconnects(roomData, peer, handleEndStream);
  useUpdateHostPeerIdWhenItChanges(roomData, peer, handleUpdateHostPeerId);
  useMakeRoomReadyOnLoad(roomData, handleMakeRoomReady);

  const isRoomReady = roomData.hostPeerId !== null;

  const { linkCopied, handleCopyInviteLink, handleOpenInviteLink } = useInviteLink(roomData.roomId);

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
              controlMode={
                !isTestControlEnabled ? "DirectJoints" : "WidgetGoal"
              }
              onJointValuesUpdate={robotWS.sendJointValuesToRobot}
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
            <div className="flex gap-2">
              <button
                onClick={handleCopyInviteLink}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleOpenInviteLink}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                title="Open in new tab"
              >
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open
              </button>
            </div>
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

          {/* Host Camera Feeds Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Host Camera Feeds
              </h3>
              {/* room ready indicator */}
              {isRoomReady ? (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm">Room Ready</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-sm">Room Not Ready</span>
                </div>
              )}
            </div>

            {/* Loading state */}
            {multiCamera.isLoading && multiCamera.devices.length === 0 && (
              <p className="text-xs text-foreground/50 mb-3">
                Requesting camera access to detect available devices...
              </p>
            )}

            {/* No cameras available */}
            {!multiCamera.isLoading && multiCamera.devices.length === 0 && (
              <div className="text-center py-4">
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
                <p className="text-foreground/50 text-xs">No cameras available</p>
              </div>
            )}

            {/* Camera List */}
            {multiCamera.devices.length > 0 && (
              <div className="space-y-3">
                {multiCamera.devices.map((device) => {
                  const isEnabled = multiCamera.enabledCameraIds.includes(device.deviceId);
                  const cameraStream = multiCamera.streams.get(device.deviceId);
                  const hasStream = !!cameraStream;

                  return (
                    <div
                      key={device.deviceId}
                      className="flex items-center gap-3 p-2 rounded-lg border border-foreground/10 bg-background"
                    >
                      {/* Checkbox */}
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={async (e) => {
                            const newEnabled = e.target.checked;
                            multiCamera.toggleCameraEnabled(device.deviceId, newEnabled);

                            if (newEnabled) {
                              // Start the camera. Broadcast sync is handled by the
                              // stream synchronization effect above.
                              const stream = await multiCamera.startCamera(device.deviceId);
                              if (!stream) {
                                // Prevent indefinite "Starting..." when camera cannot be started.
                                multiCamera.toggleCameraEnabled(device.deviceId, false);
                              }
                            } else {
                              // Stop the camera. Broadcast removal is handled by
                              // the stream synchronization effect above.
                              multiCamera.stopCamera(device.deviceId);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-background border-foreground/30 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </label>

                      {/* Video Preview */}
                      <div className={`${stereoLayouts.get(device.deviceId) === "monodepth" ? "w-[125px]" : "w-[100px]"} h-[75px] bg-foreground/5 rounded overflow-hidden flex-shrink-0 border border-foreground/10`}>
                        {hasStream ? (
                          <video
                            ref={(el) => {
                              if (!el) {
                                videoRefs.current.delete(device.deviceId);
                                return;
                              }

                              videoRefs.current.set(device.deviceId, el);
                              // Use processed stream if monodepth is active, otherwise use raw stream
                              const isMonodepth = stereoLayouts.get(device.deviceId) === "monodepth";
                              const streamToShow = isMonodepth
                                ? (processedStreamsRef.current.get(device.deviceId) || cameraStream?.stream)
                                : cameraStream?.stream;
                              if (streamToShow && el.srcObject !== streamToShow) {
                                el.srcObject = streamToShow;
                                void el.play().catch(() => {
                                  // Ignore autoplay rejections for muted inline previews.
                                });
                              }
                            }}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-foreground/30"
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
                        )}
                      </div>

                      {/* Camera Label and Stereo Layout */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {device.label}
                        </p>
                        <p className="text-xs text-foreground/50">
                          {isEnabled ? (hasStream ? "Broadcasting" : "Starting...") : "Not broadcasting"}
                          {stereoLayouts.get(device.deviceId) === "monodepth" && monodepth.isProcessing && (
                            <span className="ml-2 text-green-600">{monodepth.fps} FPS</span>
                          )}
                        </p>
                        {isEnabled && hasStream && (
                          <select
                            value={stereoLayouts.get(device.deviceId) || "mono"}
                            onChange={(e) => handleStereoLayoutChange(device.deviceId, e.target.value as StereoLayout)}
                            disabled={monodepth.isModelLoading}
                            className="mt-1 w-full px-2 py-1 bg-background border border-foreground/20 rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="mono">Mono</option>
                            <option value="stereo-left-right">Stereo (Side-by-Side)</option>
                            <option value="stereo-top-bottom">Stereo (Top-Bottom)</option>
                            <option value="monodepth">
                              {monodepth.isModelLoading
                                ? `Monodepth (Loading ${monodepth.modelLoadProgress}%)`
                                : "Monodepth (Color+Depth)"}
                            </option>
                          </select>
                        )}
                      </div>

                      {/* Fullscreen Preview Button */}
                      {hasStream && (
                        <button
                          onClick={() => setFullscreenPreviewDeviceId(device.deviceId)}
                          className="p-2 bg-foreground/10 hover:bg-foreground/20 rounded transition-colors flex-shrink-0"
                          title="Fullscreen preview"
                        >
                          <svg
                            className="w-4 h-4 text-foreground/70"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {multiCamera.error && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs">
                <strong>Camera Error:</strong> {multiCamera.error}
              </div>
            )}

            {monodepth.error && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs">
                <strong>Depth Model Error:</strong> {monodepth.error}
              </div>
            )}

            {monodepth.isModelLoading && (
              <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-700 text-xs">
                <strong>Loading Depth Model:</strong> {monodepth.modelLoadProgress}%
                <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${monodepth.modelLoadProgress}%` }}
                  />
                </div>
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
                    className={`w-2 h-2 rounded-full ${isRoomReady ? "bg-green-500" : "bg-yellow-500"
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
                    className={`w-2 h-2 rounded-full ${peer.isConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                  ></div>
                  <span className="text-sm">
                    {peer.isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Cameras</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${multiCamera.streams.size > 0 ? "bg-green-500" : "bg-gray-400"
                      }`}
                  ></div>
                  <span className="text-sm">
                    {multiCamera.streams.size > 0
                      ? `${multiCamera.streams.size} Active`
                      : "None Active"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Video Calls</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${videoCallConnected ? "bg-green-500" : "bg-gray-400"
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
                    className={`w-2 h-2 rounded-full ${robotWS.isConnected
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
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isTestControlEnabled
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

      {/* Fullscreen Video Preview Modal */}
      {fullscreenPreviewDeviceId && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreenPreviewDeviceId(null)}
        >
          <button
            onClick={() => setFullscreenPreviewDeviceId(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <video
            ref={(el) => {
              if (!el) return;
              const cameraStream = multiCamera.streams.get(fullscreenPreviewDeviceId);
              // Use processed stream if monodepth is active
              const isMonodepth = stereoLayouts.get(fullscreenPreviewDeviceId) === "monodepth";
              const streamToShow = isMonodepth
                ? (processedStreamsRef.current.get(fullscreenPreviewDeviceId) || cameraStream?.stream)
                : cameraStream?.stream;
              if (streamToShow && el.srcObject !== streamToShow) {
                el.srcObject = streamToShow;
                void el.play().catch(() => {});
              }
            }}
            autoPlay
            muted
            playsInline
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
