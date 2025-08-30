

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
// USES THE FEED FILE GENERATED FROM BondiLinesApiClient.getFeed() 
// AND SAVES A NEW FILE geocoded-venues.json WITH NAME, BLANK CAPACITY, LAT, LNG
// WE THEN CAN USE THIS TO GENERATE predicted-locations.json

// ===================================================================================
// --- CONFIGURATION ---
// ===================================================================================
// IMPORTANT: Replace with your actual Google Geocoding API key
const GOOGLE_API_KEY = 'AIzaSyB8wiXpNKbsyaehdo7UyiMwDsa_yZR7i5w';

// Define the input and output file names
const INPUT_FILE_NAME = 'feed.json';
const OUTPUT_FILE_NAME = 'geocoded-venues.json';
// ===================================================================================


// --- INTERFACES FOR TYPE SAFETY ---

// Interfaces for the initial feed.json structure
interface FeedVenue {
  name: string;
  address: string;
  predictionChart?: unknown[]; // We only care if it exists and is a non-empty array
}

interface FeedDataItem {
  data: {
    venue: FeedVenue;
  };
}

interface InputFeed {
  data: FeedDataItem[];
}

// Interfaces for the Google Geocoding API response
interface GeoLocation {
  lat: number;
  lng: number;
}

interface Geometry {
  location: GeoLocation;
}

interface GeocodingResult {
  geometry: Geometry;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR';
  error_message?: string;
}

// Interface for the final output object
interface FinalVenueOutput {
  name: string;
  capacity: string;
  lat: number;
  lng: number;
}


/**
 * Fetches geocoding data for a given address from the Google Geocoding API.
 * @param address The street address to geocode.
 * @returns A promise that resolves to the latitude and longitude, or null if not found.
 */
async function getCoordinates(address: string): Promise<GeoLocation | null> {
  const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
  const encodedAddress = encodeURIComponent(address);
  const url = `${GEOCODING_API_URL}?address=${encodedAddress}&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json() as GeocodingResponse;

    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].geometry.location;
    } else {
      console.error(`Geocoding error for address "${address}": ${data.status} - ${data.error_message || 'No results found.'}`);
      return null;
    }
  } catch (error) {
    console.error(`Network or fetch error for address "${address}":`, error);
    return null;
  }
}

/**
 * Main function to process the feed, geocode venues, and save the result.
 * @param inputFilePath The path to the initial feed JSON file.
 * @param outputFilePath The path where the final geocoded JSON file will be saved.
 */
async function processFeedAndGeocode(inputFilePath: string, outputFilePath: string): Promise<void> {
  console.log('Starting the process...');

  try {
    // --- PART 1: Read and Filter the Initial Feed ---
    console.log(`Reading input feed from: ${inputFilePath}`);
    const rawData = fs.readFileSync(inputFilePath, 'utf-8');
    const feed: InputFeed = JSON.parse(rawData);

    if (!feed.data || !Array.isArray(feed.data)) {
      throw new Error('Input JSON is not in the expected format of {"data": [...]}.');
    }

    const venuesToProcess = feed.data
      .filter(item =>
        item.data?.venue?.predictionChart &&
        Array.isArray(item.data.venue.predictionChart) &&
        item.data.venue.predictionChart.length > 0
      )
      .map(item => ({
        name: item.data.venue.name,
        address: item.data.venue.address,
      }));

    console.log(`Found ${venuesToProcess.length} venues with a predictionChart to geocode.`);

    if (venuesToProcess.length === 0) {
      console.log('No venues to process. Exiting.');
      return;
    }

    // --- PART 2: Geocode Each Venue and Create Final Output ---
    const finalVenueList: FinalVenueOutput[] = [];

    for (const venue of venuesToProcess) {
      console.log(`Geocoding "${venue.name}"...`);
      const location = await getCoordinates(venue.address);

      if (location) {
        finalVenueList.push({
          name: venue.name,
          capacity: "", // Blank as requested
          lat: location.lat,
          lng: location.lng,
        });
        console.log(` -> Success: Found coordinates for "${venue.name}".`);
      } else {
        console.warn(` -> Failed: Could not find coordinates for "${venue.name}". It will be skipped.`);
      }
    }

    // --- PART 3: Write the Final JSON File ---
    const outputJson = JSON.stringify(finalVenueList, null, 2);
    fs.writeFileSync(outputFilePath, outputJson, 'utf-8');

    console.log(`\n✅ Process complete! Geocoded data for ${finalVenueList.length} venues saved to: ${outputFilePath}`);

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Error parsing the input JSON file. Please ensure it is valid.', error);
    } else {
      console.error('An unexpected error occurred during the process:', error);
    }
  }
}

// --- SCRIPT EXECUTION ---
const inputFile = path.join(__dirname, INPUT_FILE_NAME);
const outputFile = path.join(__dirname, OUTPUT_FILE_NAME);

// Run the main function
processFeedAndGeocode(inputFile, outputFile);