import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, type RedisClientType } from "redis";
import LocationService from "../services/locationService";
import type { LocationInput } from "../types/location.types";
import type {
  SocketData,
  WebSocketMessage,
  WebSocketLocationUpdate,
  SystemMessageData,
  JoinUpdatesData,
} from "@nowhere/ws";

export class SocketHandler {
  private wss: WebSocketServer;
  private _locationService: LocationService;
  private redisSubscriber?: ReturnType<typeof createClient>;
  private redisChannel: string = process.env.REDIS_LOCATION_CHANNEL || "realtime:location-updates";
  private activeConnections = new Map<string, WebSocket & { data: SocketData }>();
  private locationUpdatesRoom = new Set<string>();
  private nextId = 1;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatInterval = 60000; // 1 minute
  private readonly pongTimeout = 10000; // 10 seconds to respond to ping

  constructor(httpServer: HttpServer, locationService: LocationService) {
    this._locationService = locationService;

    this.wss = new WebSocketServer({
      server: httpServer,
      path: "/api/live",
      verifyClient: (info: { origin?: string; req: IncomingMessage }) => {
        // Handle CORS (support multiple origins, comma-separated)
        const origin = info.origin;
        const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());
        return !origin || allowed.includes(origin);
      },
    });

    // Initialize Redis Pub/Sub subscriber (non-blocking)
    void this.initializeRedisSubscriber();

    this.setupEventHandlers();
    this.startServerHeartbeat();
  }

  private generateId(): string {
    return `ws_${this.nextId++}_${Date.now()}`;
  }

  private async initializeRedisSubscriber(): Promise<void> {
    try {
      const url = process.env.REDIS_URL || "redis://localhost:6379";
      const subscriber = createClient({ url });
      subscriber.on("error", (err) => {
        console.error("Redis Subscriber Error", err);
      });

      await subscriber.connect();
      this.redisSubscriber = subscriber;

      await subscriber.subscribe(this.redisChannel, (message: string) => {
        try {
          const parsed = JSON.parse(message);

          // Validate that parsed data matches WebSocketLocationUpdate structure
          if (this.isValidLocationUpdate(parsed)) {
            for (const socketId of this.locationUpdatesRoom) {
              const ws = this.activeConnections.get(socketId);
              if (ws) {
                this.sendMessage(ws, "location-update", parsed);
              }
            }
          } else {
            console.error("Invalid location update format from Redis:", parsed);
          }
        } catch (e) {
          console.error("Invalid message on Redis channel:", e);
        }
      });

      console.log(`Subscribed to Redis channel: ${this.redisChannel}`);
    } catch (error) {
      console.error("Failed to initialize Redis subscriber:", error);
    }
  }

  /**
   * Validate that parsed Redis data matches WebSocketLocationUpdate structure
   */
  private isValidLocationUpdate(data: any): data is WebSocketLocationUpdate {
    return (
      typeof data === "object" &&
      data !== null &&
      typeof data.userId === "string" &&
      typeof data.lat === "number" &&
      typeof data.lng === "number" &&
      typeof data.timestamp === "number" &&
      typeof data.ageMinutes === "number"
    );
  }

  // Type-safe message sending with overloads
  private sendMessage(ws: WebSocket, type: "location-update", data: WebSocketLocationUpdate): void;
  private sendMessage(ws: WebSocket, type: "system-message", data: SystemMessageData): void;
  private sendMessage(ws: WebSocket, type: "ping"): void;
  private sendMessage(ws: WebSocket, type: "pong"): void;
  private sendMessage(ws: WebSocket, type: string, data?: WebSocketLocationUpdate | SystemMessageData): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message: WebSocketMessage = { type, data } as WebSocketMessage;
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  }

  private setupEventHandlers(): void {
    this.wss.on("connection", (ws: WebSocket, _request: IncomingMessage) => {
      const socketId = this.generateId();
      const extendedWs = ws as WebSocket & { data: SocketData };

      // Initialize socket data
      extendedWs.data = {
        deviceId: undefined,
        joinedUpdates: false,
        id: socketId,
        lastPong: Date.now(),
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

        if (message.data && "deviceId" in message.data) {
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

      case "pong":
        ws.data.lastPong = Date.now();
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
  getConnectionStats(): {
    activeConnections: number;
    rooms: Record<string, number>;
  } {
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
   * Start server-initiated heartbeat
   */
  private startServerHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.pingAllConnections();
      this.cleanupStaleConnections();
    }, this.heartbeatInterval);
  }

  /**
   * Send ping to all connected clients
   */
  private pingAllConnections(): void {
    for (const ws of this.activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, "ping");
      }
    }
  }

  /**
   * Clean up connections that haven't ponged within timeout
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [socketId, ws] of this.activeConnections.entries()) {
      if (now - ws.data.lastPong > this.pongTimeout) {
        console.log(`Closing stale connection: ${socketId} (last pong: ${now - ws.data.lastPong}ms ago)`);
        staleConnections.push(socketId);

        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, "Connection timeout");
        }
      }
    }

    // Clean up stale connections from tracking
    for (const socketId of staleConnections) {
      this.activeConnections.delete(socketId);
      this.locationUpdatesRoom.delete(socketId);
    }
  }

  /**
   * Stop server heartbeat
   */
  private stopServerHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Gracefully shutdown the socket server
   */
  async shutdown(): Promise<void> {
    console.log("Shutting down WebSocket server...");

    // Stop server heartbeat
    this.stopServerHeartbeat();

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

    // Unsubscribe and disconnect Redis subscriber
    try {
      if (this.redisSubscriber) {
        try {
          await this.redisSubscriber.unsubscribe(this.redisChannel);
        } catch (_) {}
        await this.redisSubscriber.disconnect();
      }
    } catch (e) {
      console.error("Error closing Redis subscriber:", e);
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
