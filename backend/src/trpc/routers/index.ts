import { createTRPCRouter } from "../trpc";
import { locationRouter } from "./location";
import { healthRouter } from "./health";

export const appRouter = createTRPCRouter({
  location: locationRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
