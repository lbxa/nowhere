import { useMutation } from "@tanstack/react-query";
import { trpc } from "../trpc";
import type { LocationInput } from "../types";

export const useSubmitLocation = () => {
  // const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.location.submit.mutationOptions({
      onSuccess: () => {
        // Invalidate locations to refresh the data
        // queryClient.invalidateQueries({
        //   queryKey: trpc.location.getAll.queryKey(),
        // });
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
