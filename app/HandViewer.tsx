"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
  NormalizedLandmark,
  Category,
} from "@mediapipe/tasks-vision";
import { useLoop } from "./useLoop";
import { useHandLandmarker } from "./useHandLandmarker";
import { useDrawingUtils } from "./useDrawingUtils";
import { useWebcam } from "./useWebcam";

export default function HandViewer({
  onHandsDetected,
}: {
  onHandsDetected?: (
    hands: NormalizedLandmark[][],
    handedness: Category[][]
  ) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handLandmarker = useHandLandmarker();

  const [drawingUtils, setDrawingUtils] = useState<DrawingUtils | null>(null);

  const { webcamRunning, error, videoRef, startWebcam } = useWebcam();

  // Function to update canvas dimensions to match video
  const updateCanvasDimensions = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Update canvas size to match video size
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.style.width = video.offsetWidth + "px";
      canvas.style.height = video.offsetHeight + "px";
    }
  }, []);

  // Add resize event listener
  useEffect(() => {
    const handleResize = () => {
      updateCanvasDimensions();
    };

    window.addEventListener("resize", handleResize);

    // Also handle when video metadata loads (important for initial sizing)
    const video = videoRef.current;
    const handleVideoResize = () => {
      updateCanvasDimensions();
    };

    if (video) {
      video.addEventListener("loadedmetadata", handleVideoResize);
      video.addEventListener("resize", handleVideoResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (video) {
        video.removeEventListener("loadedmetadata", handleVideoResize);
        video.removeEventListener("resize", handleVideoResize);
      }
    };
  }, [updateCanvasDimensions, webcamRunning]);

  const onLoop = useCallback(() => {
    if (
      !handLandmarker ||
      !videoRef.current ||
      !canvasRef.current ||
      !webcamRunning
    ) {
      return;
    }

    // Update canvas dimensions to match video
    updateCanvasDimensions();

    // Clear canvas before drawing
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (!drawingUtils) {
        setDrawingUtils(new DrawingUtils(ctx));
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const results = handLandmarker.detectForVideo(
      videoRef.current,
      performance.now()
    );
    if (results.landmarks && results.landmarks.length > 0) {
      onHandsDetected?.(results.landmarks, results.handedness);
      for (const landmarks of results.landmarks) {
        drawingUtils?.drawConnectors(
          landmarks,
          HandLandmarker.HAND_CONNECTIONS,
          { color: "#00FF00", lineWidth: 3 }
        );
        drawingUtils?.drawLandmarks(landmarks, {
          color: "#FF0000",
          lineWidth: 1,
        });
      }
    }
  }, [handLandmarker, webcamRunning, drawingUtils, updateCanvasDimensions]);
  useLoop(onLoop);

  return (
    <div className="w-fulll h-full">
      {!handLandmarker && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading MediaPipe hand detector...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {handLandmarker && !error && (
        <div ref={containerRef} className="w-full h-full relative">
          <video
            ref={videoRef}
            className="w-full max-w-2xl mx-auto rounded-lg bg-black"
            autoPlay
            playsInline
            muted
            style={{ display: webcamRunning ? "block" : "none" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none rounded-lg"
            style={{ display: webcamRunning ? "block" : "none" }}
          />

          {!webcamRunning && (
            <div className="w-full max-w-2xl mx-auto h-96 bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">👋🏿</div>
                <button
                  onClick={startWebcam}
                  className="px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 bg-blue-500 hover:bg-blue-600 shadow-blue-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {webcamRunning ? "Stop Detection" : "Start Hand Detection"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
