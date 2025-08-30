import { BondiLinesApiClient, get_timeslots, generateRealisticMapPoints } from "./predictions.ts";
import locations from "./locations.json" assert { type: "json" };
import * as fs from 'fs';

async function main() {
    try {

        const client = new BondiLinesApiClient();
        const feedResponse = await client.getFeed(); // Gets live predictions
        fs.writeFileSync("../../mocks/feed.json", feedResponse ? JSON.stringify(feedResponse, null, 2) : "No response");
        const timeslots = await get_timeslots(feedResponse, locations); // Formats feed into timeslots for the specific locations in locations.json
        fs.writeFileSync("../../mocks/timeslots.json", timeslots ? JSON.stringify(timeslots, null, 2) : "No response");
        var myMapPoints = []; // Seed with one point to avoid null

        var newMapPoints = generateRealisticMapPoints(timeslots);
        for (const p of newMapPoints) {
            myMapPoints.push(p);
        }


        fs.writeFileSync("../../mocks/predicted-locations.json", myMapPoints ? JSON.stringify(myMapPoints, null, 2) : "No response");
        console.log(`✅ Successfully processed ${myMapPoints?.length || 0} points`);
    } catch (error) {
        console.error("❌ Error in main process:", error);
        process.exit(1);
    }
}

// Run the main function
main().then(() => {
    // Explicitly exit to avoid any hanging processes
    process.exit(0);
}).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});