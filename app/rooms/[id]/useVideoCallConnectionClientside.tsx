import { UsePeerResult } from "@/app/hooks/usePeer";
import { MediaConnection } from "peerjs";
import { useEffect, useState } from "react";

export function useVideoCallConnectionClientside(
  hostPeerId: string,
  peer: UsePeerResult
) {
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    const establishVideoCall = async () => {
      if (!peer.peer) {
        return;
      }
      if (hostPeerId) {
        console.log("Establishing video call to host:", hostPeerId);

        //create fake media stream with video
        const fakeVideoStream = new MediaStream();
        // Create a canvas-based video track
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Draw a simple colored rectangle as a placeholder
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px Arial";
          ctx.fillText("Video Call", 10, 30);
        }
        const videoTrack = canvas.captureStream(10).getVideoTracks()[0];
        if (videoTrack) {
          fakeVideoStream.addTrack(videoTrack);
        }

        const call = await peer.peer?.call(hostPeerId, fakeVideoStream);
        if (!call) {
          console.error("Failed to establish video call to host:", hostPeerId);
          setActiveCall(null);
          setRemoteStream(null);
          return;
        }
        setActiveCall(call);
        call.on("stream", (stream: MediaStream) => {
          setRemoteStream(stream);
        });
      }
    };
    establishVideoCall();
  }, [hostPeerId, peer]);

  return remoteStream;
}
