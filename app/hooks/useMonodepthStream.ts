import { useRef, useCallback, useState, useEffect } from "react";

export interface MonodepthStreamOptions {
  depthSize?: number; // Model internal processing size (128-518), smaller = faster
  depthScale?: number; // Scale for depth display relative to color (default 0.25)
  colormap?: "grayscale" | "turbo";
  targetFps?: number;
}

// Layout metadata for color+depth regions (UV coordinates)
export interface MonodepthLayoutMetadata {
  // Total canvas dimensions
  totalWidth: number;
  totalHeight: number;
  // Color region (left side, full height)
  color: {
    u: [number, number]; // [start, end] in normalized coords
    v: [number, number];
    width: number;
    height: number;
  };
  // Depth region (top-right, scaled)
  depth: {
    u: [number, number];
    v: [number, number];
    width: number;
    height: number;
  };
}

export interface UseMonodepthStreamResult {
  isModelLoading: boolean;
  modelLoadProgress: number;
  isModelReady: boolean;
  isProcessing: boolean;
  error: string | null;
  fps: number;
  layoutMetadata: MonodepthLayoutMetadata | null;
  loadModel: () => Promise<boolean>;
  unloadModel: () => void;
  startProcessing: (sourceStream: MediaStream) => MediaStream | null;
  stopProcessing: () => void;
  updateOptions: (options: Partial<MonodepthStreamOptions>) => void;
}

// Turbo colormap
function applyTurboColormap(value: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, value));
  let r, g, b;

  if (t < 0.25) {
    r = 0;
    g = 4 * t;
    b = 1;
  } else if (t < 0.5) {
    r = 0;
    g = 1;
    b = 1 - 4 * (t - 0.25);
  } else if (t < 0.75) {
    r = 4 * (t - 0.5);
    g = 1;
    b = 0;
  } else {
    r = 1;
    g = 1 - 4 * (t - 0.75);
    b = 0;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function useMonodepthStream(
  initialOptions: MonodepthStreamOptions = {}
): UseMonodepthStreamResult {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [layoutMetadata, setLayoutMetadata] = useState<MonodepthLayoutMetadata | null>(null);

  // Refs for model and processor
  const modelRef = useRef<any>(null);
  const processorRef = useRef<any>(null);
  const RawImageRef = useRef<any>(null);

  // Processing state refs
  const isProcessingFrameRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);

  // Options refs
  const optionsRef = useRef<MonodepthStreamOptions>({
    depthSize: 256, // Model internal processing size
    depthScale: 0.25,
    colormap: "grayscale",
    targetFps: 60,
    ...initialOptions,
  });

  // FPS tracking
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(0);

  const updateOptions = useCallback((newOptions: Partial<MonodepthStreamOptions>) => {
    optionsRef.current = { ...optionsRef.current, ...newOptions };

    // Update processor size if model is loaded
    if (processorRef.current && newOptions.depthSize !== undefined) {
      const size = newOptions.depthSize;
      if (processorRef.current.image_processor) {
        processorRef.current.image_processor.size = { width: size, height: size };
      } else if (processorRef.current.feature_extractor) {
        processorRef.current.feature_extractor.size = { width: size, height: size };
      }
    }
  }, []);

  const loadModel = useCallback(async (): Promise<boolean> => {
    if (isModelReady || isModelLoading) return isModelReady;

    setIsModelLoading(true);
    setModelLoadProgress(0);
    setError(null);

    try {
      const transformers = await import("@huggingface/transformers");
      const { AutoModel, AutoProcessor, env, RawImage } = transformers;

      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Check WebGPU support
      let device = "wasm";
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = "webgpu";
          }
        } catch {
          // WebGPU not available
        }
      }

      const model_id = "onnx-community/depth-anything-v2-small";
      console.log(`[MonodepthStream] Loading model with device: ${device}`);

      const model = await AutoModel.from_pretrained(model_id, {
        device,
        progress_callback: (progress: any) => {
          if (progress.status === "progress" && progress.progress) {
            setModelLoadProgress(Math.round(progress.progress * 0.8));
          }
        },
        session_options: { logSeverityLevel: 3 },
      });

      const processor = await AutoProcessor.from_pretrained(model_id);
      setModelLoadProgress(100);

      // Set processor size
      const depthSize = optionsRef.current.depthSize || 256;
      if (processor.image_processor) {
        processor.image_processor.size = { width: depthSize, height: depthSize };
      } else if (processor.feature_extractor) {
        processor.feature_extractor.size = { width: depthSize, height: depthSize };
      }

      modelRef.current = model;
      processorRef.current = processor;
      RawImageRef.current = RawImage;
      setIsModelReady(true);
      console.log("[MonodepthStream] Model loaded successfully");
      return true;
    } catch (err) {
      console.error("[MonodepthStream] Model loading error:", err);
      setError("Failed to load depth model: " + (err as Error).message);
      return false;
    } finally {
      setIsModelLoading(false);
    }
  }, [isModelReady, isModelLoading]);

  const unloadModel = useCallback(() => {
    stopProcessing();
    modelRef.current = null;
    processorRef.current = null;
    RawImageRef.current = null;
    setIsModelReady(false);
    setModelLoadProgress(0);
  }, []);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = outputCanvasRef.current;
    const model = modelRef.current;
    const processor = processorRef.current;
    const RawImage = RawImageRef.current;

    if (!video || !canvas || !model || !processor || !RawImage) {
      return;
    }

    if (video.readyState < 2 || isProcessingFrameRef.current) {
      return;
    }

    isProcessingFrameRef.current = true;

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        isProcessingFrameRef.current = false;
        return;
      }

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      const depthScale = optionsRef.current.depthScale || 0.25;
      const colormap = optionsRef.current.colormap || "grayscale";

      // Calculate dimensions
      const depthDisplayWidth = Math.round(videoWidth * depthScale);
      const depthDisplayHeight = Math.round(videoHeight * depthScale);
      const outputWidth = videoWidth + depthDisplayWidth;
      const outputHeight = videoHeight;

      // Resize canvas if needed
      if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
        canvas.width = outputWidth;
        canvas.height = outputHeight;
      }

      // Create temp canvas for frame capture
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoWidth;
      tempCanvas.height = videoHeight;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true })!;
      tempCtx.drawImage(video, 0, 0, videoWidth, videoHeight);

      // Get image data and process
      const imageData = tempCtx.getImageData(0, 0, videoWidth, videoHeight);
      const image = new RawImage(imageData.data, videoWidth, videoHeight, 4);

      const inputs = await processor(image);
      const { predicted_depth } = await model(inputs);
      const depthData = predicted_depth.data;
      const [, modelDepthHeight, modelDepthWidth] = predicted_depth.dims;

      // Normalize depth values
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < depthData.length; i++) {
        if (depthData[i] < minVal) minVal = depthData[i];
        if (depthData[i] > maxVal) maxVal = depthData[i];
      }
      const range = maxVal - minVal || 1;

      // Create depth visualization
      const depthImageData = new Uint8ClampedArray(4 * depthData.length);
      for (let i = 0; i < depthData.length; i++) {
        const normalized = (depthData[i] - minVal) / range;
        const pixelIdx = i * 4;

        if (colormap === "grayscale") {
          const gray = Math.round(normalized * 255);
          depthImageData[pixelIdx] = gray;
          depthImageData[pixelIdx + 1] = gray;
          depthImageData[pixelIdx + 2] = gray;
        } else {
          const [r, g, b] = applyTurboColormap(normalized);
          depthImageData[pixelIdx] = r;
          depthImageData[pixelIdx + 1] = g;
          depthImageData[pixelIdx + 2] = b;
        }
        depthImageData[pixelIdx + 3] = 255;
      }

      // Create depth canvas
      const depthCanvas = document.createElement("canvas");
      depthCanvas.width = modelDepthWidth;
      depthCanvas.height = modelDepthHeight;
      const depthCtx = depthCanvas.getContext("2d")!;
      depthCtx.putImageData(
        new ImageData(depthImageData, modelDepthWidth, modelDepthHeight),
        0,
        0
      );

      // Draw combined output
      // Color on left (full size)
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

      // Fill background for depth area
      ctx.fillStyle = "#000";
      ctx.fillRect(videoWidth, 0, depthDisplayWidth, videoHeight);

      // Draw scaled depth at top-right
      ctx.drawImage(depthCanvas, videoWidth, 0, depthDisplayWidth, depthDisplayHeight);

      // Compute layout metadata (UV coordinates for color and depth regions)
      const colorUEnd = videoWidth / outputWidth;
      const depthVEnd = depthDisplayHeight / outputHeight;

      const newLayoutMetadata: MonodepthLayoutMetadata = {
        totalWidth: outputWidth,
        totalHeight: outputHeight,
        color: {
          u: [0, colorUEnd],
          v: [0, 1],
          width: videoWidth,
          height: videoHeight,
        },
        depth: {
          u: [colorUEnd, 1],
          v: [0, depthVEnd],
          width: depthDisplayWidth,
          height: depthDisplayHeight,
        },
      };

      // Only update if dimensions changed to avoid excessive re-renders
      setLayoutMetadata((prev) => {
        if (
          !prev ||
          prev.totalWidth !== newLayoutMetadata.totalWidth ||
          prev.totalHeight !== newLayoutMetadata.totalHeight
        ) {
          return newLayoutMetadata;
        }
        return prev;
      });

      // Update FPS counter
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    } catch (err) {
      console.error("[MonodepthStream] Frame processing error:", err);
    }

    isProcessingFrameRef.current = false;
  }, []);

  const processingLoop = useCallback(() => {
    if (!outputStreamRef.current) {
      return;
    }

    processFrame().finally(() => {
      if (outputStreamRef.current) {
        animationFrameRef.current = requestAnimationFrame(processingLoop);
      }
    });
  }, [processFrame]);

  const startProcessing = useCallback(
    (sourceStream: MediaStream): MediaStream | null => {
      if (!modelRef.current || !processorRef.current) {
        console.warn("[MonodepthStream] Model not ready");
        return null;
      }

      // Stop any existing processing
      stopProcessing();

      // Create video element for source
      const video = document.createElement("video");
      video.srcObject = sourceStream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      videoRef.current = video;

      // Create output canvas
      const canvas = document.createElement("canvas");
      // Initial size, will be updated when video loads
      canvas.width = 640;
      canvas.height = 480;
      outputCanvasRef.current = canvas;

      // Create output stream
      const targetFps = optionsRef.current.targetFps || 15;
      const outputStream = canvas.captureStream(targetFps);
      outputStreamRef.current = outputStream;

      // Start processing when video is ready
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
      };

      video.onplay = () => {
        setIsProcessing(true);
        lastFpsTimeRef.current = performance.now();
        frameCountRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(processingLoop);
      };

      // Handle errors
      video.onerror = (e) => {
        console.error("[MonodepthStream] Video error:", e);
        setError("Video source error");
      };

      return outputStream;
    },
    [processingLoop]
  );

  const stopProcessing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    if (outputStreamRef.current) {
      outputStreamRef.current.getTracks().forEach((track) => track.stop());
      outputStreamRef.current = null;
    }

    outputCanvasRef.current = null;
    setIsProcessing(false);
    setFps(0);
    setLayoutMetadata(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing();
    };
  }, [stopProcessing]);

  return {
    isModelLoading,
    modelLoadProgress,
    isModelReady,
    isProcessing,
    error,
    fps,
    layoutMetadata,
    loadModel,
    unloadModel,
    startProcessing,
    stopProcessing,
    updateOptions,
  };
}
