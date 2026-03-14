
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

async function test() {
  if (!process.env.GEMINI_API_KEY) {
    console.log('No API key found');
    return;
  }
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Say hi',
    });
    console.log('Type of response.text:', typeof response.text);
    if (typeof response.text === 'function') {
      console.log('Response text:', response.text());
    } else {
      console.log('Response text (prop):', response.text);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
