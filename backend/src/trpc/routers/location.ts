import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { LocationInputSchema, LocationsResponseSchema, LocationSubmitResponseSchema } from "../schemas.js";

export const locationRouter = router({
  // GET /api/locations -> trpc.location.getAll.query()
  // Migrated from locationController.getLocations
  getAll: publicProcedure.output(LocationsResponseSchema).query(async ({ ctx }) => {
    try {
      const result = await ctx.locationService.getLocations();
      return {
        ...result,
        historicalTimespan: `${process.env.LOCATION_DISPLAY_HOURS || "4"} hours`,
        lastRefresh: Date.now(),
      };
    } catch (error) {
      console.error("Error in getLocations:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch locations",
      });
    }
  }),

  // POST /api/location -> trpc.location.submit.mutate()
  // Migrated from locationController.submitLocation
  submit: protectedProcedure
    .input(LocationInputSchema)
    .output(LocationSubmitResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate location data using service
        const validation = ctx.locationService.validateLocation(input);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error!,
          });
        }

        // Update location
        const result = await ctx.locationService.updateUserLocation(ctx.deviceId!, input);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to update location",
          });
        }

        // Broadcast via WebSocket (keeping existing functionality)
        ctx.socketHandler?.broadcastLocationUpdate(result.userId, input);

        return {
          success: true,
          userId: result.userId,
          message: "Location updated",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error in submitLocation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),
});

export type LocationRouter = typeof locationRouter;
