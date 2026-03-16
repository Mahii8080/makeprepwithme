
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;

  const client = new GoogleGenAI({ apiKey: key });
  try {
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'Tell me a joke'
    });
    console.log('Response:', response.text);
  } catch (e) {
    console.error('Error Status:', e.status);
    console.error('Error Message:', e.message);
  }
}

test();
