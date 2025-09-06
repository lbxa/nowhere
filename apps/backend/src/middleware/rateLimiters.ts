import rateLimit from "express-rate-limit";

/**
 * Rate limiter for location updates
 * Limits to 1 request per 30 seconds per device
 */
export const locationUpdateLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1, // 1 request per 30 seconds per device (based on IP)
  message: {
    success: false,
    error: "rate_limited",
    message: "Location updates limited to once every 30 seconds",
    retryAfter: 30,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use device ID for rate limiting instead of IP when available
  keyGenerator: (req) => {
    const deviceId = req.headers["x-device-id"] as string;
    return deviceId || req.ip || "unknown";
  },
});

/**
 * General API rate limiter
 * Limits to 100 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"), // 100 requests per minute per IP
  message: {
    success: false,
    error: "rate_limited",
    message: "Too many requests. Try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
