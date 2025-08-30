/**
 * Bondi Lines API Client - Optimized for Bun Runtime with Auto Token Refresh
 * Now with robust prediction chart processing that handles duplicates and malformed data
 */

import { DateTime } from 'luxon';
import * as fs from 'fs';
import * as path from 'path';

// [Keep all the existing interfaces and BondiLinesApiClient class as-is]
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

type JsonString = string;

class BondiLinesApiClient {
    private config: ApiConfig;
    private authFilePath: string;
    private maxRetries: number = 2;

    constructor(config: Partial<ApiConfig> = {}) {
        this.authFilePath = path.join(process.cwd(), 'auth.json');
        const authToken = this.loadAuthToken();

        this.config = {
            baseUrl: config.baseUrl || 'https://api.bondilinesapp.com',
            timeout: config.timeout || 10000,
            headers: {
                host: 'api.bondilinesapp.com',
                accept: 'application/json',
                contentType: 'application/json',
                userAgent: 'Lines/430 CFNetwork/3826.600.41 Darwin/24.6.0',
                acceptLanguage: 'en-AU,en;q=0.9',
                authorization: authToken ? `Bearer ${authToken}` : undefined,
                ...config.headers
            }
        };
    }

    private loadAuthToken(): string | null {
        try {
            if (fs.existsSync(this.authFilePath)) {
                const authData: AuthData = JSON.parse(fs.readFileSync(this.authFilePath, 'utf-8'));
                if (authData.expiresAt) {
                    const expiresAt = new Date(authData.expiresAt);
                    const now = new Date();
                    if (expiresAt <= now) {
                        console.log('Token expired, will refresh on next request');
                        return null;
                    }
                }
                return authData.token;
            }
        } catch (error) {
            console.error('Error loading auth token:', error);
        }
        return null;
    }

    private saveAuthToken(token: string, expiresIn?: string, refreshToken?: string): void {
        try {
            const authData: AuthData = {
                token,
                refreshToken
            };
            if (expiresIn) {
                const expiresInSeconds = parseInt(expiresIn);
                const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000));
                authData.expiresAt = expiresAt.toISOString();
            }
            fs.writeFileSync(this.authFilePath, JSON.stringify(authData, null, 2));
            console.log('Auth token saved to auth.json');
        } catch (error) {
            console.error('Error saving auth token:', error);
        }
    }

    private async refreshAuthToken(): Promise<string> {
        console.log('Refreshing authentication token...');
        const authUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD_Bwm02299rbe9Xab4ufyux3fHI2hYxKE';

        const requestBody = {
            returnSecureToken: true,
            email: "fasisol266@noidem.com",
            password: "Abc12345!",
            clientType: "CLIENT_TYPE_WEB"
        };

        const headers = {
            "Host": "identitytoolkit.googleapis.com",
            "Content-Type": "application/json",
            "x-firebase-client": "eyJ2ZXJzaW9uIjoyLCJoZWFydGJlYXRzIjpbeyJhZ2VudCI6ImZpcmUtY29yZS1ub2RlLzAuMTMuMiBmaXJlLWNvcmUtY2pzMjAxNy8wLjEzLjIgZmlyZS1qcy8gZmlyZS1mc3Qtcm4vNC44LjAgZmlyZS1mc3QtZXNtMjAxNy80LjguMCBmaXJlLWpzLWFsbC1hcHAvMTEuMTAuMCBmaXJlLWF1dGgtcm4vMS4xMC44IGZpcmUtYXV0aC1janMyMDE3LzEuMTAuOCBmaXJlLWZuLzAuMTIuOSBmaXJlLWZuLWVzbTIwMTcvMC4xMi45IGZpcmUtZ2NzLzAuMTMuMTQgZmlyZS1nY3MtZXNtMjAxNy8wLjEzLjE0IiwiZGF0ZXMiOlsiMjAyNS0wOC0zMCJdfV19",
            "Accept": "*/*",
            "x-client-version": "ReactNative/JsCore/11.10.0/FirebaseCore-web",
            "baggage": "sentry-environment=production,sentry-public_key=0641964d77fad01d81994143894f2698,sentry-trace_id=10a90158ae524c1db184de929cdb1ca4,sentry-org_id=4507486973198336",
            "Accept-Language": "en-AU,en;q=0.9",
            "sentry-trace": "10a90158ae524c1db184de929cdb1ca4-a5f0ede30aae8488",
            "User-Agent": "Lines/430 CFNetwork/3826.600.41 Darwin/24.6.0",
            "x-firebase-gmpid": "app-id"
        };

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Auth refresh failed: ${response.status} - ${response.statusText}`);
            }

            const authData = await response.json() as AuthResponse;
            this.saveAuthToken(authData.idToken, authData.expiresIn, authData.refreshToken);
            this.config.headers.authorization = `Bearer ${authData.idToken}`;
            console.log('Authentication token refreshed successfully');
            return authData.idToken;
        } catch (error) {
            console.error('Error refreshing auth token:', error);
            throw error;
        }
    }

    updateConfig(newConfig: Partial<ApiConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            headers: {
                ...this.config.headers,
                ...newConfig.headers
            }
        };
    }

    setAuthToken(token: string): void {
        this.config.headers.authorization = `Bearer ${token}`;
        this.saveAuthToken(token);
    }

    async saveResponseToFile(jsonString: string, filename: string): Promise<void> {
        try {
            await Bun.write(filename, jsonString);
            console.log(`Response saved to ${filename}`);
        } catch (error) {
            console.error('Error saving file:', error);
            throw error;
        }
    }

    private buildQueryString(params: Record<string, string | number>): string {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, value.toString());
        });
        return searchParams.toString();
    }

    private buildHeaders(): HeadersInit {
        const headers: HeadersInit = {};
        Object.entries(this.config.headers).forEach(([key, value]) => {
            if (value !== undefined) {
                const headerKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                headers[headerKey] = value;
            }
        });
        return headers;
    }

    private async executeWithRetry(
        requestFunc: () => Promise<Response>,
        retryCount: number = 0
    ): Promise<Response> {
        const response = await requestFunc();
        if (response.status === 401 && retryCount < this.maxRetries) {
            console.log(`Got 401 error, attempting to refresh token (retry ${retryCount + 1}/${this.maxRetries})`);
            try {
                await this.refreshAuthToken();
                console.log('Token refreshed, retrying request...');
                return this.executeWithRetry(requestFunc, retryCount + 1);
            } catch (error) {
                console.error('Failed to refresh token:', error);
                throw error;
            }
        }
        return response;
    }

    async getFeed(params: Partial<FeedQueryParams> = {}): Promise<JsonString> {
        const defaultParams: FeedQueryParams = {
            cityId: 'recnHvUyeNJfBtDtk',
            page: 1,
            size: 5000,
            sortBy: 'default',
            categories: 'laterToday,tonight,lateNight,openNow,aboutToStart'
        };

        const queryParams = { ...defaultParams, ...params };
        const queryString = this.buildQueryString(queryParams);
        const url = `${this.config.baseUrl}/api/v1/feed?${queryString}`;

        let timeoutId: Timer | undefined;

        const makeRequest = async (): Promise<Response> => {
            const controller = new AbortController();
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            try {
                return await fetch(url, {
                    method: 'GET',
                    headers: this.buildHeaders(),
                    signal: controller.signal,
                });
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = undefined;
                }
            }
        };

        try {
            const response = await this.executeWithRetry(makeRequest);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            const jsonString = await response.text();
            return jsonString;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${this.config.timeout}ms`);
                }
            }
            console.error('Error fetching feed:', error);
            throw error;
        }
    }

    async makeRequest(
        endpoint: string,
        options: RequestInit = {},
        queryParams: Record<string, string | number> = {}
    ): Promise<JsonString> {
        const queryString = Object.keys(queryParams).length > 0
            ? '?' + this.buildQueryString(queryParams)
            : '';
        const url = `${this.config.baseUrl}${endpoint}${queryString}`;

        let timeoutId: Timer | undefined;

        const makeRequest = async (): Promise<Response> => {
            const controller = new AbortController();
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            const requestOptions: RequestInit = {
                ...options,
                headers: {
                    ...this.buildHeaders(),
                    ...options.headers
                },
                signal: controller.signal
            };
            try {
                return await fetch(url, requestOptions);
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = undefined;
                }
            }
        };

        try {
            const response = await this.executeWithRetry(makeRequest);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            const jsonString = await response.text();
            return jsonString;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${this.config.timeout}ms`);
                }
            }
            console.error('Error making request:', error);
            throw error;
        }
    }
}

export { BondiLinesApiClient, type ApiConfig, type FeedQueryParams, type ApiHeaders, type JsonString };

// ============= DATA PROCESSING CODE WITH ROBUST CHART PROCESSOR =============

interface LocationConfig {
    name: string;
    capacity: string | number;
    lat: number;
    lng: number;
}

interface TimeSlot {
    "unix-time": number;
    "venue-name": string;
    "address": string;
    "lat": number;
    "lng": number;
    "count": number;
}

interface PredictionPoint {
    value: number;
    label: string;
    dataPointText: string;
}

interface ProcessedPoint extends PredictionPoint {
    hour: number;
    originalIndex: number;
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
 * ROBUST PREDICTION CHART PROCESSOR
 * Handles duplicate hours and malformed data from the API
 */
function processPredictionChart(predictionChart: PredictionPoint[]): PredictionPoint[] {
    if (!predictionChart || predictionChart.length === 0) {
        return [];
    }

    // Step 1: Build a map of all labeled hours and their positions
    const labeledHours = new Map<number, { indices: number[], maxValue: number }>();
    const labeledIndices = new Set<number>();
    
    predictionChart.forEach((point, index) => {
        if (point.label && point.label.endsWith('h')) {
            const hour = parseInt(point.label.replace('h', ''));
            if (!isNaN(hour)) {
                labeledIndices.add(index);
                if (!labeledHours.has(hour)) {
                    labeledHours.set(hour, { indices: [index], maxValue: point.value });
                } else {
                    const existing = labeledHours.get(hour)!;
                    existing.indices.push(index);
                    existing.maxValue = Math.max(existing.maxValue, point.value);
                }
            }
        }
    });

    // Step 2: Infer hours for unlabeled entries based on their position
    const processedPoints: ProcessedPoint[] = [];
    const sortedLabeledIndices = Array.from(labeledIndices).sort((a, b) => a - b);
    
    if (sortedLabeledIndices.length === 0) {
        // No labeled hours at all - can't process
        console.warn('No labeled hours found in prediction chart');
        return predictionChart;
    }

    // Process each point and assign it an hour
    for (let i = 0; i < predictionChart.length; i++) {
        const point = predictionChart[i];
        let assignedHour: number | null = null;

        if (point.label && point.label.endsWith('h')) {
            // This point has a label
            assignedHour = parseInt(point.label.replace('h', ''));
        } else {
            // This point needs an inferred hour
            let prevLabeledIdx = -1;
            let nextLabeledIdx = -1;
            
            for (let j = i - 1; j >= 0; j--) {
                if (labeledIndices.has(j)) {
                    prevLabeledIdx = j;
                    break;
                }
            }
            
            for (let j = i + 1; j < predictionChart.length; j++) {
                if (labeledIndices.has(j)) {
                    nextLabeledIdx = j;
                    break;
                }
            }

            if (prevLabeledIdx !== -1 && nextLabeledIdx !== -1) {
                // Between two labeled points
                const prevHour = parseInt(predictionChart[prevLabeledIdx].label.replace('h', ''));
                const nextHour = parseInt(predictionChart[nextLabeledIdx].label.replace('h', ''));
                
                // Calculate position between the two labeled points
                const gapSize = nextLabeledIdx - prevLabeledIdx - 1;
                const positionInGap = i - prevLabeledIdx;
                
                // Handle hour wrapping (e.g., 23h to 2h)
                let hourDiff = nextHour - prevHour;
                if (hourDiff < 0) {
                    hourDiff += 24;
                }
                
                // Infer the hour based on position
                if (gapSize > 0 && hourDiff > 0) {
                    const hoursPerPosition = hourDiff / (gapSize + 1);
                    assignedHour = (prevHour + Math.round(hoursPerPosition * positionInGap)) % 24;
                }
            } else if (prevLabeledIdx !== -1) {
                // After the last labeled point
                const prevHour = parseInt(predictionChart[prevLabeledIdx].label.replace('h', ''));
                const distance = i - prevLabeledIdx;
                assignedHour = (prevHour + distance) % 24;
            } else if (nextLabeledIdx !== -1) {
                // Before the first labeled point
                const nextHour = parseInt(predictionChart[nextLabeledIdx].label.replace('h', ''));
                const distance = nextLabeledIdx - i;
                assignedHour = (nextHour - distance + 24) % 24;
            }
        }

        if (assignedHour !== null && !isNaN(assignedHour)) {
            processedPoints.push({
                ...point,
                hour: assignedHour,
                originalIndex: i
            });
        }
    }

    // Step 3: Group by hour and take the highest value for each hour
    const hourMap = new Map<number, ProcessedPoint>();
    
    for (const point of processedPoints) {
        if (!hourMap.has(point.hour)) {
            hourMap.set(point.hour, point);
        } else {
            const existing = hourMap.get(point.hour)!;
            if (point.value > existing.value) {
                hourMap.set(point.hour, point);
            }
        }
    }

    // Step 4: Sort by hour and create the final cleaned array
    const sortedHours = Array.from(hourMap.keys()).sort((a, b) => {
        // Check if we're dealing with a day boundary crossing
        const hasNightHours = Array.from(hourMap.keys()).some(h => h >= 20);
        const hasMorningHours = Array.from(hourMap.keys()).some(h => h <= 6);
        
        if (hasNightHours && hasMorningHours) {
            // We have hours crossing midnight
            if (a >= 20 && b <= 6) return -1;
            if (a <= 6 && b >= 20) return 1;
        }
        
        return a - b;
    });

    // Create the final cleaned array
    const cleanedChart: PredictionPoint[] = sortedHours.map(hour => {
        const point = hourMap.get(hour)!;
        return {
            value: point.value,
            label: `${hour}h`,
            dataPointText: point.dataPointText || `${point.value}%`
        };
    });

    return cleanedChart;
}

/**
 * Converts Sydney time to Unix timestamp (seconds since epoch)
 */
function sydneyToUnix(sydneyHour: number, baseDate: DateTime, isNextDay: boolean): number {
    let targetDate = baseDate.set({
        hour: sydneyHour,
        minute: 0,
        second: 0,
        millisecond: 0
    });

    if (isNextDay) {
        targetDate = targetDate.plus({ days: 1 });
    }

    return targetDate.toSeconds();
}

/**
 * Main function to extract timeslots from feed data
 * Now uses robust prediction chart processing
 */
export async function get_timeslots(
    feedResponseJson: string | FeedResponse,
    locationsJson: string | LocationConfig[]
): Promise<TimeSlot[]> {
    // Parse inputs if they're strings
    const feedResponse: FeedResponse = typeof feedResponseJson === 'string'
        ? JSON.parse(feedResponseJson)
        : feedResponseJson;

    const locations: LocationConfig[] = typeof locationsJson === 'string'
        ? JSON.parse(locationsJson)
        : locationsJson;

    // Create a map of venue names to location objects
    const locationMap = new Map<string, LocationConfig>();
    locations.forEach(loc => {
        locationMap.set(loc.name.toLowerCase(), {
            ...loc,
            capacity: typeof loc.capacity === 'string'
                ? parseInt(loc.capacity)
                : loc.capacity
        });
    });

    const timeslots: TimeSlot[] = [];

    // Process each item in the feed
    for (const item of feedResponse.data) {
        if (item.type !== 'event' && item.type !== 'liveUpdate') continue;

        const venue = item.data.venue;
        if (!venue || !venue.predictionChart || venue.predictionChart.length === 0) {
            continue;
        }

        // Check if this venue is in our locations list
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

        const capacity = matchedLocation.capacity as number;
        const lat = typeof matchedLocation.lat === 'string'
            ? parseFloat(matchedLocation.lat)
            : matchedLocation.lat;
        const lng = typeof matchedLocation.lng === 'string'
            ? parseFloat(matchedLocation.lng)
            : matchedLocation.lng;

        // Get timezone
        const timezone = venue.city?.timezone || 'Australia/Sydney';

        // Use the ROBUST processor to clean the prediction chart
        const cleanedChart = processPredictionChart(venue.predictionChart);
        
        if (cleanedChart.length === 0) {
            console.warn(`Skipping venue ${venue.name} - could not process prediction chart`);
            continue;
        }

        // Use event start date as base date
        const eventStartDate = item.data.event?.startDate || item.data.startDate;
        const baseDate = eventStartDate
            ? DateTime.fromISO(eventStartDate).setZone(timezone)
            : DateTime.now().setZone(timezone);

        // Track if we've rolled over to the next day
        let previousHour = -1;
        let isNextDay = false;

        // Generate timeslots for each cleaned prediction point
        for (const point of cleanedChart) {
            const hour = parseInt(point.label.replace('h', ''));

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
                "address": venue.address,
                "lat": lat,
                "lng": lng,
                "count": count
            });
        }
    }

    // Sort by Unix timestamp
    timeslots.sort((a, b) => a["unix-time"] - b["unix-time"]);

    return timeslots;
}

// ============= MAP POINT GENERATION CODE (REVISED FOR FADE-OUT LOGIC) =============
// ============= MAP POINT GENERATION CODE (FINAL, CORRECTED VERSION) =============

interface Coordinate {
    lat: number;
    lng: number;
}

interface MapPoint {
    id: string;
    timestamp: number; // Unix timestamp in seconds
    lat: number;
    lng: number;
}

interface RealisticPointOptions {
    // Defines how strongly the point appearance is skewed towards the end of its 30-minute appearance window.
    // 1.0 = linear (steady rate of appearance).
    // 2.0 = (Default) quadratic, dots appear faster towards the end of the hour.
    // >2.0 = A more pronounced exponential effect.
    distributionFactor?: number;
    // The lifespan of a dot on the map, in seconds.
    pointLifespanSeconds?: number;
}

// Helper function to generate the spatial polygon (no changes from original)
function generateRandomPolygon(
    center: Coordinate,
    avgRadius: number,
    irregularity: number,
    spikiness: number,
    numVertices: number
): Coordinate[] {
    const vertices: Coordinate[] = [];
    const angleStep = (2 * Math.PI) / numVertices;

    for (let i = 0; i < numVertices; i++) {
        const baseAngle = i * angleStep;
        const randomAngle = baseAngle + (Math.random() - 0.5) * irregularity * angleStep;
        const randomRadius = avgRadius * (1 + (Math.random() - 0.5) * spikiness);

        const lat = center.lat + randomRadius * Math.cos(randomAngle);
        const lng = center.lng + randomRadius * Math.sin(randomAngle);

        vertices.push({ lat, lng });
    }
    return vertices;
}

// Helper for Gaussian distribution (no changes from original)
function random_normal(): number {
    let u1 = Math.random();
    let u2 = Math.random();
    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0;
}

// Helper to generate a single point's coordinates (no changes from original)
function generateGaussianPoint(center: Coordinate, stdDev: number): Coordinate {
    return {
        lat: center.lat + random_normal() * stdDev,
        lng: center.lng + random_normal() * stdDev,
    };
}

// Helper to check if a point is in the polygon (no changes from original)
function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
    let isInside = false;
    const numVertices = polygon.length;
    for (let i = 0, j = numVertices - 1; i < numVertices; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;

        const intersect = ((yi > point.lat) !== (yj > point.lat))
            && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Generates the precise number of points for a single timeslot, ensuring they are all
 * visible at the target timestamp and appear exponentially over the preceding 30 minutes.
 *
 * @param data - The TimeSlot object containing the target count and timestamp.
 * @param options - Configuration for point generation.
 * @returns An array of generated MapPoint objects for this specific timeslot.
 */
function generatePointsForTimestamp(
    data: TimeSlot,
    options: RealisticPointOptions
): MapPoint[] {
    const {
        distributionFactor = 2.0,
        pointLifespanSeconds = 1800 // 30 minutes
    } = options;

    if (data.count <= 0) {
        return [];
    }

    const generatedPoints: MapPoint[] = [];
    const center: Coordinate = { lat: data.lat, lng: data.lng };

    // Define the geographic area for the points
    const polygonRadius = 0.00025;
    const standardDeviation = polygonRadius / 3;
    const polygon = generateRandomPolygon(center, polygonRadius, 0.5, 0.5, 8);

    // Define the time window in which points for THIS timeslot are BORN.
    // They must all be born in the 30 minutes leading up to the target time.
    const endTime = data["unix-time"];
    const startTime = endTime - pointLifespanSeconds;

    while (generatedPoints.length < data.count) {
        const candidatePoint = generateGaussianPoint(center, standardDeviation);

        if (isPointInPolygon(candidatePoint, polygon)) {
            // This is the key: Generate a timestamp skewed towards the END of the window.
            // A random value raised to a power > 1 skews it towards 0.
            // We use (1.0 - random) to get a value skewed towards 1.
            const skewedProgress = Math.pow(Math.random(), distributionFactor);
            const timeOffset = skewedProgress * pointLifespanSeconds;
            const timestamp = startTime + timeOffset;

            generatedPoints.push({
                id: crypto.randomUUID(),
                timestamp: Math.round(timestamp),
                lat: candidatePoint.lat,
                lng: candidatePoint.lng,
            });
        }
    }
    return generatedPoints;
}


/**
 * Main generation function. For each hourly data point, it creates a distinct
 * population of dots designed to be fully visible at that exact hour,
 * having appeared exponentially over the 30 minutes prior.
 *
 * @param timeslots - A sorted array of TimeSlot data.
 * @param options - Configuration for point generation.
 * @returns A single flat array of all generated MapPoint objects.
 */
export function generateRealisticMapPoints(
    timeslots: TimeSlot[],
    options: RealisticPointOptions = {}
): MapPoint[] {
    let allGeneratedPoints: MapPoint[] = [];

    if (!timeslots || timeslots.length === 0) {
        return [];
    }
    
    // The logic is now much simpler: for each timeslot, generate its corresponding
    // population of points. The display logic will handle the crossfade naturally.
    for (const slot of timeslots) {
        const pointsForSlot = generatePointsForTimestamp(slot, options);
        allGeneratedPoints.push(...pointsForSlot);
    }
    
    return allGeneratedPoints;
}