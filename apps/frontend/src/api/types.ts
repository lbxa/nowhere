// Import tRPC type inference utilities
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@nowhere/backend";

// Infer all input and output types from the tRPC router
type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

// Backend API types - now inferred from tRPC router
export type LocationInput = RouterInputs["location"]["submit"];
export type LocationsResponse = RouterOutputs["location"]["getAll"];
export type LocationSubmitResponse = RouterOutputs["location"]["submit"];
export type LocationOutput = LocationsResponse["locations"][number];

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
