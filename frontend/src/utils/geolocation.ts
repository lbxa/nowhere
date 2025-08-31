import type { GeolocationPosition } from "../api/types";

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
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

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000, // Accept cached position up to 30 seconds old
};

/**
 * Get current position with improved error handling
 */
export const getCurrentPosition = (
  options: GeolocationOptions = DEFAULT_OPTIONS,
): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: "Geolocation is not supported by this browser",
        type: "not_supported",
      } as GeolocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      (error) => {
        let errorType: GeolocationError["type"];
        let message: string;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorType = "permission_denied";
            message = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorType = "position_unavailable";
            message = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            errorType = "timeout";
            message = "Location request timed out";
            break;
          default:
            errorType = "position_unavailable";
            message = "An unknown error occurred while retrieving location";
        }

        reject({
          code: error.code,
          message,
          type: errorType,
        } as GeolocationError);
      },
      options,
    );
  });
};

/**
 * Watch position with callback
 */
export const watchPosition = (
  callback: (position: GeolocationPosition) => void,
  errorCallback: (error: GeolocationError) => void,
  options: GeolocationOptions = DEFAULT_OPTIONS,
): number | null => {
  if (!navigator.geolocation) {
    errorCallback({
      code: 0,
      message: "Geolocation is not supported by this browser",
      type: "not_supported",
    });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
      });
    },
    (error) => {
      let errorType: GeolocationError["type"];
      let message: string;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorType = "permission_denied";
          message = "Location access denied by user";
          break;
        case error.POSITION_UNAVAILABLE:
          errorType = "position_unavailable";
          message = "Location information is unavailable";
          break;
        case error.TIMEOUT:
          errorType = "timeout";
          message = "Location request timed out";
          break;
        default:
          errorType = "position_unavailable";
          message = "An unknown error occurred while retrieving location";
      }

      errorCallback({
        code: error.code,
        message,
        type: errorType,
      });
    },
    options,
  );
};

/**
 * Clear position watch
 */
export const clearWatch = (watchId: number): void => {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};

/**
 * Check if geolocation is supported and permission is granted
 */
export const checkGeolocationSupport = async (): Promise<{
  supported: boolean;
  permission: "granted" | "denied" | "prompt" | "unknown";
}> => {
  if (!navigator.geolocation) {
    return { supported: false, permission: "unknown" };
  }

  try {
    // Check if permissions API is available
    if ("permissions" in navigator) {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });
      return { supported: true, permission: permission.state as any };
    } else {
      // Fallback: try to get position to check permission
      try {
        await getCurrentPosition({ ...DEFAULT_OPTIONS, timeout: 1000 });
        return { supported: true, permission: "granted" };
      } catch (error) {
        const geoError = error as GeolocationError;
        if (geoError.type === "permission_denied") {
          return { supported: true, permission: "denied" };
        }
        return { supported: true, permission: "prompt" };
      }
    }
  } catch {
    return { supported: true, permission: "unknown" };
  }
};

/**
 * Request location permission
 */
export const requestLocationPermission =
  async (): Promise<GeolocationPosition> => {
    return await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // Force fresh position for permission request
    });
  };
