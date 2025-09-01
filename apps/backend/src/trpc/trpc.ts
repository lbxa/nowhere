import type { TRPCContext, TrpcContextService } from "@nowhere/trpc";
import { createTrpcFactory } from "@nowhere/trpc";
import type { LocationService } from "../services/locationService";
import type SocketHandler from "../ws/socketHandler";

export type Services = TrpcContextService<LocationService, SocketHandler>;
export type AppCtx = TRPCContext<Services>;

export const { t, createTRPCRouter, publicProcedure } =
  createTrpcFactory<AppCtx>();

export const requireDeviceId = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.deviceId) {
    throw new Error("X-Device-ID header is required");
  }
  return next();
});

export const protectedProcedure = publicProcedure.use(requireDeviceId);
