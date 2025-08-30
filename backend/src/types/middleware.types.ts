import type { Request, Response, NextFunction } from "express";

export type ValidationMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: {
    success: boolean;
    error: string;
    message: string;
    retryAfter: number;
  };
  standardHeaders: boolean;
  legacyHeaders: boolean;
  keyGenerator?: (req: Request) => string;
}
