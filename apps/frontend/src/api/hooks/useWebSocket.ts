import { useEffect, useRef, useState } from "react";
import { websocketService } from "../../services/websocketService";
import { useLocations } from "./useLocations";
import type { ConnectionStatus } from "../types";
import type { WebSocketLocationUpdate } from "@nowhere/ws";

export const useWebSocket = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    websocketService.getConnectionStatus(),
  );
  const [lastLocationUpdate, setLastLocationUpdate] =
    useState<WebSocketLocationUpdate | null>(null);
  const [systemMessages, setSystemMessages] = useState<
    Array<{
      message: string;
      type: string;
      timestamp: number;
    }>
  >([]);

  const { addLocationUpdate } = useLocations();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onLocationUpdate: (update: WebSocketLocationUpdate) => {
        console.log("Received location update:", update);
        setLastLocationUpdate(update);

        // Add to React Query cache
        addLocationUpdate(update);
      },

      onConnectionChange: (status: ConnectionStatus) => {
        console.log("WebSocket connection status changed:", status);
        setConnectionStatus(status);
      },

      onSystemMessage: (message: string, type: string) => {
        console.log("Received system message:", { message, type });
        setSystemMessages((prev) => [
          ...prev.slice(-9), // Keep only last 10 messages
          { message, type, timestamp: Date.now() },
        ]);
      },
    });

    // Connect to WebSocket
    websocketService.connect();

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, [addLocationUpdate]);

  const reconnect = () => {
    websocketService.reconnect();
  };

  const isOnline = connectionStatus.isOnline;

  const getConnectionInfo = () => ({
    isOnline,
    reconnectAttempts: connectionStatus.reconnectAttempts,
    lastConnectionTime: connectionStatus.lastConnectionTime,
    canReconnect: connectionStatus.reconnectAttempts < 5,
  });

  const clearSystemMessages = () => {
    setSystemMessages([]);
  };

  const getRecentSystemMessages = (limit = 5) => {
    return systemMessages.slice(-limit).reverse();
  };

  const refreshStatus = () => {
    setConnectionStatus(websocketService.getConnectionStatus());
  };

  return {
    // Connection state
    isConnected: connectionStatus.isConnected,
    isOnline,
    connectionStatus,

    // Data
    lastLocationUpdate,
    systemMessages,

    // Actions
    reconnect,
    clearSystemMessages,

    // Helpers
    getConnectionInfo,
    getRecentSystemMessages,
    refreshStatus,
  };
};
