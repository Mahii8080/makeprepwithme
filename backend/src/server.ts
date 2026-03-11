import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

let genai: any = null;
if (process.env.GEMINI_API_KEY) {
  genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { userId, subject, company, difficulty } = req.body;
    if (!userId || !subject || !difficulty) return res.status(400).json({ error: 'missing fields' });
    const session = await prisma.session.create({ data: { userId, subject, company, difficulty } });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/sessions/:id/questions', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const q = await prisma.question.create({ data: { sessionId: id, text } });
    res.json(q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Generate question server-side (calls Gemini if key is present)
app.post('/api/generate-question', async (req, res) => {
  const { subject, difficulty, previousQuestions = [], resumeText } = req.body;
  if (!subject || !difficulty) return res.status(400).json({ error: 'subject & difficulty required' });

  const getFallbackQuestion = () => {
    const fallbacks = [
      `Could you elaborate on your experience with ${subject}?`,
      `What do you consider your greatest strength when working with ${subject}?`,
      `Can you describe a challenging problem you solved related to ${subject}?`,
      `How do you keep your skills sharp and up to date with ${subject}?`,
      `What are some best practices you follow when working with ${subject}?`
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  };

  try {
    // If no AI key available, return a placeholder
    if (!openai && !genai) {
      return res.json({ question: getFallbackQuestion() });
    }

    const persona = difficulty === 'Beginner'
      ? 'friendly interviewer for an entry-level professional. Ask a real, practical conceptual question suitable for a junior role. Do NOT ask trivial definition questions like "What is a variable" or "What is an array".'
      : difficulty === 'Intermediate'
        ? 'professional interviewer for an mid-level candidate. Ask practical, somewhat challenging questions.'
        : 'senior-level interviewer assessing an expert candidate. Ask deep, complex questions about architecture, trade-offs, and advanced topics.';
    let prevContext = '';
    if (previousQuestions && previousQuestions.length > 0) {
      prevContext = '\n\nPreviously asked questions:\n' + previousQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') + '\n\nDo not repeat these.';
    }

    let resumeContext = '';
    if (resumeText) {
      if (subject === 'Resume Interview') {
        resumeContext = `\n\nThe candidate's resume/profile is as follows:\n"""\n${resumeText}\n"""\n\nCRITICAL: You MUST base your question entirely on the technologies, projects, and experiences mentioned in this resume.`;
      } else {
        resumeContext = `\n\nThe candidate's resume/profile is as follows:\n"""\n${resumeText}\n"""\n\nCRITICAL: The interview topic is explicitly '${subject}'. You must ask a question broadly testing their knowledge of '${subject}'. You may briefly relate the question to their resume experience if possible, but the core topic MUST be '${subject}'.`;
      }
    }

    const prompt = `You are a ${persona}. The topic is '${subject}'. Ask EXACTLY ONE interview question only. Return only the question itself. ${resumeContext}${prevContext}`;

    let question = '';

    if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 120,
      });
      question = (response.choices[0].message?.content || '').trim();
    } else if (genai) {
      const response = await genai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { temperature: 0.8, maxOutputTokens: 120 } });
      const raw = (response.text || '').trim();
      question = raw;

      // try parse JSON or fallback to first line until first ?
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.question === 'string') question = parsed.question.trim();
        }
      } catch (e) {
        // ignore
      }
    }

    // fallback cut at first ?
    if (question.includes('?')) question = question.split('?')[0].trim() + '?';

    return res.json({ question });
  } catch (err: any) {
    console.error('generate error message:', err.message);
    // If it fails (e.g., rate limit, 404, invalid key), fallback to returning a generic question so the interview doesn't stall.
    return res.json({ question: getFallbackQuestion() });
  }
});

app.listen(port, () => console.log(`Backend API listening on http://localhost:${port}`));
