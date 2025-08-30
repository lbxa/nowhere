export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LocationSubmitResponse extends ApiResponse {
  userId?: string;
}

export interface LocationsResponse extends ApiResponse {
  locations: any[];
  totalActiveUsers: number;
  historicalTimespan: string;
  lastRefresh: number;
}

export interface StatsResponse extends ApiResponse {
  activeUsers: number;
  activeLocations: number;
  totalStoredLocations: number;
  coverage: {
    city: string;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  dataRetention: {
    displayWindow: string;
    totalDataStored: string;
    oldestEntry: number | null;
  };
  lastUpdate: number;
  uptime: number;
}

export interface CleanupResponse extends ApiResponse {
  deletedCount?: number;
  cutoffHours?: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: number;
  uptime: number;
  version: string;
  environment: string;
  error?: string;
}

export interface RateLimitErrorResponse {
  success: false;
  error: "rate_limited";
  message: string;
  retryAfter: number;
}
