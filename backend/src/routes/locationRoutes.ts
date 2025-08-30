import express, { Router } from "express";
import LocationController from "@/controllers/locationController.js";
import LocationService from "@/services/locationService.js";
import { locationUpdateLimiter, apiLimiter } from "@/middleware/rateLimiters.js";
import { validateJsonContentType } from "@/middleware/validation.js";

const router = Router();

// Initialize service and controller
const locationService = new LocationService();
const locationController = new LocationController(locationService);

// Connect to Redis when routes are initialized
locationService.connect().catch(console.error);

// Health check endpoint (no rate limiting)
router.get("/health", locationController.healthCheck.bind(locationController));

// Main API endpoints with rate limiting
router.post(
  "/location",
  locationUpdateLimiter,
  validateJsonContentType,
  locationController.submitLocation.bind(locationController)
);

router.get("/locations", apiLimiter, locationController.getLocations.bind(locationController));

router.get("/stats", apiLimiter, locationController.getStats.bind(locationController));

// Export both router and service for use in main app
export { router, locationService };
export default router;
