import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { HealthCheckResponseSchema, StatsResponseSchema } from "../schemas";

export const healthRouter = router({
  // Health check endpoint - migrated from locationController.healthCheck
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

  // Stats endpoint - migrated from locationController.getStats
  stats: publicProcedure.output(StatsResponseSchema).query(async ({ ctx }) => {
    try {
      return await ctx.locationService.getStats();
    } catch (error) {
      console.error("Error in getStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch statistics",
      });
    }
  }),
});

export type HealthRouter = typeof healthRouter;
