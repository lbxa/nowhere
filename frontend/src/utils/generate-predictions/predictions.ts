/**
 * Bondi Lines API Client - Optimized for Bun Runtime with Auto Token Refresh
 *
 * Features:
 * - Automatic token refresh on 401 errors
 * - Token persistence in auth.json file
 * - Built-in timeout support with AbortController
 * - Automatic compression handling (Bun native)
 * - TypeScript support out of the box
 * - Efficient parallel request handling
 *
 * Usage: bun run bondi-api-client.ts
 */

import { DateTime } from "luxon"; // You'll need to install: bun add luxon @types/luxon
import * as fs from "fs";
import * as path from "path";

interface FeedQueryParams {
  cityId: string;
  page: number;
  size: number;
  sortBy: string;
  categories: string;
}

interface ApiHeaders {
  host?: string;
  accept?: string;
  contentType?: string;
  userAgent?: string;
  acceptLanguage?: string;
  authorization?: string;
  [key: string]: string | undefined;
}

interface ApiConfig {
  baseUrl: string;
  headers: ApiHeaders;
  timeout?: number;
}

interface AuthResponse {
  kind: string;
  localId: string;
  email: string;
  displayName: string;
  idToken: string;
  registered: boolean;
  refreshToken: string;
  expiresIn: string;
}

interface AuthData {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
}

// Raw JSON string response type
type JsonString = string;

class BondiLinesApiClient {
  private config: ApiConfig;
  private authFilePath: string;
  private maxRetries: number = 2;

  constructor(config: Partial<ApiConfig> = {}) {
    this.authFilePath = path.join(process.cwd(), "auth.json");

    // Load token from auth.json if it exists
    const authToken = this.loadAuthToken();

    this.config = {
      baseUrl: config.baseUrl || "https://api.bondilinesapp.com",
      timeout: config.timeout || 10000, // 10 seconds default timeout
      headers: {
        host: "api.bondilinesapp.com",
        accept: "application/json",
        contentType: "application/json",
        userAgent: "Lines/430 CFNetwork/3826.600.41 Darwin/24.6.0",
        acceptLanguage: "en-AU,en;q=0.9",
        authorization: authToken ? `Bearer ${authToken}` : undefined,
        ...config.headers,
      },
    };
  }

  // Load auth token from file
  private loadAuthToken(): string | null {
    try {
      if (fs.existsSync(this.authFilePath)) {
        const authData: AuthData = JSON.parse(
          fs.readFileSync(this.authFilePath, "utf-8"),
        );

        // Check if token is expired
        if (authData.expiresAt) {
          const expiresAt = new Date(authData.expiresAt);
          const now = new Date();
          if (expiresAt <= now) {
            console.log("Token expired, will refresh on next request");
            return null;
          }
        }

        return authData.token;
      }
    } catch (error) {
      console.error("Error loading auth token:", error);
    }
    return null;
  }

  // Save auth token to file
  private saveAuthToken(
    token: string,
    expiresIn?: string,
    refreshToken?: string,
  ): void {
    try {
      const authData: AuthData = {
        token,
        refreshToken,
      };

      // Calculate expiration time if provided
      if (expiresIn) {
        const expiresInSeconds = parseInt(expiresIn);
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
        authData.expiresAt = expiresAt.toISOString();
      }

      fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2));
      console.log("Auth token saved to auth.json");
    } catch (error) {
      console.error("Error saving auth token:", error);
    }
  }

  // Refresh authentication token
  private async refreshAuthToken(): Promise<string> {
    console.log("Refreshing authentication token...");

    const authUrl =
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD_Bwm02299rbe9Xab4ufyux3fHI2hYxKE";

    const requestBody = {
      returnSecureToken: true,
      email: "fasisol266@noidem.com",
      password: "Abc12345!",
      clientType: "CLIENT_TYPE_WEB",
    };

    const headers = {
      Host: "identitytoolkit.googleapis.com",
      "Content-Type": "application/json",
      "x-firebase-client":
        "eyJ2ZXJzaW9uIjoyLCJoZWFydGJlYXRzIjpbeyJhZ2VudCI6ImZpcmUtY29yZS1ub2RlLzAuMTMuMiBmaXJlLWNvcmUtY2pzMjAxNy8wLjEzLjIgZmlyZS1qcy8gZmlyZS1mc3Qtcm4vNC44LjAgZmlyZS1mc3QtZXNtMjAxNy80LjguMCBmaXJlLWpzLWFsbC1hcHAvMTEuMTAuMCBmaXJlLWF1dGgtcm4vMS4xMC44IGZpcmUtYXV0aC1janMyMDE3LzEuMTAuOCBmaXJlLWZuLzAuMTIuOSBmaXJlLWZuLWVzbTIwMTcvMC4xMi45IGZpcmUtZ2NzLzAuMTMuMTQgZmlyZS1nY3MtZXNtMjAxNy8wLjEzLjE0IiwiZGF0ZXMiOlsiMjAyNS0wOC0zMCJdfV19",
      Accept: "*/*",
      "x-client-version": "ReactNative/JsCore/11.10.0/FirebaseCore-web",
      baggage:
        "sentry-environment=production,sentry-public_key=0641964d77fad01d81994143894f2698,sentry-trace_id=10a90158ae524c1db184de929cdb1ca4,sentry-org_id=4507486973198336",
      "Accept-Language": "en-AU,en;q=0.9",
      "sentry-trace": "10a90158ae524c1db184de929cdb1ca4-a5f0ede30aae8488",
      "User-Agent": "Lines/430 CFNetwork/3826.600.41 Darwin/24.6.0",
      "x-firebase-gmpid": "app-id",
    };

    try {
      const response = await fetch(authUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `Auth refresh failed: ${response.status} - ${response.statusText}`,
        );
      }

      const authData = (await response.json()) as AuthResponse;

      // Save the new token
      this.saveAuthToken(
        authData.idToken,
        authData.expiresIn,
        authData.refreshToken,
      );

      // Update the config with new token
      this.config.headers.authorization = `Bearer ${authData.idToken}`;

      console.log("Authentication token refreshed successfully");
      return authData.idToken;
    } catch (error) {
      console.error("Error refreshing auth token:", error);
      throw error;
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      headers: {
        ...this.config.headers,
        ...newConfig.headers,
      },
    };
  }

  // Set authorization token
  setAuthToken(token: string): void {
    this.config.headers.authorization = `Bearer ${token}`;
    this.saveAuthToken(token);
  }

  // Bun-specific: Save response data to file (leveraging Bun's fast file I/O)
  async saveResponseToFile(
    jsonString: string,
    filename: string,
  ): Promise<void> {
    try {
      await Bun.write(filename, jsonString);
      console.log(`Response saved to ${filename}`);
    } catch (error) {
      console.error("Error saving file:", error);
      throw error;
    }
  }

  // Build query string from parameters
  private buildQueryString(params: Record<string, string | number>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value.toString());
    });
    return searchParams.toString();
  }

  // Convert headers to fetch headers format
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {};

    Object.entries(this.config.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        // Convert camelCase to kebab-case for HTTP headers
        const headerKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        headers[headerKey] = value;
      }
    });

    return headers;
  }

  // Execute request with retry logic for 401 errors
  private async executeWithRetry(
    requestFunc: () => Promise<Response>,
    retryCount: number = 0,
  ): Promise<Response> {
    const response = await requestFunc();

    // If we get a 401 and haven't exceeded retry limit, refresh token and retry
    if (response.status === 401 && retryCount < this.maxRetries) {
      console.log(
        `Got 401 error, attempting to refresh token (retry ${retryCount + 1}/${this.maxRetries})`,
      );

      try {
        await this.refreshAuthToken();
        console.log("Token refreshed, retrying request...");
        // Retry the request with new token
        return this.executeWithRetry(requestFunc, retryCount + 1);
      } catch (error) {
        console.error("Failed to refresh token:", error);
        throw error;
      }
    }

    return response;
  }

  // Get feed data (returns raw JSON string)
  async getFeed(params: Partial<FeedQueryParams> = {}): Promise<JsonString> {
    const defaultParams: FeedQueryParams = {
      cityId: "recnHvUyeNJfBtDtk",
      page: 1,
      size: 100,
      sortBy: "default",
      categories: "laterToday,tonight,lateNight,openNow,aboutToStart",
    };

    const queryParams = { ...defaultParams, ...params };
    const queryString = this.buildQueryString(queryParams);
    const url = `${this.config.baseUrl}/api/v1/feed?${queryString}`;

    let timeoutId: Timer | undefined;

    const makeRequest = async (): Promise<Response> => {
      // Create new AbortController for each attempt
      const controller = new AbortController();

      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        return await fetch(url, {
          method: "GET",
          headers: this.buildHeaders(),
          signal: controller.signal,
        });
      } finally {
        // Always clear the timeout after the request completes
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }
    };

    try {
      const response = await this.executeWithRetry(makeRequest);

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`,
        );
      }

      const jsonString = await response.text();
      return jsonString;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
      }

      console.error("Error fetching feed:", error);
      throw error;
    }
  }

  // Generic method for making custom requests (returns raw JSON string)
  async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    queryParams: Record<string, string | number> = {},
  ): Promise<JsonString> {
    const queryString =
      Object.keys(queryParams).length > 0
        ? "?" + this.buildQueryString(queryParams)
        : "";
    const url = `${this.config.baseUrl}${endpoint}${queryString}`;

    let timeoutId: Timer | undefined;

    const makeRequest = async (): Promise<Response> => {
      // Create new AbortController for each attempt
      const controller = new AbortController();

      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const requestOptions: RequestInit = {
        ...options,
        headers: {
          ...this.buildHeaders(),
          ...options.headers,
        },
        signal: controller.signal,
      };

      try {
        return await fetch(url, requestOptions);
      } finally {
        // Always clear the timeout after the request completes
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }
    };

    try {
      const response = await this.executeWithRetry(makeRequest);

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`,
        );
      }

      const jsonString = await response.text();
      return jsonString;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
      }

      console.error("Error making request:", error);
      throw error;
    }
  }
}

export {
  BondiLinesApiClient,
  type ApiConfig,
  type FeedQueryParams,
  type ApiHeaders,
  type JsonString,
};

// ============= KEEP ALL THE EXISTING CODE BELOW THIS LINE =============

interface LocationConfig {
  name: string;
  capacity: string | number;
  lat: number;
  lng: number;
}

interface TimeSlot {
  "unix-time": number;
  "venue-name": string;
  address: string;
  lat: number;
  lng: number;
  count: number;
}

interface PredictionPoint {
  value: number;
  label: string;
  dataPointText: string;
}

interface VenueData {
  name: string;
  slug: string;
  address: string;
  predictionChart?: PredictionPoint[];
  city?: {
    timezone?: string;
  };
}

interface EventData {
  startDate: string;
  endDate: string;
  event?: {
    startDate: string;
    endDate: string;
  };
  venue: VenueData;
}

interface FeedItem {
  type: string;
  data: EventData;
}

interface FeedResponse {
  data: FeedItem[];
}

/**
 * Infers the starting hour from a prediction chart by finding the first labeled hour
 * and working backwards
 */
function inferStartingHour(predictionChart: PredictionPoint[]): number | null {
  // Find the first item with a label
  for (let i = 0; i < predictionChart.length; i++) {
    const label = predictionChart[i]!.label;
    if (label && label.endsWith("h")) {
      const hour = parseInt(label.replace("h", ""));
      // Calculate what the first hour should be
      return (hour - i + 24) % 24;
    }
  }
  return null;
}

/**
 * Fills in missing labels in the prediction chart
 */
function fillPredictionLabels(
  predictionChart: PredictionPoint[],
): PredictionPoint[] {
  const filled = [...predictionChart];
  const startHour = inferStartingHour(predictionChart);

  if (startHour === null) return filled;

  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]!.label || filled[i]!.label === "") {
      const hour = (startHour + i) % 24;
      filled[i]! = {
        ...filled[i]!,
        label: `${hour}h`,
      };
    }
  }

  return filled;
}

/**
 * Converts Sydney time to Unix timestamp (seconds since epoch)
 * @param sydneyHour - Hour in Sydney time (0-23)
 * @param baseDate - Base date in Sydney timezone
 * @param isNextDay - Whether this hour is on the next day
 */
function sydneyToUnix(
  sydneyHour: number,
  baseDate: DateTime,
  isNextDay: boolean,
): number {
  let targetDate = baseDate.set({
    hour: sydneyHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  if (isNextDay) {
    targetDate = targetDate.plus({ days: 1 });
  }

  // Return Unix timestamp in ms
  return targetDate.toMillis();
}

/**
 * Main function to extract timeslots from feed data
 */
export async function get_timeslots(
  feedResponseJson: string | FeedResponse,
  locationsJson: string | LocationConfig[],
): Promise<TimeSlot[]> {
  // Parse inputs if they're strings
  const feedResponse: FeedResponse =
    typeof feedResponseJson === "string"
      ? JSON.parse(feedResponseJson)
      : feedResponseJson;

  const locations: LocationConfig[] =
    typeof locationsJson === "string"
      ? JSON.parse(locationsJson)
      : locationsJson;

  // Create a map of venue names to location objects for quick lookup
  // Store the complete location object instead of just capacity
  const locationMap = new Map<string, LocationConfig>();
  locations.forEach((loc) => {
    // Store both exact name and lowercase for case-insensitive matching
    locationMap.set(loc.name.toLowerCase(), {
      ...loc,
      capacity:
        typeof loc.capacity === "string"
          ? parseInt(loc.capacity)
          : loc.capacity,
    });
  });

  const timeslots: TimeSlot[] = [];

  // Process each item in the feed
  for (const item of feedResponse.data) {
    if (item.type !== "event" && item.type !== "liveUpdate") continue;

    const venue = item.data.venue;
    if (
      !venue ||
      !venue.predictionChart ||
      venue.predictionChart.length === 0
    ) {
      continue;
    }

    // Check if this venue is in our locations list (case-insensitive)
    const venueLower = venue.name.toLowerCase();
    let matchedLocation: LocationConfig | undefined;

    // Try exact match first
    if (locationMap.has(venueLower)) {
      matchedLocation = locationMap.get(venueLower);
    } else {
      // Try partial match
      for (const [locName, locData] of locationMap.entries()) {
        if (venueLower.includes(locName) || locName.includes(venueLower)) {
          matchedLocation = locData;
          break;
        }
      }
    }

    if (!matchedLocation) continue;

    // Extract all needed values from the matched location
    const capacity = matchedLocation.capacity as number;
    const lat =
      typeof matchedLocation.lat === "string"
        ? parseFloat(matchedLocation.lat)
        : matchedLocation.lat;
    const lng =
      typeof matchedLocation.lng === "string"
        ? parseFloat(matchedLocation.lng)
        : matchedLocation.lng;

    // Get timezone (default to Sydney if not specified)
    const timezone = venue.city?.timezone || "Australia/Sydney";

    // Use event start date as base date, or current date if not available
    const eventStartDate = item.data.event?.startDate || item.data.startDate;
    const baseDate = eventStartDate
      ? DateTime.fromISO(eventStartDate).setZone(timezone)
      : DateTime.now().setZone(timezone);

    // Fill in missing labels
    const filledChart = fillPredictionLabels(venue.predictionChart);

    // Track if we've rolled over to the next day
    let previousHour = -1;
    let isNextDay = false;

    // Generate timeslots for each prediction point
    for (const point of filledChart) {
      const hourStr = point.label.replace("h", "");
      const hour = parseInt(hourStr);

      // Check if we've rolled over to the next day
      if (previousHour > hour && previousHour >= 20 && hour <= 6) {
        isNextDay = true;
      }
      previousHour = hour;

      // Calculate the count
      const percentage = point.value / 100;
      const count = Math.round(capacity * percentage);

      // Convert to Unix timestamp
      const unixTime = sydneyToUnix(hour, baseDate, isNextDay);

      timeslots.push({
        "unix-time": unixTime,
        "venue-name": venue.name,
        address: venue.address,
        lat: lat,
        lng: lng,
        count: count,
      });
    }
  }

  // Sort by Unix timestamp
  timeslots.sort((a, b) => a["unix-time"] - b["unix-time"]);

  return timeslots;
}
