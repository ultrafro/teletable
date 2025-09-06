"use client";
import Image from "next/image";
import HandViewer from "./HandViewer";
import RobotVisualizer from "./RobotVisualizer";
import { DefaultHandDetection, BothHands } from "./teletable.model";
import { useMemo } from "react";
import { useProcessHandDetection } from "./useProcessHandDetection";

export default function Home() {
  const currentHands = useMemo<BothHands>(() => {
    return {
      left: JSON.parse(JSON.stringify(DefaultHandDetection)),
      right: JSON.parse(JSON.stringify(DefaultHandDetection)),
    };
  }, []);

  const onRawDetection = useProcessHandDetection(currentHands);

  return (
    <div className="w-full h-full relative" id="canvas-root">
      <RobotVisualizer currentHands={currentHands} />
      <div className="absolute top-0 left-0 z-10 pointer-events-none w-[300px] h-[300px]">
        <div className="pointer-events-auto">
          <HandViewer onHandsDetected={onRawDetection} />
        </div>
      </div>
    </div>
  );
}
