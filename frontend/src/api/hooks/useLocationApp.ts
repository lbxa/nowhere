import { useEffect, useState, useCallback, useRef } from "react";
import { useLocations } from "./useLocations";
import { useWebSocket } from "./useWebSocket";
import { useSubmitLocation } from "./useSubmitLocation";

interface LocationState {
  hasSubmitted: boolean;
  isSubmittingLocation: boolean;
  locationError: string | null;
  permissionDenied: boolean;
}

export const useLocationApp = () => {
  const [state, setState] = useState<LocationState>({
    hasSubmitted: false,
    isSubmittingLocation: false,
    locationError: null,
    permissionDenied: false,
  });
  const initCalledRef = useRef(false);

  // Use existing hooks
  const { data: locations, isLoading } = useLocations();
  const { isConnected } = useWebSocket();
  const { submitLocation, isPending, error } = useSubmitLocation();

  // Get and submit user's location on app start
  const initializeLocation = useCallback(async () => {
    if (state.hasSubmitted || state.isSubmittingLocation) return;

    setState((prev) => ({
      ...prev,
      isSubmittingLocation: true,
      locationError: null,
    }));

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser");
      }

      // Get current position
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000, // Accept position up to 1 minute old
          });
        },
      );

      // Submit location to backend
      await submitLocation(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
      );

      setState((prev) => ({
        ...prev,
        hasSubmitted: true,
        isSubmittingLocation: false,
      }));
    } catch (error) {
      let errorMessage = "Failed to get location";
      let permissionDenied = false;

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location access.";
            permissionDenied = true;
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setState((prev) => ({
        ...prev,
        isSubmittingLocation: false,
        locationError: errorMessage,
        permissionDenied,
      }));
    }
  }, [state.hasSubmitted, state.isSubmittingLocation, submitLocation]);

  // Auto-initialize once when component mounts (avoid re-running on state changes)
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    void initializeLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry location submission
  const retryLocationSubmission = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasSubmitted: false,
      locationError: null,
      permissionDenied: false,
    }));
    void initializeLocation();
  }, [initializeLocation]);

  return {
    // Location data from backend
    locations: locations?.locations || [],
    isLoadingLocations: isLoading,

    // WebSocket connection status
    isConnected,

    // Location submission status
    hasSubmittedLocation: state.hasSubmitted,
    isSubmittingLocation: state.isSubmittingLocation || isPending,
    locationError: state.locationError || error,
    permissionDenied: state.permissionDenied,

    // Actions
    retryLocationSubmission,

    // Helper for getting timeline data (used by map component)
    getTimelineLocations: () => locations?.locations || [],
  };
};
