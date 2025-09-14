import { useCallback, useState } from "react";
import { MediaConnection } from "peerjs";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";

export function useVideoCall(
  hostPeerId: string | null,
  peerJS: UsePeerJSResult
) {
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const initiateVideoCall = useCallback(async () => {
    if (!hostPeerId || !peerJS.peer || !peerJS.isConnected) {
      console.error("Cannot initiate call - missing requirements:", {
        hostPeerId: !!hostPeerId,
        peerExists: !!peerJS.peer,
        peerConnected: peerJS.isConnected,
      });
      return;
    }

    console.log("Initiating video call to host:", hostPeerId);

    let retryCount = 0;
    const maxRetries = 5; // Increased retries
    const baseRetryDelay = 2000;

    const attemptCall = async (): Promise<void> => {
      try {
        console.log(
          `Call attempt ${retryCount + 1}/${maxRetries + 1} to host:`,
          hostPeerId
        );
        const call = await peerJS.call(hostPeerId);
        if (call) {
          setActiveCall(call);

          call.on("stream", (stream: MediaStream) => {
            console.log("Received video stream from host");
            setRemoteStream(stream);
          });

          call.on("close", () => {
            console.log("Video call closed");
            setActiveCall(null);
            setRemoteStream(null);
          });

          call.on("error", (err: any) => {
            console.error("Video call error:", err);
            setActiveCall(null);
            setRemoteStream(null);

            // If the call fails and we haven't exceeded retries, try again
            if (retryCount < maxRetries) {
              retryCount++;
              const retryDelay = baseRetryDelay * retryCount; // Exponential backoff
              console.log(
                `Retrying call (attempt ${retryCount}/${maxRetries}) in ${retryDelay}ms due to error:`,
                err.message || err
              );
              setTimeout(() => attemptCall(), retryDelay);
            } else {
              console.error(
                "Maximum retry attempts reached. Call failed permanently."
              );
            }
          });
        }
      } catch (error) {
        console.error("Failed to initiate video call:", error);

        // If the call fails and we haven't exceeded retries, try again
        if (retryCount < maxRetries) {
          retryCount++;
          const retryDelay = baseRetryDelay * retryCount; // Exponential backoff
          console.log(
            `Retrying call (attempt ${retryCount}/${maxRetries}) in ${retryDelay}ms due to error:`,
            (error as Error).message
          );
          setTimeout(() => attemptCall(), retryDelay);
        } else {
          console.error(
            "Maximum retry attempts reached. Call failed permanently."
          );
        }
      }
    };

    peerJS
      .connect(hostPeerId)
      .then((dataConnection) => {
        if (dataConnection) {
          console.log(
            hostPeerId,
            "Data connection established for hand tracking"
          );
        }
      })
      .catch((error) => {
        console.error(
          hostPeerId,
          "Error establishing data connection for hand tracking",
          error
        );
      });

    // Add a small delay before first attempt to ensure host is ready
    setTimeout(() => attemptCall(), 1000);
  }, [hostPeerId, peerJS]);

  return {
    initiateVideoCall,
    activeCall,
    remoteStream,
    setActiveCall,
    setRemoteStream,
  };
}
