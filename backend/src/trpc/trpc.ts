import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { validate as uuidValidate } from "uuid";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware for device ID validation
export const requireDeviceId = t.middleware(async ({ ctx, next }) => {
  if (!ctx.deviceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "X-Device-ID header is required",
    });
  }

  // Validate UUID format
  if (!uuidValidate(ctx.deviceId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "X-Device-ID must be a valid UUID",
    });
  }

  return next({
    ctx: {
      ...ctx,
      deviceId: ctx.deviceId,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireDeviceId);
