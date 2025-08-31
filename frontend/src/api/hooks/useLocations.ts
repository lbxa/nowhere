import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { trpc } from "../trpc";
import type {
  LocationsResponse,
  LocationPoint,
  LocationOutput,
} from "../types";

export const useLocations = () => {
  const queryClient = useQueryClient();

  // Use React Query with tRPC for data fetching
  const {
    data,
    isLoading,
    error,
    refetch: refetchQuery,
    isFetching: isRefetching,
  } = useQuery(trpc.location.getAll.queryOptions());

  /**
   * Refetch locations - wrapping React Query's refetch for consistency
   */
  const refetch = useCallback(async () => {
    const result = await refetchQuery();
    return result;
  }, [refetchQuery]);

  /**
   * Convert locations to timeline format for existing map visualization
   */
  const getTimelineLocations = useCallback((): LocationPoint[] => {
    if (!data?.locations) return [];

    return data.locations.map((location: LocationOutput) => ({
      id: `${location.userId}-${location.timestamp}`,
      timestamp: Math.floor(location.timestamp / 1000), // Convert to seconds for timeline
      lat: location.lat,
      lng: location.lng,
      userId: location.userId,
      ageMinutes: location.ageMinutes,
    }));
  }, [data?.locations]);

  /**
   * Add new location from WebSocket update using React Query cache
   */
  const addLocationUpdate = useCallback(
    (newLocation: {
      userId: string;
      lat: number;
      lng: number;
      timestamp: number;
      ageMinutes: number;
    }) => {
      queryClient.setQueryData(
        trpc.location.getAll.queryKey(),
        (prevData: LocationsResponse | undefined) => {
          if (!prevData) return prevData;

          // Check if duplicate location already exists (avoid duplicates)
          const exists = prevData.locations.some(
            (loc) =>
              loc.userId === newLocation.userId &&
              Math.abs(loc.timestamp - newLocation.timestamp) < 5000, // Within 5 seconds
          );

          if (exists) return prevData;

          // Add new location to the beginning of the array
          const updatedLocations = [newLocation, ...prevData.locations];

          // Remove locations older than the display window (4 hours default)
          const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
          const filteredLocations = updatedLocations.filter(
            (loc) => loc.timestamp >= fourHoursAgo,
          );

          // Update user count
          const uniqueUsers = new Set(
            filteredLocations.map((loc) => loc.userId),
          );

          return {
            ...prevData,
            locations: filteredLocations,
            totalActiveUsers: uniqueUsers.size,
            lastRefresh: Date.now(),
          };
        },
      );
    },
    [queryClient],
  );

  /**
   * Get locations within a time range
   */
  const getLocationsByTimeRange = useCallback(
    (startTime: number, endTime: number): LocationPoint[] => {
      const timelineLocations = getTimelineLocations();
      return timelineLocations.filter(
        (location) =>
          location.timestamp >= startTime && location.timestamp <= endTime,
      );
    },
    [getTimelineLocations],
  );

  /**
   * Get all unique users
   */
  const getUniqueUsers = useCallback((): string[] => {
    if (!data?.locations) return [];
    const users = new Set(
      data.locations.map((loc: LocationOutput) => loc.userId),
    );
    return Array.from(users) as string[];
  }, [data?.locations]);

  return {
    // React Query interface
    data,
    isLoading,
    error: error?.message || null,
    isError: !!error,
    isRefetching,
    refetch,

    // Data accessors
    locations: data?.locations || [],
    totalActiveUsers: data?.totalActiveUsers || 0,
    historicalTimespan: data?.historicalTimespan || "",
    lastRefresh: data?.lastRefresh,

    // Helper functions
    getTimelineLocations,
    addLocationUpdate,
    getLocationsByTimeRange,
    getUniqueUsers,
  };
};
