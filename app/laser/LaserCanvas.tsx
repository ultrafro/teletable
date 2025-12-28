"use client";

import { useRef, useEffect, useCallback } from "react";

export type LaserConfig = {
  position: { x: number; y: number }; // normalized 0-1 or absolute pixels
  angle: number; // degrees
  color: { r: number; g: number; b: number }; // RGB 0-1
  radius?: number; // beam "thickness" (Gaussian σ), default 5
  intensity?: number; // peak intensity I₀, default 1.0
  attenuationLength?: number; // attenuation length, default 200
};

type Beam = {
  origin: { x: number; y: number };
  dir: { x: number; y: number };
  length: number;
  radius: number;
  I0: number;
  attLen: number;
  color: { r: number; g: number; b: number };
};

type LaserCanvasProps = {
  lasers?: LaserConfig[];
  width?: number;
  height?: number;
  showOriginIndicators?: boolean;
  backgroundColor?: { r: number; g: number; b: number };
};

export default function LaserCanvas({
  lasers = [],
  width = 800,
  height = 600,
  showOriginIndicators = true,
  backgroundColor = { r: 0, g: 0, b: 0 },
}: LaserCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Convert laser config to beam
  const configToBeam = useCallback(
    (config: LaserConfig): Beam => {
      // If position is normalized (0-1), convert to pixels
      const originX =
        config.position.x <= 1 ? config.position.x * width : config.position.x;
      const originY =
        config.position.y <= 1 ? config.position.y * height : config.position.y;

      // Convert angle to radians and calculate direction
      const angleRad = (config.angle * Math.PI) / 180;
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);

      // Use a very large length (effectively infinite)
      const maxLength = Math.sqrt(width * width + height * height) * 2;

      return {
        origin: { x: originX, y: originY },
        dir: { x: dirX, y: dirY },
        length: maxLength,
        radius: config.radius ?? 5,
        I0: config.intensity ?? 1.0,
        attLen: config.attenuationLength ?? 200,
        color: config.color,
      };
    },
    [width, height]
  );

  // Calculate intensity from one beam at one pixel
  const calculateIntensity = (px: number, py: number, beam: Beam): number => {
    const { origin: O, dir: v, radius: sigma, I0, attLen: L_att } = beam;

    // Vector from origin to pixel
    const w = { x: px - O.x, y: py - O.y };

    // Distance along the beam
    const t = w.x * v.x + w.y * v.y;

    // Only check if t < 0 (behind the source)
    if (t < 0) {
      return 0;
    }

    // Closest point on the beam line
    const c = { x: O.x + t * v.x, y: O.y + t * v.y };

    // Perpendicular distance from pixel to beam
    const dx = px - c.x;
    const dy = py - c.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    // Transverse Gaussian falloff
    const I_trans = Math.exp(-(r * r) / (2 * sigma * sigma));

    // Longitudinal attenuation (Beer-Lambert style)
    const I_long = Math.exp(-t / L_att);

    // Total intensity from this beam at this pixel
    const I = I0 * I_trans * I_long;

    return I;
  };

  // Render the canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const beams = lasers.map(configToBeam);

    // Reference intensity for normalization
    const Iref = 1.0;

    // Tone mapping function (Reinhard)
    const tone = (x: number) => x / (1 + x);

    // Gamma encoding
    const gamma = 2.2;
    const encode = (x: number) =>
      Math.pow(Math.max(0, Math.min(1, x)), 1 / gamma);

    // Calculate intensity for each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Start with background color
        let I_r = backgroundColor.r;
        let I_g = backgroundColor.g;
        let I_b = backgroundColor.b;

        // Accumulate intensities from all beams
        for (const beam of beams) {
          const intensity = calculateIntensity(x, y, beam);
          I_r += intensity * beam.color.r;
          I_g += intensity * beam.color.g;
          I_b += intensity * beam.color.b;
        }

        // Convert physical intensities to normalized linear RGB
        let R_lin = I_r / Iref;
        let G_lin = I_g / Iref;
        let B_lin = I_b / Iref;

        // Apply tone mapping
        R_lin = tone(R_lin);
        G_lin = tone(G_lin);
        B_lin = tone(B_lin);

        // Apply gamma correction
        const R_srgb = encode(R_lin);
        const G_srgb = encode(G_lin);
        const B_srgb = encode(B_lin);

        // Convert to 0-255
        const r = Math.round(R_srgb * 255);
        const g = Math.round(G_srgb * 255);
        const b = Math.round(B_srgb * 255);
        const a = 255;

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw beam origin indicators
    if (showOriginIndicators) {
      for (const beam of beams) {
        ctx.fillStyle = `rgb(${Math.round(beam.color.r * 255)}, ${Math.round(
          beam.color.g * 255
        )}, ${Math.round(beam.color.b * 255)})`;
        ctx.beginPath();
        ctx.arc(beam.origin.x, beam.origin.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Draw direction indicator
        ctx.strokeStyle = `rgb(${Math.round(beam.color.r * 255)}, ${Math.round(
          beam.color.g * 255
        )}, ${Math.round(beam.color.b * 255)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(beam.origin.x, beam.origin.y);
        ctx.lineTo(
          beam.origin.x + beam.dir.x * 30,
          beam.origin.y + beam.dir.y * 30
        );
        ctx.stroke();
      }
    }
  }, [
    lasers,
    configToBeam,
    width,
    height,
    showOriginIndicators,
    backgroundColor,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border-2 border-gray-600 bg-black"
    />
  );
}



