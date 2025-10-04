import { useMemo } from "react";
import RobotVisualizer from "../RobotVisualizer";
import {
  DefaultLeftHandDetection,
  DefaultRightHandDetection,
} from "../teletable.model";

export default function IKTest() {
  const currentHands = useMemo(
    () => ({
      left: {
        ...DefaultLeftHandDetection,
      },
      right: {
        ...DefaultRightHandDetection,
      },
    }),
    []
  );
  return (
    <div className="w-screen h-screen relative">
      <RobotVisualizer currentHands={currentHands} />
    </div>
  );
}
