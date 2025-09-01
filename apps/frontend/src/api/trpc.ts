import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { deviceIdService } from "../services/deviceIdService";
import type { AppRouter } from "@nowhere/backend";

// Get API URL from environment with fallback
const getApiUrl = () => {
  const origin = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000";
  return `${origin}/trpc`;
};

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: getApiUrl(),
      headers() {
        return {
          "X-Device-ID": deviceIdService.getDeviceId(),
        };
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
