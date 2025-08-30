import { createClient, type RedisClientType } from "redis";
import type {
  LocationInput,
  LocationRecord,
  LocationOutput,
  LocationValidationResult,
  LocationUpdateResult,
  LocationsResult,
} from "@/types";

export class LocationService {
  private redis: RedisClientType;
  private isConnected = false;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    this.redis.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    this.redis.on("connect", () => {
      console.log("Connected to Redis");
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.redis.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Calculate age in minutes from timestamp
   */
  calculateAgeMinutes(timestamp: number): number {
    return Math.floor((Date.now() - timestamp) / (1000 * 60));
  }

  /**
   * Generate anonymous user ID from device ID
   */
  generateAnonymousUserId(deviceId: string): string {
    // Create a consistent anonymous ID based on device ID
    // This maintains user identity across sessions while keeping it anonymous in API responses
    const crypto = require("crypto");
    return `user-${crypto.createHash("sha256").update(deviceId).digest("hex").substring(0, 8)}`;
  }

  /**
   * Validate location data
   */
  validateLocation(locationData: LocationInput): LocationValidationResult {
    const { lat, lng, accuracy, timestamp } = locationData;

    // Validate latitude
    if (lat < -90 || lat > 90) {
      return { valid: false, error: "Invalid latitude" };
    }

    // Validate longitude
    if (lng < -180 || lng > 180) {
      return { valid: false, error: "Invalid longitude" };
    }

    // Validate accuracy (must be <= 50 meters)
    const maxAccuracy = parseInt(process.env.MAX_ACCURACY || "50");
    if (accuracy > maxAccuracy) {
      return { valid: false, error: `Location too inaccurate: ${accuracy}m exceeds maximum ${maxAccuracy}m` };
    }

    // Validate timestamp (must be within last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (timestamp < fiveMinutesAgo) {
      return { valid: false, error: "Timestamp too old" };
    }

    return { valid: true };
  }

  /**
   * Store individual user location in Redis
   */
  async updateUserLocation(deviceId: string, locationData: LocationInput): Promise<LocationUpdateResult> {
    try {
      const { lat, lng, accuracy, timestamp } = locationData;
      const userId = this.generateAnonymousUserId(deviceId);

      // Create stored location data with anonymous user ID
      const storedLocation: LocationRecord = {
        userId,
        lat,
        lng,
        accuracy,
        timestamp,
      };

      // Store individual location record
      const locationKey = `location:${deviceId}:${timestamp}`;
      await this.redis.set(locationKey, JSON.stringify(storedLocation));

      // Add to user's location history (sorted set for efficient time-range queries)
      const userLocationHistoryKey = `user:${deviceId}:locations`;
      await this.redis.zAdd(userLocationHistoryKey, { score: timestamp, value: locationKey });

      // Keep only recent locations in sorted set (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      await this.redis.zRemRangeByScore(userLocationHistoryKey, 0, oneDayAgo);

      return { success: true, userId };
    } catch (error) {
      console.error("Error updating user location:", error);
      return { success: false, userId: "", error: "Failed to update location" };
    }
  }

  /**
   * Get all individual location dots from the last N hours (default: 4 hours)
   */
  async getLocations(): Promise<LocationsResult> {
    try {
      const displayHours = parseInt(process.env.LOCATION_DISPLAY_HOURS || "4");
      const timeThreshold = Date.now() - displayHours * 60 * 60 * 1000;

      // Get all individual location keys
      const locationKeys = await this.redis.keys("location:*:*");
      const locations: LocationOutput[] = [];
      const uniqueUsers = new Set<string>();

      for (const key of locationKeys) {
        const locationData = await this.redis.get(key);
        if (locationData) {
          const parsedData: LocationRecord = JSON.parse(locationData);

          // Only include locations from the last N hours
          if (parsedData.timestamp >= timeThreshold) {
            const ageMinutes = this.calculateAgeMinutes(parsedData.timestamp);

            locations.push({
              userId: parsedData.userId,
              lat: parsedData.lat,
              lng: parsedData.lng,
              timestamp: parsedData.timestamp,
              ageMinutes,
            });

            uniqueUsers.add(parsedData.userId);
          }
        }
      }

      return {
        locations,
        totalActiveUsers: uniqueUsers.size,
      };
    } catch (error) {
      console.error("Error getting locations:", error);
      return { locations: [], totalActiveUsers: 0 };
    }
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<any> {
    try {
      const { locations, totalActiveUsers } = await this.getLocations();
      const allLocationKeys = await this.redis.keys("location:*:*");

      // Calculate coverage bounds
      let north = -90,
        south = 90,
        east = -180,
        west = 180;

      for (const location of locations) {
        north = Math.max(north, location.lat);
        south = Math.min(south, location.lat);
        east = Math.max(east, location.lng);
        west = Math.min(west, location.lng);
      }

      // Get oldest entry from all stored locations
      let oldestEntry = Date.now();
      for (const key of allLocationKeys) {
        const locationData = await this.redis.get(key);
        if (locationData) {
          const parsedData: LocationRecord = JSON.parse(locationData);
          oldestEntry = Math.min(oldestEntry, parsedData.timestamp);
        }
      }

      return {
        activeUsers: totalActiveUsers,
        activeLocations: locations.length,
        totalStoredLocations: allLocationKeys.length,
        coverage: {
          city: "Unknown", // Could be enhanced with reverse geocoding
          bounds: {
            north,
            south,
            east,
            west,
          },
        },
        dataRetention: {
          displayWindow: `${process.env.LOCATION_DISPLAY_HOURS || "4"} hours`,
          totalDataStored: "persistent",
          oldestEntry: oldestEntry === Date.now() ? null : oldestEntry,
        },
        lastUpdate: Date.now(),
        uptime: process.uptime(),
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      throw error;
    }
  }
}

export default LocationService;
