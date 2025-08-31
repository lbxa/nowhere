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

  // Shared helper to fetch geolocation and submit to backend
  const performLocationSubmit = useCallback(
    async (markSubmitted: boolean) => {
      setState((prev) => ({
        ...prev,
        isSubmittingLocation: true,
        locationError: null,
      }));

      try {
        if (!navigator.geolocation) {
          throw new Error("Geolocation is not supported by this browser");
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000, // Accept position up to 1 minute old
            });
          },
        );

        await submitLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
        );

        setState((prev) => ({
          ...prev,
          hasSubmitted: markSubmitted ? true : prev.hasSubmitted,
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
    },
    [submitLocation],
  );

  // Get and submit user's location on app start
  const initializeLocation = useCallback(async () => {
    if (state.hasSubmitted || state.isSubmittingLocation) return;
    await performLocationSubmit(true);
  }, [state.hasSubmitted, state.isSubmittingLocation, performLocationSubmit]);

  // Periodic submission every 1 minute (does not gate on hasSubmitted)
  const submitLocationTick = useCallback(async () => {
    if (state.isSubmittingLocation || isPending) return;
    await performLocationSubmit(false);
  }, [state.isSubmittingLocation, isPending, performLocationSubmit]);

  // Auto-initialize once when component mounts (avoid re-running on state changes)
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    void initializeLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start periodic submissions every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      void submitLocationTick();
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [submitLocationTick]);

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
