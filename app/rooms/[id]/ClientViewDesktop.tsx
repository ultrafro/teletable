import RobotVisualizer from "@/app/RobotVisualizer";
import { DataFrame } from "@/app/teletable.model";
import { RefObject, useEffect, useRef } from "react";
import { RemoteCameraStream } from "./useMultiVideoCallConnectionClientside";

export function ClientViewDesktop({
  isInControl,
  currentState,
  handleJointValuesUpdate,
  roomPassword,
  setRoomPassword,
  remoteStreams,
  handleRequestControl,
  isRequestingControl,
  peerIsConnected,
  requestStatus,
  onEnterXR,
}: {
  isInControl: boolean;
  currentState: RefObject<Record<string, DataFrame>>;
  handleJointValuesUpdate: (robotId: string, jointValues: number[]) => void;
  roomPassword: string;
  setRoomPassword: (roomPassword: string) => void;
  remoteStreams: RemoteCameraStream[];
  handleRequestControl: () => void;
  isRequestingControl: boolean;
  requestStatus: string | null;
  peerIsConnected: boolean;
  onEnterXR: () => void;
}) {
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
              controlMode="WidgetGoal"
              onJointValuesUpdate={handleJointValuesUpdate}
            />
          </div>
        </div>
      </div>

      {/* Right side - Camera View and Control panel */}
      <div className="w-full lg:w-[400px] lg:flex-shrink-0 p-6 lg:border-l border-t lg:border-t-0 border-foreground/10 min-h-0">
        <div className="h-full flex flex-col space-y-6 overflow-y-auto relative">
          {/* Enter XR Button */}
          <div className="flex justify-end">
            <button
              onClick={onEnterXR}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Enter XR
            </button>
          </div>

          {/* Room Password Section */}
          <RoomPasswordSection
            roomPassword={roomPassword}
            setRoomPassword={setRoomPassword}
          />

          {/* Remote View Section */}
          <RemoteViewSection
            remoteStreams={remoteStreams}
            isInControl={isInControl}
          />

          {/* Connection Status Section */}
          <ConnectionStatusSection
            peerIsConnected={peerIsConnected}
            remoteStreams={remoteStreams}
            isInControl={isInControl}
          />

          {/* Control Request Section */}
          <ControlRequestSection
            handleRequestControl={handleRequestControl}
            isRequestingControl={isRequestingControl}
            requestStatus={requestStatus}
            isInControl={isInControl}
          />
        </div>
      </div>
    </div>
  );
}

export function RoomPasswordSection({
  roomPassword,
  setRoomPassword,
}: {
  roomPassword: string;
  setRoomPassword: (roomPassword: string) => void;
}) {
  return (
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
  );
}

function SingleCameraView({
  cameraStream,
}: {
  cameraStream: RemoteCameraStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("Camera stream changed for:", cameraStream.label, cameraStream.stream);
    if (videoRef.current && cameraStream.stream) {
      videoRef.current.srcObject = cameraStream.stream;
    }
  }, [cameraStream.stream, cameraStream.label]);

  return (
    <div className="bg-background rounded-lg border border-foreground/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-foreground/5 border-b border-foreground/10">
        <span className="text-sm font-medium text-foreground">{cameraStream.label}</span>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-foreground/70">Active</span>
        </div>
      </div>
      <div className="aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export function RemoteViewSection({
  remoteStreams,
  isInControl,
}: {
  remoteStreams: RemoteCameraStream[];
  isInControl: boolean;
}) {
  const hasStreams = remoteStreams.length > 0;

  return (
    <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Remote View</h3>
        {hasStreams && (
          <span className="text-xs text-foreground/70">
            {remoteStreams.length} camera{remoteStreams.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {hasStreams ? (
        <div className="flex flex-col space-y-4 max-h-[60vh] overflow-y-auto">
          {remoteStreams.map((cameraStream) => (
            <SingleCameraView
              key={cameraStream.cameraId}
              cameraStream={cameraStream}
            />
          ))}
        </div>
      ) : (
        <div className="bg-background rounded-lg border border-foreground/10 overflow-hidden aspect-video">
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
                  : "Waiting for host camera feeds..."}
              </p>
              <p className="text-foreground/50 text-xs mt-1">
                {!isInControl && "Request control to drive the robot"}
              </p>
            </div>
          </div>
        </div>
      )}

      {(
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-foreground/70">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${hasStreams ? "bg-green-500" : "bg-yellow-500"
                  }`}
              ></div>
              <span>
                {hasStreams
                  ? `${remoteStreams.length} stream${remoteStreams.length !== 1 ? 's' : ''} active`
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
  );
}

export function ConnectionStatusSection({
  peerIsConnected,
  remoteStreams,
  isInControl,
}: {
  peerIsConnected: boolean;
  remoteStreams: RemoteCameraStream[];
  isInControl: boolean;
}) {
  const activeStreamCount = remoteStreams.length;
  const hasActiveStreams = activeStreamCount > 0;

  return (
    <div className="bg-foreground/5 rounded-lg border border-foreground/10 p-4">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Connection Status
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/70">PeerJS</span>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${peerIsConnected ? "bg-green-500" : "bg-red-500"
                }`}
            ></div>
            <span className="text-sm">
              {peerIsConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/70">Video Streams</span>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${hasActiveStreams ? "bg-green-500" : "bg-gray-400"
                }`}
            ></div>
            <span className="text-sm">
              {hasActiveStreams
                ? `${activeStreamCount} active`
                : "Inactive"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/70">Control Status</span>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${isInControl ? "bg-green-500" : "bg-gray-400"
                }`}
            ></div>
            <span className="text-sm">
              {isInControl ? "In Control" : "No Control"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ControlRequestSection({
  handleRequestControl,
  isRequestingControl,
  requestStatus,
  isInControl,
}: {
  handleRequestControl: () => void;
  isRequestingControl: boolean;
  requestStatus: string | null;
  isInControl: boolean;
}) {
  return (
    <>
      {!isInControl && (
        <div className="pt-3 border-t border-foreground/10">
          <button
            onClick={handleRequestControl}
            disabled={isRequestingControl}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {isRequestingControl ? "Requesting..." : "Request Control"}
          </button>
          {requestStatus && (
            <p
              className={`text-xs mt-2 ${requestStatus.includes("successfully")
                ? "text-green-600"
                : "text-red-600"
                }`}
            >
              {requestStatus}
            </p>
          )}
        </div>
      )}
    </>
  );
}
