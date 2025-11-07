import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UsePeerResult {
  peer: Peer | null;
  isConnected: boolean;
  resetPeer: () => Promise<Peer | null>;
}

export function usePeer(
  onData?: (data: any) => void,
  onGetLocalStream?: () => MediaStream | null
): UsePeerResult {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
    resetPeer().catch(console.error);
  }, [resetPeer]);

  useEffect(() => {
    if (!peer) {
      return;
    }

    peer.on("connection", (conn: DataConnection) => {
      //listen to data from connection
      conn.on("data", (data: any) => {
        onData?.(data);
      });
    });

    peer.on("call", (call: MediaConnection) => {
      const localStream = onGetLocalStream?.();

      if (localStream) {
        call.answer(localStream);
        console.log("Answered call with local stream");
      } else {
        call.close();
        console.log("Closed call because no local stream");
      }
    });

    return () => {
      peer.off("connection");
      peer.off("call");
    };
  }, [onData, onGetLocalStream]);

  const result: UsePeerResult = useMemo(() => {
    return {
      peer,
      isConnected,
      resetPeer,
    };
  }, [peer, isConnected, resetPeer]);

  return result;
}

//onData
//onVideoStream

//resetPeer()
//isConnected
