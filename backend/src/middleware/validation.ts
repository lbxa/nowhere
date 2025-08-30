import type express from "express";
import { validate as uuidValidate } from "uuid";
import type { ValidationMiddleware } from "../types/index.js";

/**
 * Middleware to validate JSON content type for POST requests
 */
export const validateJsonContentType: ValidationMiddleware = (req, res, next) => {
  if (req.method === "POST" && req.headers["content-type"] !== "application/json") {
    res.status(400).json({
      success: false,
      error: "invalid_content_type",
      message: "Content-Type must be application/json",
    });
    return;
  }
  next();
};

/**
 * Middleware to validate device ID header
 */
export const validateDeviceId: ValidationMiddleware = (req, res, next) => {
  const deviceId = req.headers["x-device-id"] as string;

  if (!deviceId || !uuidValidate(deviceId)) {
    res.status(400).json({
      success: false,
      error: "invalid_device_id",
      message: "X-Device-ID header must be a valid UUID",
    });
    return;
  }
  next();
};
