import { createTRPCRouter, publicProcedure } from "../trpc";
import { HealthCheckResponseSchema, StatsResponseSchema } from "@nowhere/trpc";

export const healthRouter = createTRPCRouter({
  check: publicProcedure.output(HealthCheckResponseSchema).query(async () => {
    try {
      return {
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        error: "Health check failed",
      };
    }
  }),

  stats: publicProcedure.output(StatsResponseSchema).query(async ({ ctx }) => {
    try {
      return await ctx.locationService.getStats();
    } catch (error) {
      throw new Error("Failed to fetch statistics");
    }
  }),
});

export type HealthRouter = typeof healthRouter;
