import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../trpc";
import type {
  LocationInput,
  LocationsResponse,
  LocationOutput,
} from "../types";
import { deviceIdService } from "../../services/deviceIdService";

export const useSubmitLocation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.location.submit.mutationOptions({
      onMutate: async (input) => {
        await queryClient.cancelQueries({
          queryKey: trpc.location.getAll.queryKey(),
        });

        const previous = queryClient.getQueryData<LocationsResponse>(
          trpc.location.getAll.queryKey(),
        );

        const optimistic: LocationOutput = {
          userId: deviceIdService.getDeviceId(),
          lat: input.lat,
          lng: input.lng,
          timestamp: input.timestamp,
          ageMinutes: 0,
        };

        const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
        const base: LocationsResponse = previous ?? {
          locations: [],
          totalActiveUsers: 0,
          historicalTimespan: "4 hours",
          lastRefresh: Date.now(),
        };

        const updatedLocations = [optimistic, ...base.locations].filter(
          (loc) => loc.timestamp >= fourHoursAgo,
        );
        const uniqueUsers = new Set(updatedLocations.map((loc) => loc.userId));

        queryClient.setQueryData<LocationsResponse>(
          trpc.location.getAll.queryKey(),
          {
            ...base,
            locations: updatedLocations,
            totalActiveUsers: uniqueUsers.size,
            lastRefresh: Date.now(),
          },
        );

        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.location.getAll.queryKey(),
            context.previous,
          );
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.location.getAll.queryKey(),
        });
      },
    }),
  );

  const submitLocation = async (lat: number, lng: number, accuracy: number) => {
    const locationInput: LocationInput = {
      lat,
      lng,
      accuracy,
      timestamp: Date.now(),
    };

    return await mutation.mutateAsync(locationInput);
  };

  return {
    submitLocation,
    isPending: mutation.isPending,
    error: mutation.error?.message || null,
  };
};
