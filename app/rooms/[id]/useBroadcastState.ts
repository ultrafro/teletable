import { UsePeerResult } from "@/app/hooks/usePeer";
import { BothHands, DataFrame } from "@/app/teletable.model";
import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { DataConnection } from "peerjs";
import { useCallback } from "react";

export function useBroadcastState(dataConnection: DataConnection | null) {
  const onUpdate = useCallback(
    (state: Record<string, DataFrame>) => {
      if (dataConnection && dataConnection.open) {
        const broadcastState: Record<string, DataFrame> = {};
        for (const key in state) {
          const truncatedJoints: number[] = [];
          for (let i = 0; i < state[key].joints.length; i++) {
            const size = 100;
            truncatedJoints.push(
              Math.round(state[key].joints[i] * size) / size
            );
          }

          broadcastState[key] = {
            joints: truncatedJoints,
            type: state[key].type,
          };
        }

        dataConnection.send(JSON.stringify(broadcastState));
      }
    },
    [dataConnection]
  );

  return onUpdate;
}
