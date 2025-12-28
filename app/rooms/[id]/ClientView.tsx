import router from "next/router";
import {
  ClientRoomInfo,
  ClientRoomInfoResponse,
  RoomData,
} from "./roomUI.model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { useControlRequest } from "@/app/hooks/useControlRequest";
import { useVideoCall } from "@/app/hooks/useVideoCall";
import { useConnectionRefresh } from "@/app/hooks/useConnectionRefresh";
import {
  BothHands,
  DataFrame,
  DefaultDirectValues,
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "@/app/teletable.model";
import { useProcessHandDetection } from "@/app/useProcessHandDetection";
import RobotVisualizer from "@/app/RobotVisualizer";
import HandViewer from "@/app/HandViewer";
import { useBroadcastHands } from "./useBroadcastHands";
import { useBroadcastState } from "./useBroadcastState";
import { usePeer } from "@/app/hooks/usePeer";
import { useVideoCallConnectionClientside } from "./useVideoCallConnectionClientside";
import { useDataConnectionClientside } from "./useDataConnectionClientside";
import { useIsMobile } from "./useIsMobile";
import { ClientViewMobile } from "./ClientViewMobile";
import { ClientViewDesktop } from "./ClientViewDesktop";
import { useAuth } from "@/app/lib/auth";
import { useAutoRequestControlIfHost } from "./useAutoRequestControlIfHost";

export default function ClientView({
  roomData,
  user,
  session,
  refetchRoomData,
}: {
  roomData: RoomData;
  user: User | null;
  session: Session | null;
  refetchRoomData?: () => void;
}) {
  const peer = usePeer();

  const currentState = useRef<Record<string, DataFrame>>({
    left: {
      joints: [...DefaultDirectValues],
      type: "SO101",
    },
    right: {
      joints: [...DefaultDirectValues],
      type: "SO101",
    },
  });
  const remoteStream = useVideoCallConnectionClientside(
    roomData.hostPeerId || "",
    peer
  );

  const dataConnection = useDataConnectionClientside(
    roomData.hostPeerId || "",
    peer
  );

  const onStateUpdate = useBroadcastState(dataConnection);

  const lastPrintTime = useRef(0);
  const handleJointValuesUpdate = useCallback(
    (robotId: string, jointValues: number[]) => {
      if (Date.now() - lastPrintTime.current > 1000) {
        lastPrintTime.current = Date.now();
        // console.log(
        //   "currentState in jointValuesUpdate",
        //   currentState.current?.right?.joints?.[5]
        // );
      }

      const transmission: Record<string, DataFrame> = JSON.parse(
        JSON.stringify(currentState.current)
      );
      transmission[robotId].joints = [...jointValues];
      onStateUpdate(transmission);
    },
    [onStateUpdate]
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const isInControl = user?.id === roomData.currentControllingClientId;
  const [roomPassword, setRoomPassword] = useState("");

  // Custom hooks
  const { handleRequestControl, isRequestingControl, requestStatus } =
    useControlRequest(
      user,
      session,
      roomData.roomId,
      roomPassword,
      refetchRoomData,
      roomData.isHost
    );

  // Auto-request control if user is the host viewing as client
  useAutoRequestControlIfHost(
    roomData,
    user,
    isInControl,
    isRequestingControl,
    handleRequestControl
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).peer = peer;
    }
  }, [peer]);

  // console.log("peer", peer);
  // console.log("roomData", roomData);

  const isMobile = useIsMobile();
  console.log('[DEV] is in control', isInControl, 'remote stream', remoteStream);

  if (isMobile) {
    return (
      <ClientViewMobile
        isInControl={isInControl}
        currentState={currentState}
        handleJointValuesUpdate={handleJointValuesUpdate}
        roomPassword={roomPassword}
        setRoomPassword={setRoomPassword}
        remoteStream={remoteStream}
        handleRequestControl={handleRequestControl}
        isRequestingControl={isRequestingControl}
        requestStatus={requestStatus}
        peerIsConnected={peer.isConnected}
      />
    );
  } else {
    return (
      <ClientViewDesktop
        isInControl={isInControl}
        currentState={currentState}
        handleJointValuesUpdate={handleJointValuesUpdate}
        roomPassword={roomPassword}
        setRoomPassword={setRoomPassword}
        remoteStream={remoteStream}
        handleRequestControl={handleRequestControl}
        isRequestingControl={isRequestingControl}
        requestStatus={requestStatus}
        peerIsConnected={peer.isConnected}
      />
    );
  }
}
