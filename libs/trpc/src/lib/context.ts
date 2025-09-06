import type { Request, Response } from "express";

export type TrpcContextService<TLocationService, TSocketHandler = never> = {
  locationService: TLocationService;
} & (TSocketHandler extends never ? {} : { socketHandler: TSocketHandler });

export type TRPCContext<TServices extends object = {}> = {
  req: Request;
  res: Response;
  deviceId?: string;
} & TServices;

export function createContext<TServices extends object>(services: TServices) {
  return ({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): TRPCContext<TServices> => {
    const header = req.headers["x-device-id"];
    const deviceId = Array.isArray(header) ? header[0] : header;

    return {
      req,
      res,
      deviceId,
      ...services,
    };
  };
}
