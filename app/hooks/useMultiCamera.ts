import { useState, useEffect, useCallback, useRef } from "react";

const ENABLED_CAMERAS_KEY = "teletable_enabled_cameras";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraStream {
  deviceId: string;
  label: string;
  stream: MediaStream;
  enabled: boolean; // Whether this camera is enabled for broadcast
}

export interface UseMultiCameraResult {
  devices: CameraDevice[];
  streams: Map<string, CameraStream>; // deviceId -> CameraStream
  enabledCameraIds: string[]; // List of cameras enabled for broadcast
  isLoading: boolean;
  error: string | null;
  initializeCameras: () => Promise<void>;
  startCamera: (deviceId: string) => Promise<MediaStream | null>;
  stopCamera: (deviceId: string) => void;
  toggleCameraEnabled: (deviceId: string, enabled: boolean) => void;
  startAllEnabledCameras: () => Promise<void>;
  stopAllCameras: () => void;
  getEnabledStreams: () => CameraStream[];
}

export function useMultiCamera(): UseMultiCameraResult {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [streams, setStreams] = useState<Map<string, CameraStream>>(new Map());
  const [enabledCameraIds, setEnabledCameraIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've attempted to auto-start
  const hasAutoStartedRef = useRef(false);
  // Track if devices have been initialized
  const devicesInitializedRef = useRef(false);
  const devicesRef = useRef<CameraDevice[]>([]);
  // Store streams in a ref for cleanup
  const streamsRef = useRef<Map<string, CameraStream>>(new Map());
  // Keep enabled camera IDs available synchronously for same-tick operations
  const enabledCameraIdsRef = useRef<string[]>([]);
  const cameraStartInFlightRef = useRef<
    Map<string, Promise<MediaStream | null>>
  >(new Map());
  // Some browsers/drivers are flaky when multiple getUserMedia calls start
  // concurrently. Serialize starts to improve multi-camera reliability.
  const cameraStartQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueCameraStart = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      const run = cameraStartQueueRef.current.then(task, task);
      cameraStartQueueRef.current = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    []
  );

  // Keep streamsRef in sync with state
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    enabledCameraIdsRef.current = enabledCameraIds;
  }, [enabledCameraIds]);

  // Load enabled cameras from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEnabledCameras = localStorage.getItem(ENABLED_CAMERAS_KEY);
      if (savedEnabledCameras) {
        try {
          const parsed = JSON.parse(savedEnabledCameras);
          if (Array.isArray(parsed)) {
            enabledCameraIdsRef.current = parsed;
            setEnabledCameraIds(parsed);
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, []);

  // Save enabled cameras to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && devicesInitializedRef.current) {
      localStorage.setItem(ENABLED_CAMERAS_KEY, JSON.stringify(enabledCameraIds));
    }
  }, [enabledCameraIds]);

  // Get available camera devices
  const getDevices = useCallback(async (): Promise<CameraDevice[]> => {
    let permissionError: Error | null = null;

    try {
      // First request permission to access camera to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      // Stop the temporary stream immediately after getting permission
      tempStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      permissionError = err as Error;
      // Continue and enumerate devices anyway. One camera being busy should not
      // hide all other cameras from selection.
      console.warn("Could not open default camera for labels:", permissionError);
    }

    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const allVideoInputs = deviceList.filter(
        (device) => device.kind === "videoinput"
      );

      console.log(
        "[MultiCamera] enumerateDevices videoinput",
        allVideoInputs.map((device, index) => ({
          index,
          deviceId: device.deviceId,
          label: device.label,
          groupId: device.groupId,
        }))
      );

      const videoDevices = allVideoInputs
        .map((device, index) => ({
          deviceId: device.deviceId,
          label:
            device.label ||
            `Camera ${index + 1}${device.deviceId ? ` (${device.deviceId.slice(0, 5)}...)` : ""}`,
        }));

      setDevices(videoDevices);
      devicesRef.current = videoDevices;
      devicesInitializedRef.current = true;

      if (videoDevices.length === 0 && permissionError) {
        setError("Failed to get camera devices: " + permissionError.message);
      } else {
        setError(null);
      }

      return videoDevices;
    } catch (err) {
      setError("Failed to enumerate camera devices: " + (err as Error).message);
      return [];
    }
  }, []);

  // Initialize cameras - enumerate all devices
  const initializeCameras = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await getDevices();
    } catch (err) {
      setError("Failed to initialize cameras: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [getDevices]);

  // Start a specific camera by deviceId
  const startCamera = useCallback(
    async (deviceId: string): Promise<MediaStream | null> => {
      setError(null);

      // Find the device label
      const device =
        devicesRef.current.find((d) => d.deviceId === deviceId) ||
        devices.find((d) => d.deviceId === deviceId);
      const label = device?.label || `Camera ${deviceId.slice(0, 5)}...`;

      // Check if stream already exists for this device
      const existingStream = streamsRef.current.get(deviceId);
      if (existingStream) {
        return existingStream.stream;
      }

      const pendingStart = cameraStartInFlightRef.current.get(deviceId);
      if (pendingStart) {
        return pendingStart;
      }

      const startPromise = (async (): Promise<MediaStream | null> => {
        try {
          const newStream = await enqueueCameraStart(async () => {
            const getUserMediaWithTimeout = async (
              constraints: MediaStreamConstraints,
              timeoutMs: number
            ): Promise<MediaStream> => {
              const timeoutPromise = new Promise<never>((_, reject) => {
                const id = window.setTimeout(() => {
                  clearTimeout(id);
                  reject(new Error("Timed out waiting for camera access"));
                }, timeoutMs);
              });
              return Promise.race([
                navigator.mediaDevices.getUserMedia(constraints),
                timeoutPromise,
              ]);
            };

            const attemptConstraints: MediaStreamConstraints[] = [
              // First try: native resolution (no width/height constraints) - best for stereo cameras
              {
                video: {
                  deviceId: { exact: deviceId },
                  frameRate: { ideal: 30, max: 30 },
                },
                audio: false,
              },
              // Second try: high resolution that accommodates side-by-side stereo
              {
                video: {
                  deviceId: { exact: deviceId },
                  width: { ideal: 3840 },
                  height: { ideal: 1080 },
                  frameRate: { ideal: 30, max: 30 },
                },
                audio: false,
              },
              // Third try: standard HD
              {
                video: {
                  deviceId: { exact: deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30, max: 30 },
                },
                audio: false,
              },
              // Fourth try: lower resolution fallback
              {
                video: {
                  deviceId: { exact: deviceId },
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  frameRate: { ideal: 15, max: 24 },
                },
                audio: false,
              },
              // Fifth try: minimal constraints
              {
                video: {
                  deviceId: { exact: deviceId },
                },
                audio: false,
              },
              // Last resort: non-exact device ID
              {
                video: {
                  deviceId,
                },
                audio: false,
              },
            ];

            const attemptErrors: string[] = [];
            for (let i = 0; i < attemptConstraints.length; i++) {
              try {
                const startedStream = await getUserMediaWithTimeout(
                  attemptConstraints[i],
                  15000
                );
                const track = startedStream.getVideoTracks()[0];
                const settings = track?.getSettings();
                console.log("[MultiCamera] started", {
                  deviceId,
                  label,
                  attempt: i + 1,
                  trackId: track?.id || null,
                  trackSettings: settings || null,
                });
                return startedStream;
              } catch (err) {
                const asErr = err as Error;
                attemptErrors.push(
                  `attempt ${i + 1}: ${asErr.name || "Error"} - ${asErr.message}`
                );
                // Short cool-down can help with device-driver contention.
                await new Promise((r) => window.setTimeout(r, 250));
              }
            }

            throw new Error(
              `Unable to open camera ${label}. ${attemptErrors.join(" | ")}`
            );
          });

          const isEnabled = enabledCameraIdsRef.current.includes(deviceId);

          const cameraStream: CameraStream = {
            deviceId,
            label,
            stream: newStream,
            enabled: isEnabled,
          };

          setStreams((prev) => {
            const updated = new Map(prev);
            updated.set(deviceId, cameraStream);
            return updated;
          });

          return newStream;
        } catch (err) {
          console.error("[MultiCamera] Failed to start", {
            deviceId,
            label,
            error: err,
          });
          setError(
            `Failed to start camera ${deviceId}: ${(err as Error).message}`
          );
          return null;
        } finally {
          cameraStartInFlightRef.current.delete(deviceId);
        }
      })();

      cameraStartInFlightRef.current.set(deviceId, startPromise);
      return startPromise;
    },
    [devices, enqueueCameraStart]
  );

  // Stop a specific camera
  const stopCamera = useCallback((deviceId: string): void => {
    const cameraStream = streamsRef.current.get(deviceId);
    if (cameraStream) {
      cameraStream.stream.getTracks().forEach((track) => track.stop());
      setStreams((prev) => {
        const updated = new Map(prev);
        updated.delete(deviceId);
        return updated;
      });
    }
  }, []);

  // Toggle whether a camera is enabled for broadcast
  const toggleCameraEnabled = useCallback(
    (deviceId: string, enabled: boolean): void => {
      const current = enabledCameraIdsRef.current;
      let next = current;

      if (enabled) {
        if (!current.includes(deviceId)) {
          next = [...current, deviceId];
        }
      } else {
        next = current.filter((id) => id !== deviceId);
      }

      enabledCameraIdsRef.current = next;
      setEnabledCameraIds(next);

      // Update the stream's enabled status if it exists
      setStreams((prev) => {
        const existing = prev.get(deviceId);
        if (existing) {
          const updated = new Map(prev);
          updated.set(deviceId, { ...existing, enabled });
          return updated;
        }
        return prev;
      });
    },
    []
  );

  // Start all enabled cameras
  const startAllEnabledCameras = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Filter enabled camera IDs to only those that exist in devices
      const validEnabledIds = enabledCameraIds.filter((id) =>
        devicesRef.current.some((d) => d.deviceId === id)
      );

      const failedIds: string[] = [];
      for (const deviceId of validEnabledIds) {
        const result = await startCamera(deviceId).catch((err) => {
          console.error(`Failed to start camera ${deviceId}:`, err);
          return null;
        });
        if (!result) {
          failedIds.push(deviceId);
        }
      }

      // Avoid "Starting..." getting stuck forever when camera start fails.
      if (failedIds.length > 0) {
        setEnabledCameraIds((prev) => {
          const next = prev.filter((id) => !failedIds.includes(id));
          enabledCameraIdsRef.current = next;
          return next;
        });
      }
    } catch (err) {
      setError("Failed to start enabled cameras: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [enabledCameraIds, startCamera]);

  // Stop all cameras
  const stopAllCameras = useCallback((): void => {
    streamsRef.current.forEach((cameraStream, deviceId) => {
      cameraStream.stream.getTracks().forEach((track) => track.stop());
    });
    setStreams(new Map());
  }, []);

  // Get all enabled streams
  const getEnabledStreams = useCallback((): CameraStream[] => {
    const enabledSet = new Set(enabledCameraIdsRef.current);
    const enabledStreams: CameraStream[] = [];
    streams.forEach((cameraStream, deviceId) => {
      if (enabledSet.has(deviceId)) {
        enabledStreams.push({ ...cameraStream, enabled: true });
      }
    });
    return enabledStreams;
  }, [streams]);

  // Auto-start previously enabled cameras on mount
  useEffect(() => {
    const autoStart = async () => {
      if (
        !hasAutoStartedRef.current &&
        typeof window !== "undefined" &&
        enabledCameraIds.length > 0
      ) {
        hasAutoStartedRef.current = true;

        // First initialize devices if not already done
        if (!devicesInitializedRef.current) {
          await initializeCameras();
        }

        // Then start all enabled cameras
        await startAllEnabledCameras();
      }
    };

    // Only auto-start if we have enabled camera IDs loaded from localStorage
    if (enabledCameraIds.length > 0 && !hasAutoStartedRef.current) {
      autoStart().catch((err) => {
        console.error("Failed to auto-start cameras:", err);
      });
    }
  }, [enabledCameraIds, initializeCameras, startAllEnabledCameras]);

  // Refresh device list when hardware changes (plug/unplug, OS re-enumeration).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    const onDeviceChange = () => {
      getDevices().catch((err) => {
        console.error("[MultiCamera] Failed to refresh devices:", err);
      });
    };

    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
  }, [getDevices]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      streamsRef.current.forEach((cameraStream) => {
        cameraStream.stream.getTracks().forEach((track) => track.stop());
      });
    };
  }, []);

  return {
    devices,
    streams,
    enabledCameraIds,
    isLoading,
    error,
    initializeCameras,
    startCamera,
    stopCamera,
    toggleCameraEnabled,
    startAllEnabledCameras,
    stopAllCameras,
    getEnabledStreams,
  };
}
