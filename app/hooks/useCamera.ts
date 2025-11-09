import { useState, useEffect, useCallback, useRef } from "react";
import { generateFakeVideoStream } from "../rooms/[id]/generateFakeVideoStream";

interface CameraDevice {
  deviceId: string;
  label: string;
}

const CAMERA_DEVICE_ID_KEY = "teletable_camera_device_id";

export interface UseCameraResult {
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  initializeCamera: () => Promise<string | null>;
  selectDevice: (deviceId: string) => Promise<void>;
  startCamera: (deviceId?: string) => Promise<MediaStream | null>;
  stopCamera: () => void;
  fakeVideoStream: MediaStream;
}

export function useCamera(): UseCameraResult {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const fakeVideoStream = useRef<MediaStream>(generateFakeVideoStream()!);
  const [stream, setStream] = useState<MediaStream | null>(
    fakeVideoStream.current
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've attempted to auto-start
  const hasAutoStartedRef = useRef(false);

  // Load saved device ID from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDeviceId = localStorage.getItem(CAMERA_DEVICE_ID_KEY);
      if (savedDeviceId) {
        setSelectedDeviceId(savedDeviceId);
      }
    }
  }, []);

  // Get available camera devices (only call when camera access is needed)
  const getDevices = useCallback(async (): Promise<string | null> => {
    try {
      // First request permission to access camera to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      // Stop the temporary stream immediately after getting permission
      tempStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
        }));

      setDevices(videoDevices);

      if (videoDevices.length === 0) {
        return null;
      }

      // Try to use saved device ID if available and still exists
      let deviceToUse: string | null = null;
      if (selectedDeviceId) {
        const savedDeviceExists = videoDevices.some(
          (device) => device.deviceId === selectedDeviceId
        );
        if (savedDeviceExists) {
          deviceToUse = selectedDeviceId;
        }
      }

      // If no saved device or saved device no longer exists, use first device
      if (!deviceToUse) {
        deviceToUse = videoDevices[0].deviceId;
        setSelectedDeviceId(deviceToUse);
        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(CAMERA_DEVICE_ID_KEY, deviceToUse);
        }
      }

      return deviceToUse;
    } catch (err) {
      setError("Failed to get camera devices: " + (err as Error).message);
      return null;
    }
  }, [selectedDeviceId]);

  // Initialize camera access (call this when host wants to set up camera)
  const initializeCamera = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const deviceId = await getDevices();
      return deviceId;
    } catch (err) {
      setError("Failed to initialize camera: " + (err as Error).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getDevices]);

  // Start camera with selected device
  const startCamera = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      let targetDeviceId = deviceId || selectedDeviceId;

      // If no device selected, try to get devices and use first one
      if (!targetDeviceId) {
        const deviceIdFromGetDevices = await getDevices();
        targetDeviceId = deviceIdFromGetDevices;
      }

      if (!targetDeviceId) {
        setError("No camera device available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetDeviceId },
          },
          audio: false,
        });

        setStream(newStream);

        // Update selectedDeviceId if it changed and save to localStorage
        if (targetDeviceId !== selectedDeviceId) {
          setSelectedDeviceId(targetDeviceId);
          if (typeof window !== "undefined") {
            localStorage.setItem(CAMERA_DEVICE_ID_KEY, targetDeviceId);
          }
        }

        // Return the stream directly so callers don't have to wait for state update
        return newStream;
      } catch (err) {
        setError("Failed to start camera: " + (err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDeviceId, stream, getDevices]
  );

  // Start camera automatically on mount (after localStorage loads)
  useEffect(() => {
    // Only auto-start once, and only if we don't already have a stream
    if (!hasAutoStartedRef.current && typeof window !== "undefined") {
      hasAutoStartedRef.current = true;
      startCamera().catch((err) => {
        // Silently handle errors - they'll be set in the error state
        console.error("Failed to auto-start camera:", err);
      });
    }
  }, [stream, startCamera]);

  // Select a different camera device
  const selectDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(CAMERA_DEVICE_ID_KEY, deviceId);
      }

      // If camera is already running, restart with new device
      // if (stream) {
      setIsLoading(true);
      try {
        // Stop current stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
          },
          audio: false,
        });

        setStream(newStream);
      } catch (err) {
        setError("Failed to switch camera: " + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
      // }
    },
    [stream]
  );

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    devices,
    selectedDeviceId,
    stream,
    isLoading,
    error,
    initializeCamera,
    selectDevice,
    startCamera,
    stopCamera,
    fakeVideoStream: fakeVideoStream.current,
  };
}
