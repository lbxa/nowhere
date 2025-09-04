import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { LocationInputSchema, LocationsResponseSchema, LocationSubmitResponseSchema } from "@nowhere/trpc";

export const locationRouter = createTRPCRouter({
  getAll: publicProcedure.output(LocationsResponseSchema).query(async ({ ctx }) => {
    try {
      const result = await ctx.locationService.getLocations();
      return {
        ...result,
        historicalTimespan: `${process.env.LOCATION_DISPLAY_HOURS || "24"} hours`,
        lastRefresh: Date.now(),
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch locations",
      });
    }
  }),

  submit: protectedProcedure
    .input(LocationInputSchema)
    .output(LocationSubmitResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const validation = ctx.locationService.validateLocation(input);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error!,
          });
        }

        const result = await ctx.locationService.updateUserLocation(ctx.deviceId!, input);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to update location",
          });
        }

        return {
          success: true,
          userId: result.userId,
          message: "Location updated",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),
});

export type LocationRouter = typeof locationRouter;
