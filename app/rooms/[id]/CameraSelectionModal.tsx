import { UseCameraResult } from "@/app/hooks/useCamera";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useRef, useState } from "react";
import { RoomData } from "./roomUI.model";
import { User, Session } from "@supabase/supabase-js";

export default function CameraSelectionModal({
  camera,
  peerJS,
  user,
  session,
  roomData,
  onClose,
  refreshRoomData,
}: {
  camera: UseCameraResult;
  peerJS: UsePeerJSResult;
  user: User;
  session: Session | null;
  roomData: RoomData;
  onClose: () => void;
  refreshRoomData: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [makingRoomReady, setMakingRoomReady] = useState(false);

  const handleStartCamera = async () => {
    try {
      await camera.startCamera();

      // Display video stream in preview
      if (camera.stream && videoRef.current) {
        videoRef.current.srcObject = camera.stream;
      }
    } catch (err) {
      console.error("Failed to start camera:", err);
    }
  };

  const handleCancelReady = () => {
    onClose();
    camera.stopCamera();
  };

  const handleConfirmReady = async () => {
    if (!user || !roomData || !camera.stream) return;

    setMakingRoomReady(true);

    try {
      // Initialize PeerJS and get the peer ID
      console.log("Starting PeerJS initialization...");
      const peerId = await peerJS.initializePeer();
      console.log("PeerJS initialization completed, peer ID:", peerId);

      if (!peerId) {
        throw new Error(
          "Failed to get peer ID - PeerJS did not return a valid ID"
        );
      }

      // Call the API to make the room ready
      const response = await fetch("/api/hostIsReadyForControl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
          peerId: peerId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Success! Close dialog and refresh room data
        onClose();
        refreshRoomData();

        // Keep camera running and PeerJS connected for the session
        console.log("Room is now ready with peer ID:", peerId);
      } else {
        throw new Error(result.error || "Failed to make room ready");
      }
    } catch (err) {
      console.error("Error making room ready:", err);
      alert("Failed to make room ready: " + (err as Error).message);
    } finally {
      setMakingRoomReady(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Set Up Camera
        </h3>

        {camera.error && (
          <div className="text-red-600 text-sm mb-4">{camera.error}</div>
        )}

        {peerJS.error && (
          <div className="text-red-600 text-sm mb-4">{peerJS.error}</div>
        )}

        {/* Camera Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Camera:
          </label>
          <select
            value={camera.selectedDeviceId || ""}
            onChange={(e) => camera.selectDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={camera.isLoading}
          >
            <option value="">
              {camera.isLoading ? "Detecting cameras..." : "Choose a camera..."}
            </option>
            {camera.devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {camera.isLoading && camera.devices.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Requesting camera access to detect available devices...
            </p>
          )}
        </div>

        {/* Camera Controls */}
        <div className="mb-4">
          {!camera.stream ? (
            <button
              onClick={handleStartCamera}
              disabled={!camera.selectedDeviceId || camera.isLoading}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {camera.isLoading ? "Starting Camera..." : "Start Camera"}
            </button>
          ) : (
            <div>
              <p className="text-sm text-green-600 mb-2">
                ✅ Camera is running
              </p>
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-48 bg-gray-100 rounded-md"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleCancelReady}
            disabled={makingRoomReady}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmReady}
            disabled={!camera.stream || makingRoomReady}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {makingRoomReady ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Making Ready...
              </>
            ) : (
              "Make Room Ready"
            )}
          </button>
        </div>

        {/* PeerJS Status */}
        {peerJS.peerId && (
          <div className="mt-4 text-xs text-gray-500">
            Peer ID: {peerJS.peerId}
          </div>
        )}
      </div>
    </div>
  );
}
