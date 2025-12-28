"use client";

import { useMemo } from "react";
import LaserCanvas, { LaserConfig } from "./LaserCanvas";

type LaserDisplayProps = {
  beamRadius?: number;
  beamIntensity?: number;
  attenuationLength?: number;
  backgroundColor?: { r: number; g: number; b: number };
};

export default function LaserDisplay({
  beamRadius = 3,
  beamIntensity = 2.0,
  attenuationLength = 500,
  backgroundColor = { r: 0, g: 0, b: 0 },
}: LaserDisplayProps) {
  const canvasWidth = 800;
  const canvasHeight = 600;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const circleRadius = 150;

  // Position red laser on left side, green on top
  const redLaserX = 50;
  const redLaserY = centerY;
  const greenLaserX = centerX;
  const greenLaserY = 50;

  // Pre-calculate all 32 laser configurations
  const allLasers = useMemo(() => {
    const lasers: LaserConfig[] = [];

    for (let pointIndex = 0; pointIndex < 32; pointIndex++) {
      // Calculate the angle of the point on the circle
      const pointAngle = (pointIndex / 32) * 2 * Math.PI;
      const pointX = centerX + circleRadius * Math.cos(pointAngle);
      const pointY = centerY + circleRadius * Math.sin(pointAngle);

      // Calculate angles from lasers to point
      const redDx = pointX - redLaserX;
      const redDy = pointY - redLaserY;
      const redAngle = (Math.atan2(redDy, redDx) * 180) / Math.PI;

      const greenDx = pointX - greenLaserX;
      const greenDy = pointY - greenLaserY;
      const greenAngle = (Math.atan2(greenDy, greenDx) * 180) / Math.PI;

      // Add red laser for this point
      lasers.push({
        position: { x: redLaserX / canvasWidth, y: redLaserY / canvasHeight },
        angle: redAngle,
        color: { r: 1, g: 0, b: 0 },
        radius: beamRadius,
        intensity: beamIntensity,
        attenuationLength: attenuationLength,
      });

      // Add green laser for this point
      lasers.push({
        position: {
          x: greenLaserX / canvasWidth,
          y: greenLaserY / canvasHeight,
        },
        angle: greenAngle,
        color: { r: 0, g: 1, b: 0 },
        radius: beamRadius,
        intensity: beamIntensity,
        attenuationLength: attenuationLength,
      });
    }

    return lasers;
  }, [
    beamRadius,
    beamIntensity,
    attenuationLength,
    centerX,
    centerY,
    circleRadius,
    canvasWidth,
    canvasHeight,
  ]);

  return (
    <LaserCanvas
      lasers={allLasers}
      width={canvasWidth}
      height={canvasHeight}
      showOriginIndicators={true}
      backgroundColor={backgroundColor}
    />
  );
}



