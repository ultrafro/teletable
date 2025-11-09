import router from "next/router";
import {
  ClientRoomInfo,
  ClientRoomInfoResponse,
  RoomData,
} from "./roomUI.model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useControlRequest } from "@/app/hooks/useControlRequest";
import { useVideoCall } from "@/app/hooks/useVideoCall";
import { useConnectionRefresh } from "@/app/hooks/useConnectionRefresh";
import {
  BothHands,
  DataFrame,
  DefaultDirectValues,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "@/app/teletable.model";
import { useProcessHandDetection } from "@/app/useProcessHandDetection";
import RobotVisualizer from "@/app/RobotVisualizer";
import HandViewer from "@/app/HandViewer";
import { useBroadcastHands } from "./useBroadcastHands";
import { useBroadcastState } from "./useBroadcastState";
import { usePeer } from "@/app/hooks/usePeer";
import { useVideoCallConnectionClientside } from "./useVideoCallConnectionClientside";
import { useDataConnectionClientside } from "./useDataConnectionClientside";

export default function ClientView({
  roomData,
  user,
}: {
  roomData: RoomData;
  user: User | null;
}) {
  const peer = usePeer();

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
  const remoteStream = useVideoCallConnectionClientside(
    roomData.hostPeerId || "",
    peer
  );
  //Handle video stream display
  useEffect(() => {
    console.log("remote stream changed to:", remoteStream);
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const dataConnection = useDataConnectionClientside(
    roomData.hostPeerId || "",
    peer
  );

  const onStateUpdate = useBroadcastState(dataConnection);

  const lastPrintTime = useRef(0);
  const handleJointValuesUpdate = useCallback(
    (robotId: string, jointValues: number[]) => {
      if (Date.now() - lastPrintTime.current > 1000) {
        lastPrintTime.current = Date.now();
        // console.log(
        //   "currentState in jointValuesUpdate",
        //   currentState.current?.right?.joints?.[5]
        // );
      }

      const transmission: Record<string, DataFrame> = JSON.parse(
        JSON.stringify(currentState.current)
      );
      transmission[robotId].joints = [...jointValues];
      onStateUpdate(transmission);
    },
    [onStateUpdate]
  );

  useEffect(() => {
    const int = setInterval(() => {
      if (typeof window !== "undefined") {
        // console.log(
        //   "currentState in useEffect",
        //   currentState.current?.right?.joints?.[5]
        // );
      }
    }, 1000);
    return () => clearInterval(int);
  }, [currentState]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const isInControl = user?.id === roomData.currentControllingClientId;
  const [roomPassword, setRoomPassword] = useState("");

  // Custom hooks
  const { handleRequestControl, isRequestingControl, requestStatus } =
    useControlRequest(user, roomData.roomId, roomPassword);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).peer = peer;
    }
  }, [peer]);

  // console.log("peer", peer);
  // console.log("roomData", roomData);

  return (
    <div className="h-full flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Left side - Robot Control */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full bg-foreground/5 rounded-lg border border-foreground/10 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Robot Control
            </h2>
            {isInControl && (
              <span className="text-sm text-green-600 font-medium px-3 py-1 bg-green-100 rounded-full">
                You have control
              </span>
            )}
          </div>

          <div className="flex-1 bg-background rounded-lg border border-foreground/10 overflow-hidden">
            <RobotVisualizer
              currentState={currentState}
              remotelyControlled={false}
              onJointValuesUpdate={handleJointValuesUpdate}
            />
          </div>
        </div>
      </div>

      {/* Right side - Camera View and Control panel */}
      <div className="w-full lg:w-[400px] lg:flex-shrink-0 p-6 lg:border-l border-t lg:border-t-0 border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto relative">
          {/* Room Password Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Room Password
            </h3>
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="Enter room password"
              className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Remote View Section */}
          <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Remote View
              </h3>
            </div>

            <div className="bg-background rounded-lg border border-foreground/10 overflow-hidden aspect-video">
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
                    <div className="w-12 h-12 bg-foreground/10 rounded-full flex items-center justify-center mb-3 mx-auto">
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
                    <p className="text-foreground/70 text-sm">
                      {isInControl
                        ? "Connecting to host stream..."
                        : "Waiting for remote feed..."}
                    </p>
                    <p className="text-foreground/50 text-xs mt-1">
                      {!isInControl && "Request control to start viewing"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isInControl && (
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-foreground/70">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        remoteStream ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    ></div>
                    <span>
                      {remoteStream
                        ? "Video stream active"
                        : "Establishing connection..."}
                    </span>
                  </div>
                </div>
                <button
                  disabled={true}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                >
                  "Refresh Connection"
                </button>
              </div>
            )}
          </div>

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
                      peer.isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {peer.isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Video Call</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      remoteStream ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-sm">
                    {remoteStream ? "Active" : "Inactive"}
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
        </div>
      </div>
    </div>
  );
}
