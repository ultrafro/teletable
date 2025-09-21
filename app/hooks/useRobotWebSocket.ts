import { useEffect, useRef, useState, useCallback } from "react";
import { BothHands } from "../teletable.model";

export interface RobotWebSocketResult {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  sendHandData: (hands: BothHands) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

const DEFAULT_WS_URL = "ws://localhost:8765";
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export function useRobotWebSocket(
  wsUrl: string = DEFAULT_WS_URL
): RobotWebSocketResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyDisconnectedRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setIsConnecting(true);
    setLastError(null);
    isManuallyDisconnectedRef.current = false;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to robot server");
        setIsConnected(true);
        setIsConnecting(false);
        setLastError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = (event) => {
        console.log(
          "WebSocket disconnected from robot server",
          event.code,
          event.reason
        );
        setIsConnected(false);
        setIsConnecting(false);

        // Only attempt reconnection if not manually disconnected and haven't exceeded max attempts
        if (
          !isManuallyDisconnectedRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          setLastError(
            `Connection lost. Attempting to reconnect... (${
              reconnectAttemptsRef.current + 1
            }/${MAX_RECONNECT_ATTEMPTS})`
          );
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isManuallyDisconnectedRef.current) {
              connect();
            }
          }, RECONNECT_DELAY);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setLastError(
            `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Click reconnect to try again.`
          );
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setLastError(
          "Failed to connect to robot server. Make sure the Python script is running on the correct port."
        );
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message from robot server:", message);

          // Handle any response messages from the robot server here
          if (message.type === "error") {
            setLastError(`Robot server error: ${message.message}`);
          }
        } catch (error) {
          console.warn(
            "Received non-JSON message from robot server:",
            event.data
          );
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      setLastError("Failed to create WebSocket connection");
      setIsConnecting(false);
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    isManuallyDisconnectedRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setLastError(null);
    reconnectAttemptsRef.current = 0;
  }, [clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  const sendHandData = useCallback((hands: BothHands) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: "hand_data",
          timestamp: Date.now(),
          hands: hands,
        };
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending hand data:", error);
        setLastError("Failed to send hand data to robot server");
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        isManuallyDisconnectedRef.current = true;
        wsRef.current.close();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    isConnected,
    isConnecting,
    lastError,
    sendHandData,
    connect,
    disconnect,
    reconnect,
  };
}
