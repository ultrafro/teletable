import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback } from "react";
import { BothHands } from "./teletable.model";
import { detectionToHandDetection } from "./detectionToHandDetection";

export function useProcessHandDetection(currentHands: BothHands) {
  return useCallback(
    (hands: NormalizedLandmark[][], handedness: Category[][]) => {
      detectionToHandDetection(hands, currentHands, handedness);
    },
    [currentHands]
  );
}
