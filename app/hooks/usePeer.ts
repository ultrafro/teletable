import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateFakeVideoStream } from "../rooms/[id]/generateFakeVideoStream";
import { StereoLayout } from "../teletable.model";
import { MonodepthLayoutMetadata } from "./useMonodepthStream";

export interface CameraStreamInfo {
  stream: MediaStream;
  label: string;
  stereoLayout: StereoLayout;
  monodepthLayout?: MonodepthLayoutMetadata; // Layout metadata for monodepth streams
}

export interface UsePeerResult {
  peer: Peer | null;
  isConnected: boolean;
  resetPeer: () => Promise<Peer | null>;
  // Switch a specific camera stream (replaces track in existing connection)
  switchStream: (cameraId: string, stream: MediaStream) => void;
  // Add a camera stream for broadcast to all connected clients
  addCameraStream: (cameraId: string, stream: MediaStream, label: string, stereoLayout?: StereoLayout, monodepthLayout?: MonodepthLayoutMetadata) => void;
  // Update stereo layout and monodepth metadata for a camera stream
  updateStereoLayout: (cameraId: string, stereoLayout: StereoLayout, monodepthLayout?: MonodepthLayoutMetadata) => void;
  // Remove a camera stream from broadcast
  removeCameraStream: (cameraId: string) => void;
  // Get list of broadcast camera IDs
  getBroadcastCameraIds: () => string[];
  // Get camera info including stereo layout
  getCameraInfo: (cameraId: string) => CameraStreamInfo | undefined;
}

export function usePeer(
  onData?: (data: any) => void,
  defaultStream?: MediaStream,
  defaultCameraId?: string
): UsePeerResult {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Map of cameraId -> {stream, label} for all cameras we're broadcasting
  const localStreams = useRef<Map<string, CameraStreamInfo>>(new Map());

  // Map of clientPeerId -> Map<cameraId, MediaConnection>
  // Tracks all active media connections per client, per camera
  const clientConnections = useRef<Map<string, Map<string, MediaConnection>>>(new Map());

  // Initialize with default stream if provided (backward compatibility)
  if (defaultStream && defaultCameraId && !localStreams.current.has(defaultCameraId)) {
    localStreams.current.set(defaultCameraId, { stream: defaultStream, label: "Default Camera", stereoLayout: "mono" });
  } else if (defaultStream && !localStreams.current.has("default")) {
    localStreams.current.set("default", { stream: defaultStream, label: "Default Camera", stereoLayout: "mono" });
  }

  const resetPeer = useCallback(async () => {
    const existingPeer = peer;

    setIsConnected(false);
    setPeer(null);

    if (existingPeer) {
      existingPeer.destroy();
    }

    const newPeer = new Peer({
      debug: 1,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    // const newPeer = new Peer({
    //   debug: 1,
    //   host: "localhost",
    //   port: 9000,
    //   path: '/',
    //   // config: {
    //   //   iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    //   // },
    // });

    let newPeerToReturn: Peer | null = null;

    let isCreatingPeer = true;

    console.log("creating new peer, waiting for connection open...");

    await new Promise((resolve, reject) => {
      newPeer.on("open", () => {
        isCreatingPeer = false;
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

  const firstLoadDone = useRef(false);
  useEffect(() => {
    if (firstLoadDone.current) {
      return;
    }
    firstLoadDone.current = true;
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
      const clientPeerId = call.peer;
      console.log("incoming call from:", clientPeerId);

      // Initialize client connection map if needed
      if (!clientConnections.current.has(clientPeerId)) {
        clientConnections.current.set(clientPeerId, new Map());
      }

      // Get all available camera streams
      const streams = localStreams.current;

      if (streams.size === 0) {
        console.log("No camera streams available to answer call with");
        return;
      }

      // Answer the initial call with fake stream (just to complete the handshake)
      // We'll call the client back with all cameras including metadata
      const fakeStream = new MediaStream();
      call.answer(fakeStream);
      console.log(`Answered initial call from ${clientPeerId} with fake stream, will call back with all cameras`);

      const clientMap = clientConnections.current.get(clientPeerId)!;

      // Call the client with ALL cameras including metadata (so stereo layout is transmitted)
      for (const [cameraId, cameraInfo] of streams.entries()) {
        console.log(`Calling client ${clientPeerId} with camera: ${cameraId} (${cameraInfo.label}) stereo: ${cameraInfo.stereoLayout}`);
        const outgoingCall = peer.call(clientPeerId, cameraInfo.stream, {
          metadata: {
            cameraId,
            label: cameraInfo.label,
            stereoLayout: cameraInfo.stereoLayout,
            monodepthLayout: cameraInfo.monodepthLayout
          }
        });

        // Store this connection
        clientMap.set(cameraId, outgoingCall);

        // Handle call close
        outgoingCall.on("close", () => {
          console.log(`Call closed for camera ${cameraId} with client ${clientPeerId}`);
          clientMap.delete(cameraId);
          if (clientMap.size === 0) {
            clientConnections.current.delete(clientPeerId);
          }
        });
      }
    });

    return () => {
      console.log("unregistering peer listeners (connection and call)");
      peer.off("connection");
      peer.off("call");
      // Close all client connections
      for (const [clientPeerId, cameraMap] of clientConnections.current) {
        for (const [cameraId, call] of cameraMap) {
          call.close();
        }
      }
      clientConnections.current.clear();
    };
  }, [onData, peer]);

  // Switch the stream for a specific camera across all connected clients
  const switchStream = useCallback(
    (cameraId: string, stream: MediaStream) => {
      console.log(`Switching stream for camera ${cameraId}`);

      // Update local stream reference
      const existing = localStreams.current.get(cameraId);
      if (existing) {
        localStreams.current.set(cameraId, { ...existing, stream });
      } else {
        localStreams.current.set(cameraId, { stream, label: cameraId, stereoLayout: "mono" });
      }

      // Replace track in all client connections for this camera
      for (const [clientPeerId, cameraMap] of clientConnections.current) {
        const call = cameraMap.get(cameraId);
        if (call) {
          console.log(`Replacing track for camera ${cameraId} with client ${clientPeerId}`);
          const pc = call.peerConnection;
          const sender = pc
            .getSenders()
            .find((sender) => sender.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
      }
    },
    []
  );

  // Add a new camera stream for broadcast
  const addCameraStream = useCallback(
    (cameraId: string, stream: MediaStream, label: string, stereoLayout: StereoLayout = "mono", monodepthLayout?: MonodepthLayoutMetadata) => {
      console.log(`Adding camera stream: ${cameraId} (${label}) stereo: ${stereoLayout}`);

      // Store the stream
      localStreams.current.set(cameraId, { stream, label, stereoLayout, monodepthLayout });

      // Call all connected clients with this new camera stream
      if (peer) {
        for (const [clientPeerId, cameraMap] of clientConnections.current) {
          // Only add if this camera isn't already connected to this client
          if (!cameraMap.has(cameraId)) {
            console.log(`Calling client ${clientPeerId} with new camera: ${cameraId}`);
            const call = peer.call(clientPeerId, stream, {
              metadata: { cameraId, label, stereoLayout, monodepthLayout }
            });

            cameraMap.set(cameraId, call);

            call.on("close", () => {
              console.log(`Call closed for camera ${cameraId} with client ${clientPeerId}`);
              cameraMap.delete(cameraId);
              if (cameraMap.size === 0) {
                clientConnections.current.delete(clientPeerId);
              }
            });
          }
        }
      }
    },
    [peer]
  );

  // Remove a camera stream from broadcast
  const removeCameraStream = useCallback(
    (cameraId: string) => {
      console.log(`Removing camera stream: ${cameraId}`);

      // Remove from local streams
      localStreams.current.delete(cameraId);

      // Close all connections for this camera
      for (const [clientPeerId, cameraMap] of clientConnections.current) {
        const call = cameraMap.get(cameraId);
        if (call) {
          console.log(`Closing call for camera ${cameraId} with client ${clientPeerId}`);
          call.close();
          cameraMap.delete(cameraId);
        }
      }
    },
    []
  );

  // Get list of currently broadcasting camera IDs
  const getBroadcastCameraIds = useCallback(() => {
    return Array.from(localStreams.current.keys());
  }, []);

  // Get camera info including stereo layout
  const getCameraInfo = useCallback((cameraId: string) => {
    return localStreams.current.get(cameraId);
  }, []);

  // Update stereo layout for a camera stream (requires reconnecting to clients)
  const updateStereoLayout = useCallback(
    (cameraId: string, stereoLayout: StereoLayout, monodepthLayout?: MonodepthLayoutMetadata) => {
      const existing = localStreams.current.get(cameraId);
      if (!existing) {
        console.warn(`Cannot update stereo layout: camera ${cameraId} not found`);
        return;
      }

      console.log(`Updating stereo layout for camera ${cameraId} to ${stereoLayout}`);
      localStreams.current.set(cameraId, { ...existing, stereoLayout, monodepthLayout });

      // Note: To propagate the new layout to clients, we need to close and reopen connections
      // For now, clients will need to reconnect to get the new layout
      // A more sophisticated implementation would use a data channel to send layout updates
    },
    []
  );

  const result: UsePeerResult = useMemo(() => {
    return {
      peer,
      isConnected,
      resetPeer,
      switchStream,
      addCameraStream,
      updateStereoLayout,
      removeCameraStream,
      getBroadcastCameraIds,
      getCameraInfo,
    };
  }, [peer, isConnected, resetPeer, switchStream, addCameraStream, updateStereoLayout, removeCameraStream, getBroadcastCameraIds, getCameraInfo]);

  return result;
}

//onData
//onVideoStream

//resetPeer()
//isConnected
