import { useState, useEffect, useCallback } from "react";

interface CameraDevice {
  deviceId: string;
  label: string;
}

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
}

export function useCamera(): UseCameraResult {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Select first device by default if none selected and return the selected device ID
      if (videoDevices.length > 0 && !selectedDeviceId) {
        const firstDeviceId = videoDevices[0].deviceId;
        setSelectedDeviceId(firstDeviceId);
        return firstDeviceId;
      }

      return selectedDeviceId;
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
      const targetDeviceId = deviceId || selectedDeviceId;

      if (!targetDeviceId) {
        setError("No camera device selected");
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

        // Update selectedDeviceId if a specific deviceId was passed
        if (deviceId && deviceId !== selectedDeviceId) {
          setSelectedDeviceId(deviceId);
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
    [selectedDeviceId, stream]
  );

  // Select a different camera device
  const selectDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      // If camera is already running, restart with new device
      if (stream) {
        setIsLoading(true);
        try {
          // Stop current stream
          stream.getTracks().forEach((track) => track.stop());

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
      }
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
  };
}
