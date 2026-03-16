
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function test() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Testing key:', key ? key.substring(0, 5) + '...' : 'NONE');
  if (!key) return;

  const genAI = new GoogleGenAI(key);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say hello world');
    console.log('Response:', result.response.text());
  } catch (e) {
    console.error('Gemini Error:', e.message);
  }
}

test();
