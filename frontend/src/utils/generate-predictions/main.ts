import { BondiLinesApiClient, get_timeslots } from "./predictions.ts";
import locations from "./locations.json" assert { type: "json" };
import * as fs from 'fs';

async function main() {
    try {

        const client = new BondiLinesApiClient(); 
        const feedResponse = await client.getFeed(); // Gets live predictions
        const timeslots = await get_timeslots(feedResponse, locations); // Formats feed into timeslots for the specific locations in locations.json
        fs.writeFileSync("timeslots.json", timeslots ? JSON.stringify(timeslots, null, 2) : "No response");
        console.log(`✅ Successfully processed ${timeslots?.length || 0} timeslots`);        
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