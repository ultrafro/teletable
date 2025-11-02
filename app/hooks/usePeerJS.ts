import { useState, useEffect, useCallback, useRef } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";

export interface UsePeerJSResult {
  peer: Peer | null;
  peerId: string | null;
  isConnected: boolean;
  error: string | null;
  connections: DataConnection[];
  mediaConnections: MediaConnection[];
  initializePeer: () => Promise<string>;
  destroyPeer: () => void;
  connect: (remotePeerId: string) => Promise<DataConnection | null>;
  call: (
    remotePeerId: string,
    stream?: MediaStream
  ) => Promise<MediaConnection | null>;
  answerCall: (call: MediaConnection, stream?: MediaStream) => void;
}

export function usePeerJS(): UsePeerJSResult {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [mediaConnections, setMediaConnections] = useState<MediaConnection[]>(
    []
  );
  const initializingRef = useRef(false);

  const initializePeer = useCallback(async (): Promise<string> => {
    if (initializingRef.current || peer) {
      return peerId || "";
    }

    initializingRef.current = true;
    setError(null);

    try {
      console.log("Initializing PeerJS...");

      // Try with minimal configuration first for better compatibility
      const newPeer = new Peer({
        debug: 1,
        config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
      });

      return new Promise<string>((resolve, reject) => {
        newPeer.on("open", (id: string) => {
          console.log("PeerJS connection opened with ID:", id);
          setPeer(newPeer);
          setPeerId(id);
          setIsConnected(true);
          initializingRef.current = false;
          resolve(id);
        });

        newPeer.on("error", (err: any) => {
          console.error("PeerJS error:", err);
          let errorMessage = "Unknown PeerJS error";

          if (err.type === "network") {
            errorMessage =
              "Network error - please check your internet connection";
          } else if (err.type === "peer-unavailable") {
            errorMessage = "Peer unavailable";
          } else if (err.type === "server-error") {
            errorMessage = "PeerJS server error - please try again";
          } else if (err.message) {
            errorMessage = err.message;
          }

          setError(`PeerJS error: ${errorMessage}`);
          initializingRef.current = false;
          reject(err);
        });

        newPeer.on("connection", (conn: DataConnection) => {
          console.log("Incoming connection:", conn.peer);
          setConnections((prev) => [...prev, conn]);

          conn.on("open", () => {
            console.log("Connection opened with:", conn.peer);
          });

          conn.on("close", () => {
            console.log("Connection closed with:", conn.peer);
            setConnections((prev) => prev.filter((c) => c.peer !== conn.peer));
          });

          conn.on("error", (err: any) => {
            console.error("Connection error:", err);
          });
        });

        newPeer.on("call", (call: MediaConnection) => {
          console.log("Incoming call from:", call.peer);
          setMediaConnections((prev) => [...prev, call]);

          call.on("close", () => {
            console.log("Call closed with:", call.peer);
            setMediaConnections((prev) =>
              prev.filter((c) => c.peer !== call.peer)
            );
          });

          call.on("error", (err: any) => {
            console.error("Call error:", err);
            setMediaConnections((prev) =>
              prev.filter((c) => c.peer !== call.peer)
            );
          });
        });

        newPeer.on("disconnected", () => {
          console.log("PeerJS disconnected");
          setIsConnected(false);
        });

        newPeer.on("close", () => {
          console.log("PeerJS connection closed");
          setIsConnected(false);
          setPeer(null);
          setPeerId(null);
          setConnections([]);
          setMediaConnections([]);
        });

        // Set a timeout for connection
        setTimeout(() => {
          if (initializingRef.current) {
            initializingRef.current = false;
            newPeer.destroy();
            reject(
              new Error(
                "PeerJS connection timeout - please check your internet connection"
              )
            );
          }
        }, 15000);
      });
    } catch (err) {
      initializingRef.current = false;
      setError(`Failed to initialize PeerJS: ${(err as Error).message}`);
      throw err;
    }
  }, [peer]);

  const destroyPeer = useCallback(() => {
    if (peer) {
      peer.destroy();
      setPeer(null);
      setPeerId(null);
      setIsConnected(false);
      setConnections([]);
      setMediaConnections([]);
      setError(null);
    }
    initializingRef.current = false;
  }, [peer]);

  const connect = useCallback(
    async (remotePeerId: string): Promise<DataConnection | null> => {
      if (!peer || !isConnected) {
        setError("Peer not initialized or not connected");
        return null;
      }

      try {
        const conn = peer.connect(remotePeerId);

        return new Promise<DataConnection>((resolve, reject) => {
          conn.on("open", () => {
            console.log("Connected to:", remotePeerId);
            setConnections((prev) => [...prev, conn]);
            resolve(conn);
          });

          conn.on("error", (err: any) => {
            console.error("Connection error:", err);
            reject(err);
          });

          conn.on("close", () => {
            console.log("Connection closed with:", remotePeerId);
            setConnections((prev) =>
              prev.filter((c) => c.peer !== remotePeerId)
            );
          });

          // Set a timeout for connection
          setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 10000);
        });
      } catch (err) {
        setError(
          `Failed to connect to ${remotePeerId}: ${(err as Error).message}`
        );
        return null;
      }
    },
    [peer, isConnected]
  );

  const call = useCallback(
    async (
      remotePeerId: string,
      stream?: MediaStream
    ): Promise<MediaConnection | null> => {
      if (!peer || !isConnected) {
        setError("Peer not initialized or not connected");
        return null;
      }

      try {
        console.log("Calling peer:", remotePeerId, "with stream:", !!stream);

        // Create a fake audio/video stream if none provided
        // This is needed for WebRTC to work properly - both sides need to exchange media
        let callStream = stream;
        if (!callStream) {
          try {
            // Create a fake video stream with a canvas
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "black";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const fakeVideoStream = canvas.captureStream(30);

            // Create a fake audio context for audio stream
            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            // Set gain to 0 to make it silent
            gainNode.gain.value = 0;
            oscillator.connect(gainNode);
            gainNode.connect(destination);
            oscillator.start();

            const fakeAudioStream = destination.stream;

            // Combine fake video and audio streams
            callStream = new MediaStream([
              ...fakeVideoStream.getVideoTracks(),
              ...fakeAudioStream.getAudioTracks(),
            ]);

            console.log("Created fake media stream for call");
          } catch (err) {
            console.warn(
              "Failed to create fake media stream, using empty stream:",
              err
            );
            callStream = new MediaStream();
          }
        }

        const call = peer.call(remotePeerId, callStream);

        return new Promise<MediaConnection>((resolve, reject) => {
          call.on("stream", (remoteStream) => {
            console.log("Received stream from:", remotePeerId);
            // Stream will be handled by the component
          });

          call.on("close", () => {
            console.log("Call closed with:", remotePeerId);
            setMediaConnections((prev) =>
              prev.filter((c) => c.peer !== remotePeerId)
            );
          });

          call.on("error", (err: any) => {
            console.error("Call error:", err);
            reject(err);
          });

          // Add to media connections immediately
          setMediaConnections((prev) => [...prev, call]);
          resolve(call);

          // Set a timeout for call connection
          setTimeout(() => {
            if (call.open === false) {
              reject(new Error("Call connection timeout"));
            }
          }, 10000);
        });
      } catch (err) {
        setError(`Failed to call ${remotePeerId}: ${(err as Error).message}`);
        return null;
      }
    },
    [peer, isConnected]
  );

  const answerCall = useCallback(
    (call: MediaConnection, stream?: MediaStream) => {
      console.log("Answering call from:", call.peer, "with stream:", !!stream);

      // Use the provided stream, or an empty MediaStream if none provided
      // The host should always provide their camera stream when answering
      call.answer(stream || new MediaStream());

      call.on("stream", (remoteStream) => {
        console.log("Received stream in answered call from:", call.peer);
        // Stream will be handled by the component
      });
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, [peer]);

  //initialize peer when component mounts
  useEffect(() => {
    if (!peer && !isConnected) {
      initializePeer().catch(console.error);
    }
  }, [peer, isConnected, initializePeer]);

  return {
    peer,
    peerId,
    isConnected,
    error,
    connections,
    mediaConnections,
    initializePeer,
    destroyPeer,
    connect,
    call,
    answerCall,
  };
}
