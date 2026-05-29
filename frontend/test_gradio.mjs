import { Client } from "@gradio/client";
import { readFileSync } from "fs";

async function test() {
    console.log("Connecting...");
    const client = await Client.connect("GREEEN4/MATH-OCR");
    
    // We don't have a real image handy easily so we'll just send a bad blob to see if it routes correctly
    const blob = new Blob(["dummy data"], { type: "image/jpeg" });
    try {
        const result = await client.predict("/process_image", [
            blob,
            "Pix2Tex (Pure Math Equations)"
        ]);
        console.log("Result:", result.data);
    } catch(e) {
        console.error("Predict Error:", e);
    }
}

test().catch(console.error);
