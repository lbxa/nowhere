import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import LocationService from "./services/locationService.js";
import SocketHandler from "./websocket/socketHandler.js";
import { appRouter } from "./trpc/appRouter.js";
import { createContext } from "./trpc/context.js";
import { locationUpdateLimiter, apiLimiter } from "./middleware/rateLimiters.js";

// Load environment variables
const PORT = parseInt(process.env.PORT || "3000");
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Configure CORS
const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID"],
};

// Security and middleware setup
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Required for PWA
    contentSecurityPolicy: NODE_ENV === "production" ? undefined : false, // Disable in development
  })
);

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for rate limiting (if behind reverse proxy)
app.set("trust proxy", 1);

// Initialize LocationService
const locationService = new LocationService();
locationService.connect().catch(console.error);

// Initialize Socket.io handler
const socketHandler = new SocketHandler(httpServer, locationService);

// Make socketHandler available for broadcasting
app.locals.socketHandler = socketHandler;

// tRPC API - Primary API endpoint with Express middleware integration
app.use(
  "/trpc",
  apiLimiter, // Apply general rate limiting to all tRPC calls
  createExpressMiddleware({
    router: appRouter,
    createContext: createContext(locationService, socketHandler),
  })
);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Real-time Location Sharing API",
    version: "1.0.0",
    environment: NODE_ENV,
    endpoints: {
      "tRPC API": "Type-safe tRPC API endpoints",
      "WebSocket /api/live": "Real-time location updates",
    },
    availableEndpoints: {
      "POST /trpc/health.check": "Health check",
      "POST /trpc/location.getAll": "Get all active locations",
      "POST /trpc/health.stats": "Get system statistics",
      "POST /trpc/location.submit": "Submit user location (requires X-Device-ID header)",
    },
    trpcUsage: {
      health: "trpc.health.check.query()",
      locations: "trpc.location.getAll.query()",
      stats: "trpc.health.stats.query()",
      submit: "trpc.location.submit.mutate(data)",
    },
    documentation: "See README.md for full API documentation",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "not_found",
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", error);

  // Don't send error details in production
  const message = NODE_ENV === "production" ? "Internal server error" : error.message || "Something went wrong";

  res.status(error.status || 500).json({
    success: false,
    error: "internal_error",
    message,
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log("HTTP server closed");
        resolve();
      });
    });

    // Shutdown socket handler
    await socketHandler.shutdown();

    // Disconnect from Redis
    await locationService.disconnect();
    console.log("Redis disconnected");

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Location sharing server running on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 CORS Origin: ${CORS_ORIGIN}`);
  console.log(`⚡ WebSocket endpoint: ws://localhost:${PORT}/api/live`);
  console.log(`🔗 tRPC API Documentation: http://localhost:${PORT}`);

  if (NODE_ENV === "development") {
    console.log(`\n📋 Quick test commands:`);
    console.log(`   Health check: curl "http://localhost:${PORT}/trpc/health.check"`);
    console.log(`   Get stats: curl "http://localhost:${PORT}/trpc/health.stats"`);
    console.log(`   Get locations: curl "http://localhost:${PORT}/trpc/location.getAll"`);
    console.log(`   tRPC API root: http://localhost:${PORT}/trpc`);
  }
});

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

export { app, httpServer, socketHandler };
