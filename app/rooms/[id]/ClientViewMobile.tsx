import { DataFrame, ExternalGoal, MobileGoal } from "@/app/teletable.model";
import {
  RefObject,
  useEffect,
  useRef,
  useState,
  useCallback,
  MutableRefObject,
} from "react";
import RobotVisualizer from "@/app/RobotVisualizer";
import { Joystick } from "./Joystick";
import { Vector3 } from "three";
import { MobileControlSection } from "./MobileControlSection";
import { RemoteCameraStream } from "./useMultiVideoCallConnectionClientside";

export function ClientViewMobile({
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
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // Adjust camera index when streams array changes
  useEffect(() => {
    if (remoteStreams.length === 0) {
      setCurrentCameraIndex(0);
    } else if (currentCameraIndex >= remoteStreams.length) {
      setCurrentCameraIndex(remoteStreams.length - 1);
    }
  }, [remoteStreams.length, currentCameraIndex]);

  const mobileGoal = useRef<MobileGoal>({
    right: {
      position: new Vector3(0, 0, 0),
      roll: 0,
      pitch: 0,
      gripper: 0,
    },
    left: {
      position: new Vector3(0, 0, 0),
      roll: 0,
      pitch: 0,
      gripper: 0,
    },
  });

  const [focusedRobot, setFocusedRobot] = useState<string | null>("right");

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Full frame robot visualizer */}
      <div className="absolute inset-0">
        <RobotVisualizer
          currentState={currentState}
          //controlMode="ExternalGoal"
          controlMode="WidgetGoal"
          onJointValuesUpdate={handleJointValuesUpdate}
          //mobileGoal={mobileGoal.current}
          focusedRobot={focusedRobot}
        />
      </div>

      {/* Burger menu button - Top left */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="absolute top-4 left-4 z-20 bg-white rounded-lg border border-gray-200 shadow-lg p-2.5 flex items-center justify-center hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isMenuOpen ? (
          <svg
            className="w-5 h-5 text-gray-700"
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
        ) : (
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      {/* Backdrop overlay */}
      {isMenuOpen && (
        <div
          className="absolute inset-0 bg-black/20 z-10"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Slide-out menu panel */}
      <div
        className={`absolute top-0 left-0 h-full w-[280px] bg-white shadow-xl z-20 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex flex-col gap-3 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5 text-gray-600"
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
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <MobileRoomPasswordSection
              roomPassword={roomPassword}
              setRoomPassword={setRoomPassword}
            />
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <MobileControlRequestSection
              handleRequestControl={handleRequestControl}
              isRequestingControl={isRequestingControl}
              requestStatus={requestStatus}
              isInControl={isInControl}
            />
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <MobileRobotSelectorSection
              focusedRobot={focusedRobot}
              setFocusedRobot={setFocusedRobot}
            />
          </div>
        </div>
      </div>

      {/* Top right: Remote View section */}
      <div className="absolute top-4 right-4 z-10 max-w-[240px]">
        <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-2.5">
          <MobileRemoteViewSection
            remoteStreams={remoteStreams}
            currentCameraIndex={currentCameraIndex}
            setCurrentCameraIndex={setCurrentCameraIndex}
            isInControl={isInControl}
          />
        </div>
      </div>

      {/* Bottom: Control section */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-4"
        style={{
          paddingBottom: `max(1.5rem, calc(1rem + env(safe-area-inset-bottom)))`,
        }}
      >
        <MobileControlSection
          isInControl={isInControl}
          mobileGoal={mobileGoal}
          focusedRobot={focusedRobot}
        />
      </div>
    </div>
  );
}

function MobileRoomPasswordSection({
  roomPassword,
  setRoomPassword,
}: {
  roomPassword: string;
  setRoomPassword: (roomPassword: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-700">Room Password</label>
      <input
        type="password"
        value={roomPassword}
        onChange={(e) => setRoomPassword(e.target.value)}
        placeholder="Enter password"
        className="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

function MobileRemoteViewSection({
  remoteStreams,
  currentCameraIndex,
  setCurrentCameraIndex,
  isInControl,
}: {
  remoteStreams: RemoteCameraStream[];
  currentCameraIndex: number;
  setCurrentCameraIndex: (index: number) => void;
  isInControl: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentStream = remoteStreams[currentCameraIndex] ?? null;
  const hasMultipleCameras = remoteStreams.length > 1;
  const canGoLeft = currentCameraIndex > 0;
  const canGoRight = currentCameraIndex < remoteStreams.length - 1;

  useEffect(() => {
    if (videoRef.current && currentStream) {
      videoRef.current.srcObject = currentStream.stream;
    }
  }, [currentStream]);

  const handlePrevCamera = () => {
    if (canGoLeft) {
      setCurrentCameraIndex(currentCameraIndex - 1);
    }
  };

  const handleNextCamera = () => {
    if (canGoRight) {
      setCurrentCameraIndex(currentCameraIndex + 1);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        {hasMultipleCameras ? (
          <>
            <button
              onClick={handlePrevCamera}
              disabled={!canGoLeft}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous camera"
            >
              <svg
                className="w-4 h-4 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-xs font-medium text-gray-700 truncate px-1">
              {currentStream?.label ?? "No Camera"}
            </h3>
            <button
              onClick={handleNextCamera}
              disabled={!canGoRight}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next camera"
            >
              <svg
                className="w-4 h-4 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        ) : (
          <h3 className="text-xs font-medium text-gray-700">
            {currentStream?.label ?? "Remote Feed"}
          </h3>
        )}
      </div>

      {/* Video container */}
      <div className="bg-gray-50 rounded-md border border-gray-300 overflow-hidden aspect-video">
        {currentStream && isInControl ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center px-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mb-2 mx-auto">
                <svg
                  className="w-4 h-4 text-gray-400"
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
              <p className="text-gray-500 text-xs">
                {isInControl ? "Connecting..." : "Request control to view"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Position indicator dots and stream status */}
      <div className="flex items-center justify-between">
        {hasMultipleCameras ? (
          <div className="flex items-center gap-1">
            {remoteStreams.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCameraIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index === currentCameraIndex
                    ? "bg-blue-600"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Go to camera ${index + 1}`}
              />
            ))}
          </div>
        ) : (
          <div />
        )}
        {isInControl && currentStream && (
          <div className="flex items-center space-x-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Stream active</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileControlRequestSection({
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
    <div className="flex flex-col gap-1.5">
      {!isInControl ? (
        <>
          <button
            onClick={handleRequestControl}
            disabled={isRequestingControl}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-1.5 px-3 rounded-md transition-colors text-xs font-medium"
          >
            {isRequestingControl ? "Requesting..." : "Request Control"}
          </button>
          {requestStatus && (
            <p
              className={`text-xs ${
                requestStatus.includes("successfully")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {requestStatus}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-600 font-medium">
            You have control
          </span>
        </div>
      )}
    </div>
  );
}

function MobileRobotSelectorSection({
  focusedRobot,
  setFocusedRobot,
}: {
  focusedRobot: string | null;
  setFocusedRobot: (robot: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-700">Control Robot</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFocusedRobot("left")}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
            focusedRobot === "left"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Left
        </button>
        <button
          onClick={() => setFocusedRobot("right")}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
            focusedRobot === "right"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Right
        </button>
      </div>
    </div>
  );
}
