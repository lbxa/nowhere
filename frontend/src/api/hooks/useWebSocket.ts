import { useEffect, useRef, useState } from 'react';
import { websocketService } from '../../services/websocketService';
import { useLocations } from './useLocations';
import type { ConnectionStatus, WebSocketLocationUpdate } from '../types';

export const useWebSocket = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    websocketService.getConnectionStatus()
  );
  const [lastLocationUpdate, setLastLocationUpdate] = useState<WebSocketLocationUpdate | null>(null);
  const [systemMessages, setSystemMessages] = useState<Array<{
    message: string;
    type: string;
    timestamp: number;
  }>>([]);

  const { addLocationUpdate } = useLocations();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onLocationUpdate: (update: WebSocketLocationUpdate) => {
        console.log('Received location update:', update);
        setLastLocationUpdate(update);
        
        // Add to React Query cache
        addLocationUpdate(update);
      },
      
      onConnectionChange: (status: ConnectionStatus) => {
        console.log('WebSocket connection status changed:', status);
        setConnectionStatus(status);
      },
      
      onSystemMessage: (message: string, type: string) => {
        console.log('Received system message:', { message, type });
        setSystemMessages(prev => [
          ...prev.slice(-9), // Keep only last 10 messages
          { message, type, timestamp: Date.now() }
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

  /**
   * Manual reconnection
   */
  const reconnect = () => {
    websocketService.reconnect();
  };

  /**
   * Check if WebSocket is connected
   */
  const isConnected = connectionStatus.isConnected;

  /**
   * Check if device is online
   */
  const isOnline = connectionStatus.isOnline;

  /**
   * Get connection info
   */
  const getConnectionInfo = () => ({
    isConnected,
    isOnline,
    reconnectAttempts: connectionStatus.reconnectAttempts,
    lastConnectionTime: connectionStatus.lastConnectionTime,
    canReconnect: connectionStatus.reconnectAttempts < 5,
  });

  /**
   * Clear system messages
   */
  const clearSystemMessages = () => {
    setSystemMessages([]);
  };

  /**
   * Get recent system messages
   */
  const getRecentSystemMessages = (limit = 5) => {
    return systemMessages.slice(-limit).reverse();
  };

  /**
   * Force refresh connection status
   */
  const refreshStatus = () => {
    setConnectionStatus(websocketService.getConnectionStatus());
  };

  return {
    // Connection state
    isConnected,
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