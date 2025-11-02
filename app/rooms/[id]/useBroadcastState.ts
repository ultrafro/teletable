import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { BothHands, DataFrame } from "@/app/teletable.model";
import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback } from "react";

export function useBroadcastState(peerJS: UsePeerJSResult) {
  const onUpdate = useCallback(
    (state: Record<string, DataFrame>) => {
      peerJS.connections.forEach((connection) => {
        connection.send(JSON.stringify(state));
      });
    },
    [peerJS]
  );

  return onUpdate;
}
