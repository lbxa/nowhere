// Import tRPC type inference utilities
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../backend/src/trpc/appRouter";

// Infer all input and output types from the tRPC router
type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

// Backend API types - now inferred from tRPC router
export type LocationInput = RouterInputs["location"]["submit"];
export type LocationsResponse = RouterOutputs["location"]["getAll"];
export type LocationSubmitResponse = RouterOutputs["location"]["submit"];

// Individual location type from the locations array
export type LocationOutput = LocationsResponse["locations"][number];

// Frontend-specific types
export interface LocationPoint {
  id: string;
  timestamp: number;
  lat: number;
  lng: number;
  userId?: string;
  ageMinutes?: number;
}

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
  type:
    | "permission_denied"
    | "position_unavailable"
    | "timeout"
    | "not_supported";
}

export interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastConnectionTime?: number;
  reconnectAttempts: number;
}

export interface LocationSubmissionStatus {
  isSubmitting: boolean;
  lastSubmissionTime?: number;
  nextSubmissionTime?: number;
  error?: string;
}

// WebSocket message types
export interface WebSocketLocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
  ageMinutes: number;
}

export interface WebSocketMessage {
  type: "location-update" | "system-message";
  data:
    | WebSocketLocationUpdate
    | { message: string; type: string; timestamp: number };
}
