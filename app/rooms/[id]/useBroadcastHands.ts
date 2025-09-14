import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { BothHands } from "@/app/teletable.model";
import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback } from "react";

export function useBroadcastHands(
  onRawDetection: (
    hands: NormalizedLandmark[][],
    worldLandmarks: NormalizedLandmark[][],
    handedness: Category[][]
  ) => void,
  peerJS: UsePeerJSResult,
  currentHands: BothHands
) {
  const onUpdate = useCallback(
    (
      hands: NormalizedLandmark[][],
      worldLandmarks: NormalizedLandmark[][],
      handedness: Category[][]
    ) => {
      onRawDetection(hands, worldLandmarks, handedness);
      peerJS.connections.forEach((connection) => {
        connection.send(JSON.stringify({ currentHands }));
      });
    },
    [onRawDetection, peerJS]
  );

  return onUpdate;
}
