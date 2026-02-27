"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CameraDevice {
  deviceId: string;
  label: string;
}

type DepthEstimator = any;

export default function DepthTestPage() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);
  const [depthSize, setDepthSize] = useState(256); // 128-518 - actual model input size in pixels
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [colormap, setColormap] = useState<"grayscale" | "turbo">("grayscale");
  const [useWebGPU, setUseWebGPU] = useState(true);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const depthModelRef = useRef<any>(null);
  const depthProcessorRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  // Refs for values that can change during streaming (avoids stale closures)
  const depthSizeRef = useRef(depthSize);
  const colormapRef = useRef(colormap);

  // Keep refs in sync with state and update processor size
  useEffect(() => {
    depthSizeRef.current = depthSize;
    // Update processor size when depth size changes
    const processor = depthProcessorRef.current;
    if (processor) {
      if (processor.image_processor) {
        processor.image_processor.size = { width: depthSize, height: depthSize };
        console.log(`Updated processor.image_processor.size to ${depthSize}x${depthSize}`);
      } else if (processor.feature_extractor) {
        processor.feature_extractor.size = { width: depthSize, height: depthSize };
        console.log(`Updated processor.feature_extractor.size to ${depthSize}x${depthSize}`);
      }
    }
  }, [depthSize]);

  useEffect(() => {
    colormapRef.current = colormap;
  }, [colormap]);

  // Check WebGPU support
  useEffect(() => {
    const checkWebGPU = async () => {
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          setWebGPUSupported(!!adapter);
        } catch {
          setWebGPUSupported(false);
        }
      } else {
        setWebGPUSupported(false);
      }
    };
    checkWebGPU();
  }, []);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      tempStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      setError("Failed to enumerate cameras: " + (err as Error).message);
    }
  }, [selectedCamera]);

  // Load Depth Anything v2 model
  const loadModel = useCallback(async () => {
    if (isModelReady || isModelLoading) return;

    setIsModelLoading(true);
    setModelLoadProgress(0);
    setError(null);

    try {
      const { AutoModel, AutoProcessor, env } = await import("@huggingface/transformers");

      // Configure for browser
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const device = useWebGPU && webGPUSupported ? "webgpu" : "wasm";
      const model_id = "onnx-community/depth-anything-v2-small";
      console.log(`Loading Depth Anything v2 with device: ${device}`);

      // Load model and processor separately so we can modify processor size
      const model = await AutoModel.from_pretrained(model_id, {
        device,
        progress_callback: (progress: any) => {
          if (progress.status === "progress" && progress.progress) {
            setModelLoadProgress(Math.round(progress.progress * 0.8)); // 80% for model
          }
        },
        session_options: { logSeverityLevel: 3 },
      });

      const processor = await AutoProcessor.from_pretrained(model_id);
      setModelLoadProgress(100);

      // Log processor structure to understand it
      console.log("Processor structure:", {
        image_processor: processor.image_processor,
        feature_extractor: processor.feature_extractor,
        keys: Object.keys(processor),
      });

      // Set initial processor size based on depth size setting
      const initialSize = depthSizeRef.current;
      // The processor has image_processor as a direct property (getter)
      if (processor.image_processor) {
        processor.image_processor.size = { width: initialSize, height: initialSize };
        console.log("Set processor.image_processor.size to:", initialSize);
      } else if (processor.feature_extractor) {
        processor.feature_extractor.size = { width: initialSize, height: initialSize };
        console.log("Set processor.feature_extractor.size to:", initialSize);
      } else {
        console.warn("Could not find image_processor or feature_extractor on processor");
      }
      console.log("Initial size set to:", initialSize);

      depthModelRef.current = model;
      depthProcessorRef.current = processor;
      setIsModelReady(true);
      console.log("Depth Anything v2 model loaded successfully");
    } catch (err) {
      console.error("Model loading error:", err);
      setError("Failed to load model: " + (err as Error).message);
    } finally {
      setIsModelLoading(false);
    }
  }, [isModelReady, isModelLoading, useWebGPU, webGPUSupported]);

  // Start camera stream
  const startStream = useCallback(async () => {
    if (!selectedCamera) return;

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      setError("Failed to start camera: " + (err as Error).message);
    }
  }, [selectedCamera]);

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Apply turbo colormap
  const applyTurboColormap = (value: number): [number, number, number] => {
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
  };

  // Process frame with Depth Anything v2
  const processFrame = useCallback(async () => {
    if (
      !videoRef.current ||
      !colorCanvasRef.current ||
      !depthCanvasRef.current ||
      !combinedCanvasRef.current ||
      !depthModelRef.current ||
      !depthProcessorRef.current ||
      isProcessingRef.current
    ) {
      if (isStreaming && isModelReady) {
        animationRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    isProcessingRef.current = true;

    try {
      const colorCtx = colorCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
      const depthCtx = depthCanvasRef.current.getContext("2d");
      const combinedCtx = combinedCanvasRef.current.getContext("2d");

      if (!colorCtx || !depthCtx || !combinedCtx) {
        isProcessingRef.current = false;
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const currentDepthSize = depthSizeRef.current;
      const currentColormap = colormapRef.current;

      // Update canvas sizes if needed
      const combinedWidth = width * 2;
      if (combinedCanvasRef.current.width !== combinedWidth || combinedCanvasRef.current.height !== height) {
        colorCanvasRef.current.width = width;
        colorCanvasRef.current.height = height;
        depthCanvasRef.current.width = width;
        depthCanvasRef.current.height = height;
        combinedCanvasRef.current.width = combinedWidth;
        combinedCanvasRef.current.height = height;
      }

      // Draw frame to color canvas
      colorCtx.drawImage(video, 0, 0, width, height);

      // Get image data for the model
      const imageData = colorCtx.getImageData(0, 0, width, height);
      const { RawImage } = await import("@huggingface/transformers");
      const image = new RawImage(imageData.data, width, height, 4);

      // Process with the processor (uses current feature_extractor.size)
      const inputs = await depthProcessorRef.current(image);

      // Run depth estimation
      const { predicted_depth } = await depthModelRef.current(inputs);
      const depthData = predicted_depth.data;
      const [, depthHeight, depthWidth] = predicted_depth.dims;

      // Find min/max for normalization
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < depthData.length; i++) {
        const v = depthData[i];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
      const range = maxVal - minVal || 1;

      // Create ImageData for depth visualization
      const depthImageData = new Uint8ClampedArray(4 * depthData.length);

      // Apply colormap to depth data
      for (let i = 0; i < depthData.length; i++) {
        const normalizedDepth = (depthData[i] - minVal) / range;
        const pixelIdx = i * 4;

        if (currentColormap === "grayscale") {
          const grayVal = Math.round(normalizedDepth * 255);
          depthImageData[pixelIdx] = grayVal;
          depthImageData[pixelIdx + 1] = grayVal;
          depthImageData[pixelIdx + 2] = grayVal;
        } else {
          const [r, g, b] = applyTurboColormap(normalizedDepth);
          depthImageData[pixelIdx] = r;
          depthImageData[pixelIdx + 1] = g;
          depthImageData[pixelIdx + 2] = b;
        }
        depthImageData[pixelIdx + 3] = 255;
      }

      // Draw depth visualization
      const outImageData = new ImageData(depthImageData, depthWidth, depthHeight);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = depthWidth;
      tempCanvas.height = depthHeight;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(outImageData, 0, 0);
      depthCtx.drawImage(tempCanvas, 0, 0, width, height);

      // Draw combined view: color on left, depth on right (both full size)
      combinedCtx.drawImage(video, 0, 0, width, height);
      combinedCtx.drawImage(depthCanvasRef.current, width, 0);

      // Calculate FPS
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFrameTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
    } catch (err) {
      console.error("Frame processing error:", err);
    }

    isProcessingRef.current = false;

    if (isStreaming && isModelReady) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
  }, [isStreaming, isModelReady]);

  // Start/stop processing loop
  useEffect(() => {
    if (isStreaming && isModelReady) {
      lastFrameTimeRef.current = performance.now();
      frameCountRef.current = 0;
      processFrame();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isStreaming, isModelReady, processFrame]);

  // Initialize cameras on mount
  useEffect(() => {
    enumerateCameras();

    return () => {
      stopStream();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-foreground/10">
        <h1 className="text-2xl font-bold">Webcam Depth Test</h1>
        <p className="text-sm text-foreground/70 mt-1">
          Live depth estimation using Depth Anything v2
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Model Loading Section */}
        {!isModelReady && (
          <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10 mb-8">
            <h2 className="text-xl font-semibold mb-4">Model Setup</h2>

            <div className="space-y-4">
              {/* WebGPU Toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWebGPU}
                    onChange={(e) => setUseWebGPU(e.target.checked)}
                    disabled={isModelLoading || !webGPUSupported}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">
                    Use WebGPU (faster)
                    {webGPUSupported === false && (
                      <span className="text-red-500 ml-2">
                        (not supported in this browser)
                      </span>
                    )}
                    {webGPUSupported === true && (
                      <span className="text-green-500 ml-2">(supported)</span>
                    )}
                  </span>
                </label>
              </div>

              {/* Load Model Button */}
              <button
                onClick={loadModel}
                disabled={isModelLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isModelLoading
                  ? `Loading Model... ${modelLoadProgress}%`
                  : "Load Depth Anything v2 Model"}
              </button>

              {isModelLoading && (
                <div className="w-full bg-foreground/20 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${modelLoadProgress}%` }}
                  />
                </div>
              )}

              <p className="text-xs text-foreground/50">
                First load downloads ~50MB model (cached for future use)
              </p>
            </div>
          </div>
        )}

        {/* Controls Section */}
        <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10 mb-8">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Camera Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                Camera
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={isStreaming}
                className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Depth Size */}
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                Depth Size: {depthSize}px
              </label>
              <input
                type="range"
                min="128"
                max="518"
                step="14"
                value={depthSize}
                onChange={(e) => setDepthSize(parseInt(e.target.value))}
                className="w-full h-2 bg-foreground/20 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Colormap Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                Colormap
              </label>
              <select
                value={colormap}
                onChange={(e) =>
                  setColormap(e.target.value as "grayscale" | "turbo")
                }
                className="w-full px-3 py-2 bg-background border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="grayscale">Grayscale</option>
                <option value="turbo">Turbo (Color)</option>
              </select>
            </div>

            {/* Start/Stop Button */}
            <div className="flex items-end">
              {!isStreaming ? (
                <button
                  onClick={startStream}
                  disabled={!selectedCamera || !isModelReady}
                  className="w-full px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {!isModelReady ? "Load Model First" : "Start"}
                </button>
              ) : (
                <button
                  onClick={stopStream}
                  className="w-full px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isStreaming
                    ? "bg-green-500"
                    : isModelReady
                    ? "bg-yellow-500"
                    : "bg-gray-500"
                }`}
              />
              <span className="text-sm text-foreground/70">
                {isStreaming
                  ? "Streaming"
                  : isModelReady
                  ? "Model Ready"
                  : "Model Not Loaded"}
              </span>
            </div>

            {isStreaming && (
              <span className="text-sm text-foreground/70">FPS: {fps}</span>
            )}

            {isModelReady && (
              <span className="text-sm text-green-600">
                Depth Anything v2 ({useWebGPU && webGPUSupported ? "WebGPU" : "WASM"})
              </span>
            )}
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Video Display */}
        <div className="space-y-6">
          {/* Hidden video element */}
          <video ref={videoRef} className="hidden" playsInline muted autoPlay />

          {/* Combined View */}
          <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
            <h2 className="text-xl font-semibold mb-4">
              Combined View (Color | Depth)
            </h2>
            <div className="flex justify-center">
              <canvas
                ref={combinedCanvasRef}
                className="max-w-full h-auto rounded-lg border border-foreground/20"
                style={{ imageRendering: "auto" }}
              />
            </div>
            {!isStreaming && (
              <div className="mt-4 text-center text-foreground/50">
                {isModelReady
                  ? "Select a camera and click Start to begin"
                  : "Load the model first, then start streaming"}
              </div>
            )}
          </div>

          {/* Individual Views (hidden, used for processing) */}
          <canvas ref={colorCanvasRef} className="hidden" />
          <canvas ref={depthCanvasRef} className="hidden" />

          {/* Info Section */}
          <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
            <h2 className="text-xl font-semibold mb-4">
              About Depth Anything v2
            </h2>
            <div className="text-sm text-foreground/70 space-y-2">
              <p>
                This demo uses{" "}
                <strong>Depth Anything v2</strong> - a state-of-the-art
                monocular depth estimation model that runs directly in your
                browser using WebGPU or WebAssembly.
              </p>
              <p>
                <strong>Depth Size:</strong> Controls the model&apos;s input resolution
                (128-518px). Smaller = faster FPS, larger = better quality.
              </p>
              <p>
                <strong>Colormap:</strong> Choose between grayscale (white =
                close, black = far) or turbo colormap for better visualization.
              </p>
              <p>
                <strong>WebGPU:</strong> Enables GPU acceleration for faster
                inference. Falls back to WebAssembly if not supported.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
