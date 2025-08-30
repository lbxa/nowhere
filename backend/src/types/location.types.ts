export interface LocationInput {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationRecord {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationOutput {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
  ageMinutes: number;
}

export interface LocationValidationResult {
  valid: boolean;
  error?: string;
}

export interface LocationUpdateResult {
  success: boolean;
  userId: string;
  error?: string;
}

export interface LocationsResult {
  locations: LocationOutput[];
  totalActiveUsers: number;
}
