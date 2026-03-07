import { UsePeerResult } from "@/app/hooks/usePeer";
import { MonodepthLayoutMetadata } from "@/app/hooks/useMonodepthStream";
import { StereoLayout } from "@/app/teletable.model";
import { MediaConnection } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";

export interface RemoteCameraStream {
  cameraId: string;
  label: string;
  stream: MediaStream;
  stereoLayout: StereoLayout;
  monodepthLayout?: MonodepthLayoutMetadata;
}

interface IncomingCallInfo {
  call: MediaConnection;
  cameraId: string;
  label: string;
  stream: MediaStream | null;
  stereoLayout: StereoLayout;
  monodepthLayout?: MonodepthLayoutMetadata;
}

export function useMultiVideoCallConnectionClientside(
  hostPeerId: string,
  peer: UsePeerResult
): RemoteCameraStream[] {
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<
    RemoteCameraStream[]
  >([]);

  // Track all incoming calls from host
  const incomingCallsRef = useRef<Map<string, IncomingCallInfo>>(new Map());

  // Track the initial outgoing call to host
  const outgoingCallRef = useRef<MediaConnection | null>(null);
  const initialCameraKeyRef = useRef<string | null>(null);

  // Track if we've initiated the connection
  const hasInitiatedRef = useRef(false);
  // Track latest host peer ID without forcing listener rebinds
  const hostPeerIdRef = useRef(hostPeerId);
  hostPeerIdRef.current = hostPeerId;

  // Create fake video stream for initial call
  const createFakeVideoStream = useCallback((): MediaStream => {
    const fakeVideoStream = new MediaStream();
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText("Multi-Camera Client", 10, 30);
    }
    const videoTrack = canvas.captureStream(10).getVideoTracks()[0];
    if (videoTrack) {
      fakeVideoStream.addTrack(videoTrack);
    }
    return fakeVideoStream;
  }, []);

  // Update state from the ref map
  const updateStreamsState = useCallback(() => {
    const streams: RemoteCameraStream[] = [];
    incomingCallsRef.current.forEach((callInfo) => {
      if (callInfo.stream) {
        streams.push({
          cameraId: callInfo.cameraId,
          label: callInfo.label,
          stream: callInfo.stream,
          stereoLayout: callInfo.stereoLayout,
          monodepthLayout: callInfo.monodepthLayout,
        });
      }
    });
    setRemoteCameraStreams(streams);
  }, []);

  // Handle an incoming call from the host
  const handleIncomingCall = useCallback(
    (call: MediaConnection) => {
      const metadata = call.metadata as {
        cameraId?: string;
        label?: string;
        stereoLayout?: StereoLayout;
        monodepthLayout?: MonodepthLayoutMetadata;
      };
      const cameraId = metadata?.cameraId || call.connectionId;
      const label = metadata?.label || "Unknown Camera";
      const stereoLayout = metadata?.stereoLayout || "mono";
      const monodepthLayout = metadata?.monodepthLayout;

      console.log(
        `[MultiCam Client] Incoming call for camera: ${cameraId} (${label}) stereo: ${stereoLayout}`,
        monodepthLayout ? `monodepth: ${JSON.stringify(monodepthLayout)}` : ""
      );

      // Store call info
      const callInfo: IncomingCallInfo = {
        call,
        cameraId,
        label,
        stream: null,
        stereoLayout,
        monodepthLayout,
      };
      incomingCallsRef.current.set(cameraId, callInfo);

      // Answer with fake stream
      const fakeStream = createFakeVideoStream();
      call.answer(fakeStream);

      // Listen for the stream
      call.on("stream", (stream: MediaStream) => {
        const trackStates = stream
          .getVideoTracks()
          .map((t) => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
          }));
        console.log(
          `[MultiCam Client] Received stream for camera: ${cameraId}`,
          trackStates
        );
        const existingInfo = incomingCallsRef.current.get(cameraId);
        if (existingInfo) {
          existingInfo.stream = stream;
          incomingCallsRef.current.set(cameraId, existingInfo);
          updateStreamsState();
        }
      });

      // Handle call close
      call.on("close", () => {
        console.log(`[MultiCam Client] Call closed for camera: ${cameraId}`);
        incomingCallsRef.current.delete(cameraId);
        updateStreamsState();
      });

      // Handle call error
      call.on("error", (err) => {
        console.error(
          `[MultiCam Client] Call error for camera ${cameraId}:`,
          err
        );
        incomingCallsRef.current.delete(cameraId);
        updateStreamsState();
      });
    },
    [createFakeVideoStream, updateStreamsState]
  );

  // Listen for incoming calls from host (additional camera streams)
  // This must be registered before we initiate the first call to avoid
  // missing fast follow-up calls from host.
  useEffect(() => {
    if (!peer.peer || !peer.isConnected) {
      return;
    }

    console.log("[MultiCam Client] Setting up incoming call listener");

    const callHandler = (call: MediaConnection) => {
      // Only handle calls from the current host. If host ID is not known yet,
      // allow calls through so we don't miss streams during approval transitions.
      const expectedHostPeerId = hostPeerIdRef.current;
      if (!expectedHostPeerId || call.peer === expectedHostPeerId) {
        handleIncomingCall(call);
      }
    };

    peer.peer.on("call", callHandler);

    return () => {
      peer.peer?.off("call", callHandler);
    };
  }, [peer.peer, peer.isConnected, handleIncomingCall]);

  // Initiate connection to host
  useEffect(() => {
    if (!peer.peer || !peer.isConnected || !hostPeerId) {
      return;
    }

    // Prevent duplicate initialization
    if (hasInitiatedRef.current) {
      return;
    }
    hasInitiatedRef.current = true;

    console.log("[MultiCam Client] Initiating connection to host:", hostPeerId);

    // Make initial call to host to signal we want to receive streams
    const fakeStream = createFakeVideoStream();
    const call = peer.peer.call(hostPeerId, fakeStream, {
      metadata: { type: "multi-camera-client" },
    });

    if (!call) {
      console.error(
        "[MultiCam Client] Failed to establish initial call to host"
      );
      hasInitiatedRef.current = false;
      return;
    }

    outgoingCallRef.current = call;

    // The host responds with a fake stream on the initial call (just for handshake)
    // Real camera streams come via separate calls with metadata
    call.on("stream", (stream: MediaStream) => {
      const videoTracks = stream.getVideoTracks();
      const trackStates = videoTracks.map((t) => ({
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      }));
      console.log(
        "[MultiCam Client] Received stream on initial call",
        trackStates
      );
      // Ignore fake/empty streams - real cameras come via incoming calls with metadata
      if (videoTracks.length === 0) {
        console.log("[MultiCam Client] Ignoring empty stream from initial call (host will call back with real cameras)");
        return;
      }
      // Fallback: if host sends a real stream here (legacy behavior), store it
      const defaultCameraId = call.connectionId || "__initial_call__";
      initialCameraKeyRef.current = defaultCameraId;
      const callInfo: IncomingCallInfo = {
        call,
        cameraId: defaultCameraId,
        label: "Default Camera",
        stream,
        stereoLayout: "mono",
      };
      incomingCallsRef.current.set(defaultCameraId, callInfo);
      updateStreamsState();
    });

    call.on("close", () => {
      console.log("[MultiCam Client] Initial call closed");
      const initialKey = initialCameraKeyRef.current;
      if (initialKey) {
        incomingCallsRef.current.delete(initialKey);
        initialCameraKeyRef.current = null;
      }
      updateStreamsState();
    });

    call.on("error", (err) => {
      console.error("[MultiCam Client] Initial call error:", err);
    });

    return () => {
      // Cleanup will be handled by the main cleanup effect
    };
  }, [peer.peer, peer.isConnected, hostPeerId, createFakeVideoStream, updateStreamsState]);

  // Handle reconnection when peer connection drops
  useEffect(() => {
    if (!peer.isConnected) {
      // Connection dropped, reset state
      console.log("[MultiCam Client] Connection dropped, clearing streams");
      hasInitiatedRef.current = false;
      initialCameraKeyRef.current = null;
      incomingCallsRef.current.clear();
      setRemoteCameraStreams([]);
    }
  }, [peer.isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[MultiCam Client] Cleaning up all calls");

      // Close outgoing call
      if (outgoingCallRef.current) {
        outgoingCallRef.current.close();
        outgoingCallRef.current = null;
      }

      // Close all incoming calls
      incomingCallsRef.current.forEach((callInfo) => {
        callInfo.call.close();
      });
      incomingCallsRef.current.clear();
      initialCameraKeyRef.current = null;

      hasInitiatedRef.current = false;
    };
  }, []);

  return remoteCameraStreams;
}
