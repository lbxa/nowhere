import { router } from "../trpc.js";
import { locationRouter } from "./location.js";
import { healthRouter } from "./health.js";

export const appRouter = router({
  location: locationRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
