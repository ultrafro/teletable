import router from "next/router";
import {
  ClientRoomInfo,
  ClientRoomInfoResponse,
  RoomData,
} from "./roomUI.model";
import { useEffect, useMemo, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useControlRequest } from "@/app/hooks/useControlRequest";
import { useVideoCall } from "@/app/hooks/useVideoCall";
import { useConnectionRefresh } from "@/app/hooks/useConnectionRefresh";
import {
  BothHands,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "@/app/teletable.model";
import { useProcessHandDetection } from "@/app/useProcessHandDetection";
import RobotVisualizer from "@/app/RobotVisualizer";
import HandViewer from "@/app/HandViewer";
import { useBroadcastHands } from "./useBroadcastHands";

export default function ClientView({
  roomData,
  peerJS,
  user,
}: {
  roomData: RoomData;
  peerJS: UsePeerJSResult;
  user: User | null;
}) {
  const currentHands = useMemo<BothHands>(() => {
    return {
      left: JSON.parse(JSON.stringify(DefaultLeftHandDetection)),
      right: JSON.parse(JSON.stringify(DefaultRightHandDetection)),
    };
  }, []);

  const onRawDetection = useProcessHandDetection(currentHands);
  const onRawDetectionWithBroadcast = useBroadcastHands(
    onRawDetection,
    peerJS,
    currentHands
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const isInControl = user?.id === roomData.currentControllingClientId;

  // Custom hooks
  const { handleRequestControl, isRequestingControl, requestStatus } =
    useControlRequest(user, roomData.roomId);
  const {
    initiateVideoCall,
    activeCall,
    remoteStream,
    setActiveCall,
    setRemoteStream,
  } = useVideoCall(roomData.hostPeerId, peerJS);
  const { handleRefreshConnection, isRefreshingConnection } =
    useConnectionRefresh(
      isInControl,
      activeCall,
      setActiveCall,
      setRemoteStream,
      initiateVideoCall
    );

  // Initialize PeerJS when component mounts
  useEffect(() => {
    if (!peerJS.peer && !peerJS.isConnected) {
      peerJS.initializePeer().catch(console.error);
    }
  }, [peerJS]);

  // Handle video stream display
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle video calling when client gains control or when PeerJS becomes ready
  useEffect(() => {
    if (
      isInControl &&
      roomData.hostPeerId &&
      peerJS.peer &&
      peerJS.isConnected &&
      !activeCall
    ) {
      console.log(
        "Client has control and PeerJS is ready, initiating video call..."
      );
      initiateVideoCall();
    }
  }, [
    isInControl,
    roomData.hostPeerId,
    peerJS.peer,
    peerJS.isConnected,
    activeCall,
    initiateVideoCall,
  ]);

  // Clean up video call when client loses control
  useEffect(() => {
    if (!isInControl && activeCall) {
      console.log("Client lost control, closing video call");
      activeCall.close();
      setActiveCall(null);
      setRemoteStream(null);
    }
  }, [isInControl, activeCall]);

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Left side - Big screen for remote feed */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full bg-foreground/5 rounded-lg border border-foreground/10 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Remote View
            </h2>
            {isInControl && (
              <span className="text-sm text-green-600 font-medium px-3 py-1 bg-green-100 rounded-full">
                You have control
              </span>
            )}
          </div>

          <div className="flex-1 bg-background rounded-lg border border-foreground/10 overflow-hidden">
            {remoteStream && isInControl ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={true}
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
                    {isInControl
                      ? "Connecting to host stream..."
                      : "Waiting for remote feed..."}
                  </p>
                  <p className="text-foreground/50 text-sm mt-2">
                    {!isInControl && "Request control to start viewing"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {isInControl && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-foreground/70">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activeCall ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  ></div>
                  <span>
                    {activeCall
                      ? "Video stream active"
                      : "Establishing connection..."}
                  </span>
                </div>
              </div>
              <button
                onClick={handleRefreshConnection}
                disabled={isRefreshingConnection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {isRefreshingConnection
                  ? "Refreshing..."
                  : "Refresh Connection"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Control panel column */}
      <div className="w-[400px] p-6 border-l border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto relative">
          {/* Connection Status Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Connection Status
            </h3>
            <div className="space-y-3">
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
                <span className="text-sm text-foreground/70">Video Call</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activeCall ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {activeCall ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">
                  Control Status
                </span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isInControl ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {isInControl ? "In Control" : "No Control"}
                  </span>
                </div>
              </div>

              {!isInControl && (
                <div className="pt-3 border-t border-foreground/10">
                  <button
                    onClick={handleRequestControl}
                    disabled={isRequestingControl || !user?.id}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    {isRequestingControl ? "Requesting..." : "Request Control"}
                  </button>
                  {requestStatus && (
                    <p
                      className={`text-xs mt-2 ${
                        requestStatus.includes("successfully")
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {requestStatus}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Hand Tracking Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex-1 w-full h-full relative">
            <div className="z-10 pointer-events-none w-[300px] h-[300px]">
              <div className="pointer-events-auto w-full h-full">
                <HandViewer onHandsDetected={onRawDetectionWithBroadcast} />
              </div>
            </div>
          </div>

          {/* Robot Control Preview Section */}
          <div className="bg-foreground/5 h-[400px] rounded-lg border border-foreground/10 p-4 flex-1">
            <RobotVisualizer currentHands={currentHands} />
          </div>
        </div>
      </div>
    </div>
  );
}
