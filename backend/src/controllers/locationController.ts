import type { Request, Response } from "express";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import LocationService from "@/services/locationService.js";
import type { LocationInput } from "@/types/index.js";

export class LocationController {
  private locationService: LocationService;

  constructor(locationService: LocationService) {
    this.locationService = locationService;
  }

  /**
   * POST /api/location - Submit User Location
   */
  async submitLocation(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lng, accuracy, timestamp } = req.body as LocationInput;
      const deviceId = req.headers["x-device-id"] as string;

      // Validate device ID
      if (!deviceId || !uuidValidate(deviceId)) {
        res.status(400).json({
          success: false,
          error: "invalid_device_id",
          message: "X-Device-ID header must be a valid UUID",
        });
        return;
      }

      // Validate required fields
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        typeof accuracy !== "number" ||
        typeof timestamp !== "number"
      ) {
        res.status(400).json({
          success: false,
          error: "invalid_request",
          message: "Missing or invalid required fields: lat, lng, accuracy, timestamp",
        });
        return;
      }

      const locationData: LocationInput = { lat, lng, accuracy, timestamp };

      // Validate location data
      const validation = this.locationService.validateLocation(locationData);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: "location_validation_failed",
          message: validation.error,
          accuracy: accuracy,
        });
        return;
      }

      // Update location in service
      const result = await this.locationService.updateUserLocation(deviceId, locationData);

      if (result.success) {
        res.json({
          success: true,
          userId: result.userId,
          message: "Location updated",
        });

        // Broadcast new location to WebSocket clients (will be handled by socket handler)
        req.app.locals.socketHandler?.broadcastLocationUpdate(result.userId, locationData);
      } else {
        res.status(500).json({
          success: false,
          error: "update_failed",
          message: result.error || "Failed to update location",
        });
      }
    } catch (error) {
      console.error("Error in submitLocation:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Internal server error",
      });
    }
  }

  /**
   * GET /api/locations - Get All Active Locations
   */
  async getLocations(req: Request, res: Response): Promise<void> {
    try {
      const { locations, totalActiveUsers } = await this.locationService.getLocations();

      res.json({
        locations,
        totalActiveUsers,
        historicalTimespan: `${process.env.LOCATION_DISPLAY_HOURS || "4"} hours`,
        lastRefresh: Date.now(),
      });
    } catch (error) {
      console.error("Error in getLocations:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Failed to fetch locations",
      });
    }
  }

  /**
   * GET /api/stats - System Statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.locationService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error in getStats:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Failed to fetch statistics",
      });
    }
  }

  /**
   * GET /api/health - Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Simple health check - could be expanded with Redis connectivity check
      res.json({
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      console.error("Error in healthCheck:", error);
      res.status(500).json({
        status: "unhealthy",
        error: "Health check failed",
      });
    }
  }
}

export default LocationController;
