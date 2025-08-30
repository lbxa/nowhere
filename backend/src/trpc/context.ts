import type { Request, Response } from "express";
import type LocationService from "@/services/locationService.js";
import type SocketHandler from "@/websocket/socketHandler.js";

export interface TRPCContext {
  req: Request;
  res: Response;
  locationService: LocationService;
  socketHandler?: SocketHandler;
  deviceId?: string;
}

export function createContext(locationService: LocationService, socketHandler?: SocketHandler) {
  return ({ req, res }: { req: Request; res: Response }): TRPCContext => {
    const deviceId = req.headers["x-device-id"] as string;

    return {
      req,
      res,
      locationService,
      socketHandler,
      deviceId,
    };
  };
}
