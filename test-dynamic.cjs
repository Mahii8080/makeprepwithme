const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const fs = require("fs");

let geminiKey = "";
let openaiKey = "";

try {
    const envLocal = fs.readFileSync(".env.local", "utf-8");
    for (const line of envLocal.split('\n')) {
        if (line.trim().startsWith('VITE_GEMINI_API_KEY=')) {
            geminiKey = line.split('=')[1].trim();
        }
        if (line.trim().startsWith('VITE_OPENAI_API_KEY=')) {
            openaiKey = line.split('=')[1].trim();
        }
    }
} catch(e) {}

console.log("Using Gemini Key ending with:", geminiKey.slice(-4));
console.log("Using OpenAI Key ending with:", openaiKey.slice(-4));

const genAI = new GoogleGenAI({ apiKey: geminiKey });
const openai = new OpenAI({ apiKey: openaiKey });

async function test() {
    const prompt = "Evaluate: what is a list? Answer: array of things.";
    
    console.log("=== Testing Gemini ===");
    try {
        const parts = [{ text: prompt }];
        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
            config: { responseMimeType: "application/json" }
        });
        console.log("Gemini Result SUCCESS");
    } catch (e) {
        console.error("Gemini crashed:", e.message);
    }

    console.log("\n=== Testing OpenAI ===");
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        console.log("OpenAI Result SUCCESS");
    } catch (e) {
        console.error("OpenAI crashed:", e.message);
    }
}
test();
