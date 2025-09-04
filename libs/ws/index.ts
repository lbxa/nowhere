export interface SocketData {
  deviceId?: string;
  joinedUpdates: boolean;
  id: string;
  lastPong: number;
}

export interface WebSocketLocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
  ageMinutes: number;
}

export interface SystemMessageData {
  message: string;
  type: string;
  timestamp: number;
}

export interface JoinUpdatesData {
  deviceId: string;
}

// Discriminated union for type-safe WebSocket messages
export type WebSocketMessage =
  | { type: "location-update"; data: WebSocketLocationUpdate }
  | { type: "system-message"; data: SystemMessageData }
  | { type: "join-updates"; data: JoinUpdatesData }
  | { type: "leave-updates" }
  | { type: "ping" }
  | { type: "pong" };

// Helper type to extract data type for a given message type
export type MessageDataForType<T extends WebSocketMessage["type"]> =
  Extract<WebSocketMessage, { type: T }> extends { data: infer D } ? D : never;

// Type-safe message creation helpers
export const createWebSocketMessage = {
  locationUpdate: (data: WebSocketLocationUpdate): WebSocketMessage => ({
    type: "location-update",
    data,
  }),
  systemMessage: (data: SystemMessageData): WebSocketMessage => ({
    type: "system-message",
    data,
  }),
  joinUpdates: (data: JoinUpdatesData): WebSocketMessage => ({
    type: "join-updates",
    data,
  }),
  leaveUpdates: (): WebSocketMessage => ({
    type: "leave-updates",
  }),
  ping: (): WebSocketMessage => ({
    type: "ping",
  }),
  pong: (): WebSocketMessage => ({
    type: "pong",
  }),
};
