import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

export interface LocationPing {
  id: string;
  timestamp: number; // timestamp in milliseconds
  lat: number;
  lng: number;
}

const SYDNEY_COORDINATES = {  
  lat: -33.8688,
  lng: 151.2093,
} as const;

const NEWTOWN_COORDINATES = {
  lat: -33.895278,
  lng: 151.179778,
} as const;

const SURRY_HILLS_COORDINATES = {
  lat: -33.906582,
  lng: 151.191009,
} as const;

const BONDI_BEACH_COORDINATES = {
  lat: -33.890605,
  lng: 151.277284,
} as const;

const CENTENNIAL_PARK_COORDINATES = {
  lat: -33.896302,
  lng: 151.233682,
} as const;

// Sample from a normal distribution using the Box–Muller transform
function randomNormal(mean: number = 0, stdDev: number = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z = mag * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function chooseIndexByWeights(weights: number[]): number {
  const total = weights.reduce((acc, w) => acc + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

/**
 * Generates mock location data with flowing clusters over time.
 * Clusters drift smoothly (global wind + per-cluster velocity),
 * creating a precipitation-like motion when animated.
 */
function generateMockLocationData({lat, lng}: {lat?: number, lng?: number} = {}): LocationPing[] {
  const data: LocationPing[] = [];
  const baseLat = lat ?? SYDNEY_COORDINATES.lat;
  const baseLng = lng ?? SYDNEY_COORDINATES.lng;
  const numPoints = 1000; // Generate 500 data points
  const startTime = Date.now() - (24 * 60 * 60 * 1000); // Start from 24 hours ago
  const timeRange = 2 * 60 * 60 * 1000; // Spread over 2 hours (realistic for real-time pings)

  // Define Gaussian clusters around the base location
  const numClusters = 5;
  const clusterCenterRadiusDeg = 0.01; // ~1.1km from base
  const clusterStdDevDeg = 0.0012; // ~130m spread per cluster

  const clusterCenters = Array.from({ length: numClusters }, () => ({
    lat: baseLat + (Math.random() - 0.5) * 2 * clusterCenterRadiusDeg,
    lng: baseLng + (Math.random() - 0.5) * 2 * clusterCenterRadiusDeg,
  }));

  // Heavier weight for earlier clusters to create visible hotspots
  const clusterWeights = Array.from({ length: numClusters }, (_, k) => Math.pow(0.6, k));

  // Global wind drift (total degrees across the whole timeRange)
  const windDir = Math.random() * 2 * Math.PI;
  const windMagDeg = 0.02; // ~2.2km total drift across timeRange
  const windVel = { lat: windMagDeg * Math.sin(windDir), lng: windMagDeg * Math.cos(windDir) };

  // Per-cluster velocity perturbations (in degrees across timeRange)
  const clusterVelocities = Array.from({ length: numClusters }, () => ({
    lat: windVel.lat + randomNormal(0, 0.003),
    lng: windVel.lng + randomNormal(0, 0.003),
  }));

  for (let i = 0; i < numPoints; i++) {
    // Create timestamps that progress forward but with some randomness
    const timeOffset = (i / numPoints) * timeRange;
    const randomTimeJitter = (Math.random() - 0.5) * 30000; // ±15 seconds jitter
    const timestamp = Math.floor((startTime + timeOffset + randomTimeJitter) / 1000);
    const progress = timeOffset / timeRange; // normalized [0,1]

    // Sample coordinates from a 2D Gaussian around a chosen cluster center
    const clusterIndex = chooseIndexByWeights(clusterWeights);
    const center0 = clusterCenters[clusterIndex];
    const vel = clusterVelocities[clusterIndex];
    const movingCenterLat = center0.lat + vel.lat * progress;
    const movingCenterLng = center0.lng + vel.lng * progress;
    const lat = movingCenterLat + randomNormal(0, clusterStdDevDeg);
    const lng = movingCenterLng + randomNormal(0, clusterStdDevDeg);

    data.push({
      id: randomUUID(),
      timestamp: timestamp,
      lat: Math.round(lat * 1000000) / 1000000, // Round to 6 decimal places
      lng: Math.round(lng * 1000000) / 1000000
    });
  }

  // Sort by timestamp to ensure chronological order
  return data.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Saves mock data to a JSON file
 */
function saveMockData(data: LocationPing[], filename: string = 'locations.json'): void {
  try {
    // Read existing data if file exists
    let existingData: LocationPing[] = [];
    try {
      const existingContent = readFileSync(filename, 'utf8');
      existingData = JSON.parse(existingContent);
    } catch {
      // File doesn't exist or is invalid, start with empty array
    }
    
    // Append new data to existing data
    const combinedData = [...existingData, ...data];
    const jsonData = JSON.stringify(combinedData, null, 2);
    writeFileSync(filename, jsonData);
    console.log(`✅ Mock data generated and saved to ${filename}`);
    console.log(`📊 Generated ${data.length} location points`);
    console.log(`📍 Geographic center: ${data[0].lat.toFixed(6)}, ${data[0].lng.toFixed(6)}`);
    console.log(`⏰ Time range: ${new Date(data[0].timestamp).toLocaleString()} to ${new Date(data[data.length - 1].timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error saving mock data:', error);
  }
}

// Generate and save the mock data
if (import.meta.main) {
  console.log('🚀 Generating mock location data...');
  const mockData = [
    ...generateMockLocationData({lat: SYDNEY_COORDINATES.lat, lng: SYDNEY_COORDINATES.lng}),
    ...generateMockLocationData({lat: NEWTOWN_COORDINATES.lat, lng: NEWTOWN_COORDINATES.lng}),
    ...generateMockLocationData({lat: SURRY_HILLS_COORDINATES.lat, lng: SURRY_HILLS_COORDINATES.lng}),
    ...generateMockLocationData({lat: BONDI_BEACH_COORDINATES.lat, lng: BONDI_BEACH_COORDINATES.lng}),
    ...generateMockLocationData({lat: CENTENNIAL_PARK_COORDINATES.lat, lng: CENTENNIAL_PARK_COORDINATES.lng}),
  ];
  saveMockData(mockData, './src/mocks/locations.json');
}

export { generateMockLocationData, saveMockData };
