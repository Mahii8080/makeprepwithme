
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function test() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OpenAI API key');
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hi' }]
    });
    console.log('OpenAI Response:', res.choices[0].message.content);
  } catch (e) {
    console.error('OpenAI Error:', e.message);
  }
}

test();
