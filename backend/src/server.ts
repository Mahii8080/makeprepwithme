import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
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

    // ── Determine the subject category for richer, topic-specific prompting ──
    const isHR = /hr interview/i.test(subject);
    const isEnglish = /english/i.test(subject);
    const isDSA = /data structure/i.test(subject);
    const isGATE = /gate exam/i.test(subject);
    const isUPSC = /upsc exam/i.test(subject);
    const isResumeInterview = subject === 'Resume Interview';
    const isCompany = ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix',
      'TCS', 'Infosys', 'Wipro', 'HCL', 'Cognizant', 'IBM', 'Oracle', 'Accenture']
      .some(c => subject.includes(c));

    // ── Difficulty-based depth instructions ──
    const depthInstruction =
      difficulty === 'Beginner'
        ? `Ask a BASIC, FUNDAMENTAL question about '${subject}' — definitions, syntax, or simple concepts. Examples of the style: "What is a list in Python?", "What does the final keyword do in Java?", "What is a variable?", "What is an if-else statement?", "What is a function?". The question must be specific to the domain '${subject}'.`
        : difficulty === 'Intermediate'
          ? `Ask an INTERMEDIATE-LEVEL question about '${subject}' that tests practical understanding. Examples of the style: "What is the difference between an abstract class and an interface in Java?", "How does the GIL work in Python?", "What is the time complexity of QuickSort?", "Explain how closures work in JavaScript.". The question must directly target knowledge of '${subject}'.`
          : `Ask an ADVANCED, IN-DEPTH question about '${subject}' that tests expert-level mastery. Examples of the style: "How does Python's memory management and garbage collection work?", "Explain the CAP theorem and when you would choose CP over AP.", "What are the trade-offs between B-Trees and LSM-Trees?", "How does the V8 engine optimize JavaScript execution?". The question must reveal deep expertise in '${subject}'.`;

    // ── Subject-specific topical focus ──
    let topicFocus = '';
    if (isHR) {
      topicFocus = `This is an HR/behavioral interview. Ask ONE behavioral or situational question such as: "Tell me about yourself.", "Describe a time you handled a conflict with a colleague.", "What are your strengths and weaknesses?", "Why do you want this role?", "Where do you see yourself in 5 years?". Do NOT ask technical questions.`;
    } else if (isEnglish) {
      topicFocus = `This is an English speaking practice session. Ask a question that encourages the candidate to speak at length in English, such as: "Can you describe your hometown?", "What are your hobbies and why do you enjoy them?", "Describe the last book you read.", "Tell me about a memorable trip you took.". Keep it conversational and open-ended.`;
    } else if (isDSA) {
      topicFocus = `The topic is Data Structures and Algorithms. Ask a question testing knowledge of arrays, linked lists, stacks, queues, trees, graphs, sorting algorithms, searching algorithms, dynamic programming, recursion, or Big-O complexity. Make the question conceptual or problem-solving based. Examples: "What is the difference between a stack and a queue?", "Explain how a binary search tree works.", "What is dynamic programming?", "What is the time complexity of merge sort and why?"`;
    } else if (isGATE) {
      topicFocus = `This is a GATE exam practice session. Ask a rigorous engineering question covering topics like Operating Systems, Computer Networks, Database Management Systems, Theory of Computation, Digital Logic, or Algorithms. The question should be concise and test deep conceptual understanding.`;
    } else if (isUPSC) {
      topicFocus = `This is a UPSC exam practice session. Ask a question about Indian History, Geography, Indian Polity, Indian Economy, Current Affairs, or General Science. The question must be direct and factual.`;
    } else if (isResumeInterview) {
      topicFocus = `This is a resume-based interview. Ask a question SPECIFICALLY about the technologies, projects, or skills listed in the candidate's resume.`;
    } else if (isCompany) {
      topicFocus = `This is a ${subject} interview. Ask a question tailored to the typical interview style and focus areas of ${subject}. Cover technical concepts, coding principles, system design, or behavioral aspects typical for ${subject} interviews.`;
    } else {
      // Generic programming language or tech subject
      topicFocus = `The interview topic is '${subject}'. Ask a question that tests DIRECT KNOWLEDGE of '${subject}'. Ask about: language-specific features, built-in data types, keywords, operators, common libraries/frameworks, error handling, OOP concepts in ${subject}, memory management, or performance. DO NOT ask generic questions. The question MUST be about '${subject}' specifically.`;
    }

    let prevContext = '';
    if (previousQuestions && previousQuestions.length > 0) {
      prevContext = '\n\nPreviously asked questions (DO NOT repeat any of these):\n' + previousQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n');
    }

    let resumeContext = '';
    if (resumeText) {
      if (isResumeInterview) {
        resumeContext = `\n\nThe candidate's resume/profile is as follows:\n"""\n${resumeText}\n"""\n\nBase your question ENTIRELY on the technologies, projects, and experiences mentioned in this resume.`;
      } else {
        resumeContext = `\n\nThe candidate's resume context:\n"""\n${resumeText}\n"""\n\nThe interview topic is explicitly '${subject}'. You must ask a question specifically testing their knowledge of '${subject}'. You may briefly relate it to their resume if naturally possible, but the question MUST be about '${subject}'.`;
      }
    }

    const prompt = `You are a professional technical interviewer. Your ONLY job is to ask ONE specific, direct interview question.

TOPIC: ${subject}
DIFFICULTY: ${difficulty}

INSTRUCTIONS:
- ${depthInstruction}
- ${topicFocus}
- Ask EXACTLY ONE question. No multiple parts, no sub-questions, no follow-ups.
- Keep the question SHORT and COMPLETE — under 40 words. It MUST end with a question mark (?).
- Do NOT add any preamble, greeting, filler, or commentary (e.g., no "Okay", "Great", "Sure", "Here's your question:", "Alright candidate").
- Start the question directly (e.g., "What is...", "How does...", "Explain...", "What is the difference between...", "Can you describe...").
- Output ONLY the complete question text, nothing else. The question MUST be grammatically complete.
${resumeContext}${prevContext}`;

    let question = '';

    if (genai) {
      const response = await genai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: prompt, 
        config: { 
          temperature: 0.9, 
          maxOutputTokens: 500
        } 
      });
      const raw = (response.text || '').trim();
      console.log('---GEMINI RETURNED---:', raw);
      
      let clean = raw;
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }
      // If it still spit out JSON despite instructions, attempt to parse it
      try {
        const parsed = JSON.parse(clean);
        if (parsed && typeof parsed.question === 'string') {
          question = parsed.question.trim();
        } else {
          question = clean;
        }
      } catch (e: any) {
        question = clean;
      }
    } else if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 120,
      });
      question = (response.choices[0].message?.content || '').trim();
    }



    // Do not cut at the first question mark, as scenario questions often contain multiple sentences.

    return res.json({ question });
  } catch (err: any) {
    console.error('generate error message:', err.message);
    // If it fails (e.g., rate limit, 404, invalid key), fallback to returning a generic question so the interview doesn't stall.
    return res.json({ question: getFallbackQuestion() });
  }
});

app.listen(port, () => console.log(`Backend API listening on http://localhost:${port}`));
