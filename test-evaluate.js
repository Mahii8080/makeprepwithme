import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.local') });

const apiKey = process.env.VITE_GEMINI_API_KEY;
console.log("API Key found:", !!apiKey);

const genAI = new GoogleGenAI({ apiKey });

async function test() {
    const prompt = "Please evaluate this simple python question: what is a list? Answer: array of things. Give exactly JSON with feedback and score.";
    const parts = [{ text: prompt }];
    
    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: "application/json"
            }
        });
        console.log("Result:", result.text);
    } catch (e) {
        console.error("Gemini crashed:", e);
    }
}
test();
