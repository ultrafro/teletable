import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateFakeVideoStream } from "../rooms/[id]/generateFakeVideoStream";

export interface UsePeerResult {
  peer: Peer | null;
  isConnected: boolean;
  resetPeer: () => Promise<Peer | null>;
  switchStream: (stream: MediaStream) => void;
}

export function usePeer(
  onData?: (data: any) => void,
  defaultStream?: MediaStream
): UsePeerResult {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const currentCall = useRef<MediaConnection | null>(null);

  const localStream = useRef<MediaStream | null>(defaultStream || null);

  const resetPeer = useCallback(async () => {
    setIsConnected(false);
    setPeer(null);

    const newPeer = new Peer({
      debug: 1,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    let newPeerToReturn: Peer | null = null;

    await new Promise((resolve, reject) => {
      newPeer.on("open", () => {
        console.log("peer opened with id:", newPeer.id);
        newPeerToReturn = newPeer;
        setIsConnected(true);
        setPeer(newPeer);
        resolve(true);
      });

      newPeer.on("error", (err: any) => {
        // newPeerToReturn = null;
        console.error("Peer error:", err);
        // setIsConnected(false);
        // setPeer(null);
        // reject(err);
      });
    });

    return newPeerToReturn;
  }, []);

  useEffect(() => {
    console.log("resetting peer on first mount");
    resetPeer().catch(console.error);
  }, [resetPeer]);

  useEffect(() => {
    if (!peer) {
      return;
    }

    console.log("registering connection listener");

    peer.on("connection", (conn: DataConnection) => {
      console.log("connection opened with:", conn.peer);
      console.log("registering data listener");
      //listen to data from connection
      conn.on("data", (data: any) => {
        onData?.(data);
      });
    });

    peer.on("call", (call: MediaConnection) => {
      console.log("incoming call from:", call.peer);
      currentCall.current = call;
      const hostStream = localStream.current;

      if (hostStream) {
        call.answer(hostStream);
        console.log("Answered call with local stream");
      } else {
        console.log("Could not find video stream to answer call with");
      }
    });

    return () => {
      console.log("unregistering peer listeners (connection and call)");
      peer.off("connection");
      peer.off("call");
      currentCall.current = null;
    };
  }, [onData, peer]);

  const switchStream = useCallback(
    (stream: MediaStream) => {
      console.log("switching stream to:", stream);
      localStream.current = stream;
      if (peer && currentCall.current) {
        console.log("replacing track in current call");
        const pc = currentCall.current.peerConnection;
        const sender = pc
          .getSenders()
          .find((sender) => sender.track?.kind === "video");
        if (sender) {
          console.log("replacing track for sender:", sender);
          sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }
    },
    [peer]
  );

  const result: UsePeerResult = useMemo(() => {
    return {
      peer,
      isConnected,
      resetPeer,
      switchStream,
    };
  }, [peer, isConnected, resetPeer]);

  return result;
}

//onData
//onVideoStream

//resetPeer()
//isConnected
