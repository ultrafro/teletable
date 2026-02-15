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
      const videoDevices = deviceList
        .filter((device) => device.kind === "videoinput")
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

          let newStream: MediaStream | null = null;
          let primaryError: Error | null = null;

          try {
            newStream = await getUserMediaWithTimeout(
              {
                video: {
                  deviceId: { exact: deviceId },
                },
                audio: false,
              },
              12000
            );
          } catch (err) {
            primaryError = err as Error;
            // Retry once with generic video constraints. Some browsers/devices
            // can fail exact device selection while still allowing camera access.
            try {
              newStream = await getUserMediaWithTimeout(
                {
                  video: true,
                  audio: false,
                },
                12000
              );
            } catch (fallbackErr) {
              throw primaryError || (fallbackErr as Error);
            }
          }

          if (!newStream) {
            throw new Error("Camera stream could not be created");
          }

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
    [devices]
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

      const startPromises = validEnabledIds.map((deviceId) =>
        startCamera(deviceId).catch((err) => {
          console.error(`Failed to start camera ${deviceId}:`, err);
          return null;
        })
      );

      const results = await Promise.all(startPromises);
      const failedIds = validEnabledIds.filter((_, idx) => !results[idx]);

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
