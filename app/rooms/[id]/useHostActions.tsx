import { UseCameraResult } from "@/app/hooks/useCamera";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { User } from "@supabase/supabase-js";
import { RoomData } from "./roomUI.model";

export function useHostActions(
  user: User | null,
  roomData: RoomData,
  camera: UseCameraResult,
  peerJS: UsePeerJSResult,
  setIsInitializingStream: (isInitializingStream: boolean) => void,
  setIsEndingStream: (isEndingStream: boolean) => void,
  setIsProcessingRequest: (isProcessingRequest: boolean) => void
) {
  const handleMakeRoomReady = async () => {
    if (!user || !roomData) return;

    setIsInitializingStream(true);
    try {
      // First, initialize camera access to get devices and get the selected device ID
      const selectedDeviceId = await camera.initializeCamera();

      if (!selectedDeviceId) {
        throw new Error(
          "No camera devices found or failed to initialize camera"
        );
      }

      // Start the camera stream with the selected device ID
      await camera.startCamera(selectedDeviceId);

      // Initialize PeerJS and get the peer ID
      console.log("Starting PeerJS initialization...");
      const peerId = await peerJS.initializePeer();
      console.log("PeerJS initialization completed, peer ID:", peerId);

      if (!peerId) {
        throw new Error(
          "Failed to get peer ID - PeerJS did not return a valid ID"
        );
      }

      // Wait a moment to ensure PeerJS is fully ready and camera stream is available
      console.log("Waiting for host to be fully ready...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify that both PeerJS and camera are ready
      if (!peerJS.isConnected || !camera.stream) {
        throw new Error(
          "Host not fully ready - PeerJS or camera not available"
        );
      }

      // Call the API to make the room ready
      const response = await fetch("/api/hostIsReadyForControl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
          peerId: peerId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Room is now ready with peer ID:", peerId);
        console.log("Host is ready to receive calls with camera stream");
      } else {
        throw new Error(result.error || "Failed to make room ready");
      }
    } catch (err) {
      console.error("Error making room ready:", err);
      alert("Failed to make room ready: " + (err as Error).message);
      // Clean up on error
      camera.stopCamera();
      peerJS.destroyPeer();
    } finally {
      setIsInitializingStream(false);
    }
  };

  const handleEndStream = async () => {
    if (!user || !roomData) return;

    setIsEndingStream(true);
    try {
      // Call the API to end the stream
      const response = await fetch("/api/endStream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Stop camera and destroy peer connection
        camera.stopCamera();
        peerJS.destroyPeer();
        console.log("Stream ended successfully");
      } else {
        throw new Error(result.error || "Failed to end stream");
      }
    } catch (err) {
      console.error("Error ending stream:", err);
      alert("Failed to end stream: " + (err as Error).message);
    } finally {
      setIsEndingStream(false);
    }
  };

  const handleApproveRequest = async (clientId: string) => {
    if (!user || !roomData) return;

    setIsProcessingRequest(true);
    try {
      const response = await fetch("/api/approveClientRequest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
          clientId: clientId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Client request approved:", clientId);
        // The room data will be updated via the polling mechanism
      } else {
        throw new Error(result.error || "Failed to approve client request");
      }
    } catch (err) {
      console.error("Error approving client request:", err);
      alert("Failed to approve client request: " + (err as Error).message);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  const handleDenyRequest = async (clientId: string) => {
    if (!user || !roomData) return;

    setIsProcessingRequest(true);
    try {
      const response = await fetch("/api/denyClientRequest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
          clientId: clientId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Client request denied:", clientId);
        // The room data will be updated via the polling mechanism
      } else {
        throw new Error(result.error || "Failed to deny client request");
      }
    } catch (err) {
      console.error("Error denying client request:", err);
      alert("Failed to deny client request: " + (err as Error).message);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  const handleRevokeControl = async (clientId: string) => {
    if (!user || !roomData) return;

    setIsProcessingRequest(true);
    try {
      const response = await fetch("/api/revokeClientControl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          hostId: user.id,
          roomId: roomData.roomId,
          clientId: clientId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Client control revoked:", clientId);
        // The room data will be updated via the polling mechanism
      } else {
        throw new Error(result.error || "Failed to revoke client control");
      }
    } catch (err) {
      console.error("Error revoking client control:", err);
      alert("Failed to revoke client control: " + (err as Error).message);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  return {
    handleMakeRoomReady,
    handleEndStream,
    handleApproveRequest,
    handleDenyRequest,
    handleRevokeControl,
  };
}
