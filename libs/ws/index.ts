export interface SocketData {
  deviceId?: string;
  joinedUpdates: boolean;
  id: string;
}

export interface WebSocketLocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
  ageMinutes: number;
}

export interface WebSocketMessage {
  type: "location-update" | "system-message" | "join-updates" | "leave-updates";
  data:
    | WebSocketLocationUpdate
    | { message: string; type: string; timestamp: number }
    | { deviceId: string };
}
