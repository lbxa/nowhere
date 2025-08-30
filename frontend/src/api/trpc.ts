import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { deviceIdService } from "../services/deviceIdService";
import type { AppRouter } from "../../../backend/src/trpc/appRouter";

// Get API URL from environment with fallback
const getApiUrl = () => {
  const origin =
    import.meta.env.VITE_API_ORIGIN ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000";
  const path = import.meta.env.VITE_TRPC_PATH || "/trpc";
  return `${origin}${path}`;
};

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getApiUrl(),
      headers() {
        return {
          "X-Device-ID": deviceIdService.getDeviceId(),
          "Content-Type": "application/json",
        };
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
