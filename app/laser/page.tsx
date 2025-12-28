"use client";

import { useState } from "react";
import LaserDisplay from "./LaserDisplay";

export default function LaserPage() {
  const [beamRadius, setBeamRadius] = useState(3);
  const [beamIntensity, setBeamIntensity] = useState(2.0);
  const [attenuationLength, setAttenuationLength] = useState(500);
  const [bgR, setBgR] = useState(0);
  const [bgG, setBgG] = useState(0);
  const [bgB, setBgB] = useState(0);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-4">
        Laser Display - 32 Points Circle
      </h1>

      <div className="flex gap-8 items-start">
        {/* Canvas */}
        <div className="flex-shrink-0">
          <LaserDisplay
            beamRadius={beamRadius}
            beamIntensity={beamIntensity}
            attenuationLength={attenuationLength}
            backgroundColor={{ r: bgR, g: bgG, b: bgB }}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 min-w-[300px] text-white">
          <div>
            <label className="block text-sm font-medium mb-2">
              Beam Radius (σ): {beamRadius}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={beamRadius}
              onChange={(e) => setBeamRadius(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Peak Intensity (I₀): {beamIntensity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={beamIntensity}
              onChange={(e) => setBeamIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Attenuation Length: {attenuationLength}px
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="10"
              value={attenuationLength}
              onChange={(e) => setAttenuationLength(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="mt-4 p-3 bg-gray-800 rounded">
            <h3 className="text-sm font-bold mb-2">Background Color</h3>
            <div>
              <label className="block text-sm font-medium mb-2">
                Red: {bgR.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bgR}
                onChange={(e) => setBgR(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Green: {bgG.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bgG}
                onChange={(e) => setBgG(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Blue: {bgB.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bgB}
                onChange={(e) => setBgB(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div
              className="mt-2 h-8 rounded border-2 border-gray-600"
              style={{
                backgroundColor: `rgb(${Math.round(bgR * 255)}, ${Math.round(
                  bgG * 255
                )}, ${Math.round(bgB * 255)})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}



