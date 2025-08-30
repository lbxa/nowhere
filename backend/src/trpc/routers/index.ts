import { router } from "../trpc";
import { locationRouter } from "./location";
import { healthRouter } from "./health";

export const appRouter = router({
  location: locationRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
