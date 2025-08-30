import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import LocationService from "@/services/locationService.js";
import type { LocationInput } from "@/types/location.types.js";

export interface SocketData {
  deviceId?: string;
  joinedUpdates: boolean;
  id: string;
}

interface WebSocketMessage {
  type: string;
  data?: any;
}

export class SocketHandler {
  private wss: WebSocketServer;
  private locationService: LocationService;
  private activeConnections = new Map<string, WebSocket & { data: SocketData }>();
  private locationUpdatesRoom = new Set<string>();
  private nextId = 1;

  constructor(httpServer: HttpServer, locationService: LocationService) {
    this.locationService = locationService;

    this.wss = new WebSocketServer({
      server: httpServer,
      path: "/api/live",
      verifyClient: (info: { origin?: string; req: IncomingMessage }) => {
        // Handle CORS
        const origin = info.origin;
        const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

        return !origin || origin === allowedOrigin;
      },
    });

    this.setupEventHandlers();
  }

  private generateId(): string {
    return `ws_${this.nextId++}_${Date.now()}`;
  }

  private sendMessage(ws: WebSocket, type: string, data?: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type, data }));
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  }

  private setupEventHandlers(): void {
    this.wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
      const socketId = this.generateId();
      const extendedWs = ws as WebSocket & { data: SocketData };

      // Initialize socket data
      extendedWs.data = {
        deviceId: undefined,
        joinedUpdates: false,
        id: socketId,
      };

      this.activeConnections.set(socketId, extendedWs);
      console.log(`Client connected: ${socketId}`);

      // Handle incoming messages
      ws.on("message", (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(extendedWs, message);
        } catch (error) {
          console.error(`Error parsing message from ${socketId}:`, error);
        }
      });

      // Handle disconnect
      ws.on("close", (code: number, reason: Buffer) => {
        console.log(`Client disconnected: ${socketId}, code: ${code}, reason: ${reason.toString()}`);
        this.activeConnections.delete(socketId);
        this.locationUpdatesRoom.delete(socketId);
        // No cleanup needed - locations fade naturally
      });

      // Handle errors
      ws.on("error", (error: Error) => {
        console.error(`WebSocket error for ${socketId}:`, error);
      });
    });

    // Handle server-level errors
    this.wss.on("error", (error: Error) => {
      console.error("WebSocket server error:", error);
    });
  }

  private handleMessage(ws: WebSocket & { data: SocketData }, message: WebSocketMessage): void {
    switch (message.type) {
      case "join-updates":
        ws.data.joinedUpdates = true;

        if (message.data?.deviceId) {
          ws.data.deviceId = message.data.deviceId;
        }

        this.locationUpdatesRoom.add(ws.data.id);
        console.log(`Client ${ws.data.id} joined location updates`);
        break;

      case "leave-updates":
        ws.data.joinedUpdates = false;
        this.locationUpdatesRoom.delete(ws.data.id);
        console.log(`Client ${ws.data.id} left location updates`);
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Broadcast new individual location to all connected clients
   */
  async broadcastLocationUpdate(userId: string, locationData: LocationInput): Promise<void> {
    try {
      const message = {
        userId: userId,
        lat: locationData.lat,
        lng: locationData.lng,
        timestamp: locationData.timestamp,
        ageMinutes: 0, // Always 0 for new locations
      };

      // Broadcast to all clients in the location-updates room
      for (const socketId of this.locationUpdatesRoom) {
        const ws = this.activeConnections.get(socketId);
        if (ws) {
          this.sendMessage(ws, "location-update", message);
        }
      }

      console.log(`Broadcasted new location for ${userId} to ${this.locationUpdatesRoom.size} clients`);
    } catch (error) {
      console.error("Error broadcasting location update:", error);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): { activeConnections: number; rooms: Record<string, number> } {
    const rooms: Record<string, number> = {
      "location-updates": this.locationUpdatesRoom.size,
    };

    return {
      activeConnections: this.activeConnections.size,
      rooms,
    };
  }

  /**
   * Broadcast a message to all connected clients (for admin/maintenance)
   */
  broadcastMessage(message: string, type: "info" | "warning" | "error" = "info"): void {
    const messageData = {
      message,
      type,
      timestamp: Date.now(),
    };

    // Broadcast to all connected clients
    for (const ws of this.activeConnections.values()) {
      this.sendMessage(ws, "system-message", messageData);
    }
  }

  /**
   * Gracefully shutdown the socket server
   */
  async shutdown(): Promise<void> {
    console.log("Shutting down WebSocket server...");

    // Notify all clients of server shutdown
    this.broadcastMessage("Server is shutting down", "warning");

    // Give clients time to receive the message
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Close all connections
    for (const ws of this.activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, "Server shutting down");
      }
    }

    // Close the WebSocket server
    this.wss.close();
  }

  /**
   * Get the WebSocket server instance (for external access if needed)
   */
  getServer(): WebSocketServer {
    return this.wss;
  }
}

export default SocketHandler;
