import type { ConnectionStatus } from "../api/types";
import { deviceIdService } from "./deviceIdService";
import type { WebSocketLocationUpdate, WebSocketMessage } from "@nowhere/ws";

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionStatus: ConnectionStatus = {
    isOnline: navigator.onLine,
    isConnected: false,
    reconnectAttempts: 0,
  };

  private callbacks: {
    onLocationUpdate?: (update: WebSocketLocationUpdate) => void;
    onConnectionChange?: (status: ConnectionStatus) => void;
    onSystemMessage?: (message: string, type: string) => void;
  } = {};

  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 2000; // Start with 2 seconds

  private constructor() {
    // Listen to online/offline events
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", this.handleOffline.bind(this));
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      this.ws = new WebSocket(this.webSocketUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer();

    if (this.ws) {
      // Send leave message before closing
      this.sendMessage({ type: "leave-updates" });
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    this.updateConnectionStatus({
      isConnected: false,
      reconnectAttempts: 0,
    });
  }

  /**
   * Send message to server
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
      }
    }
  }

  private joinLocationUpdates(): void {
    this.sendMessage({
      type: "join-updates",
      data: {
        deviceId: deviceIdService.getDeviceId(),
      },
    });
  }

  /**
   * Leave location updates room
   */
  leaveLocationUpdates(): void {
    this.sendMessage({ type: "leave-updates" });
  }

  /**
   * Get WebSocket URL from environment
   */
  get webSocketUrl(): string {
    return import.meta.env.VITE_WS_URL;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("WebSocket connected");
    this.updateConnectionStatus({
      isConnected: true,
      lastConnectionTime: Date.now(),
      reconnectAttempts: 0,
    });

    // Join location updates room
    this.joinLocationUpdates();

    this.clearReconnectTimer();
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "location-update":
          if (message.data) {
            this.callbacks.onLocationUpdate?.(message.data);
          }
          break;
        case "system-message":
          if (message.data) {
            this.callbacks.onSystemMessage?.(
              message.data.message,
              message.data.type,
            );
          }
          break;
        case "ping":
          // Respond to server ping with pong
          this.sendMessage({ type: "pong" });
          break;
        default:
          console.log("Unknown WebSocket message type:", message.type);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log("WebSocket disconnected:", event.code, event.reason);
    this.updateConnectionStatus({
      isConnected: false,
    });

    // Attempt to reconnect unless explicitly closed
    if (event.code !== 1000 && this.connectionStatus.isOnline) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Event): void {
    console.error("WebSocket error:", error);
    // Ensure we schedule a reconnect on error as well, in case close isn't fired
    if (this.connectionStatus.isOnline && !this.connectionStatus.isConnected) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.connectionStatus.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      return;
    }

    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    const delay =
      this.reconnectDelay *
      Math.pow(2, this.connectionStatus.reconnectAttempts); // Exponential backoff
    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.connectionStatus.reconnectAttempts + 1})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.updateConnectionStatus({
        reconnectAttempts: this.connectionStatus.reconnectAttempts + 1,
      });
      this.connect();
      this.reconnectTimer = null;
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.updateConnectionStatus({ isOnline: true });
    if (!this.connectionStatus.isConnected) {
      this.connect();
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.updateConnectionStatus({ isOnline: false });
  }

  /**
   * Update connection status and notify callbacks
   */
  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    this.callbacks.onConnectionChange?.(this.connectionStatus);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: {
    onLocationUpdate?: (update: WebSocketLocationUpdate) => void;
    onConnectionChange?: (status: ConnectionStatus) => void;
    onSystemMessage?: (message: string, type: string) => void;
  }): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus.isConnected;
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.disconnect();

    // Calculate exponential backoff delay
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(
      baseDelay * Math.pow(2, this.connectionStatus.reconnectAttempts),
      maxDelay,
    );

    this.updateConnectionStatus({
      reconnectAttempts: this.connectionStatus.reconnectAttempts + 1,
    });

    setTimeout(() => this.connect(), delay);
  }
}

// Export singleton instance
export const websocketService = WebSocketService.getInstance();
export default websocketService;
