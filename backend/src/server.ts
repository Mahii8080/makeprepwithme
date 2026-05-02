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
    const { userId, subject, company, difficulty, username } = req.body;
    if (!userId || !subject || !difficulty) return res.status(400).json({ error: 'missing fields' });
    
    // Ensure the user exists in the database (Sync from local-only storage if needed)
    await prisma.user.upsert({
      where: { id: userId },
      update: { username: username || 'User' },
      create: { 
        id: userId, 
        email: `${userId}@placeholder.com`, 
        username: username || 'User'
      }
    });

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
    const EMERGENCY_QUESTIONS: any = {
      'JavaScript': [
        "What is the difference between 'let', 'const', and 'var'?",
        "How do you create an array in JavaScript?",
        "What are the basic data types in JavaScript?",
        "How do you write a simple 'for' loop?",
        "How do you add an element to the end of an array?",
        "What is the difference between null and undefined?",
        "How do you write a comment in JavaScript?",
        "What does the 'typeof' operator do?",
        "How do you define a function in JavaScript?",
        "What is string concatenation?"
      ],
      'React': [
        "What is a React component?",
        "How do you pass data from a parent to a child component?",
        "What is JSX?",
        "What is the purpose of the 'useState' hook?",
        "What is the difference between a state and a prop?",
        "How do you render an array of items in React?",
        "What is the default port for a local React app?",
        "How do you handle a click event in a React button?",
        "Can a component have multiple parent components?",
        "What does 'npm run start' do in a React app?"
      ],
      'Python': [
        "What are the basic data types in Python?",
        "How do you define a function in Python?",
        "What is a list and how do you add items to it?",
        "What is the difference between a list and a tuple?",
        "How do you create a dictionary?",
        "How do you comment multiple lines of code?",
        "What does the 'len()' function do?",
        "How do you take user input from the console?",
        "What is the purpose of the 'if' statement?",
        "How do you loop through a list?"
      ],
      'General': [
        `What is the difference between a list and an array in ${subject}?`,
        `Can you explain what a dictionary/hashmap is in ${subject}?`,
        `How do you define a function or method in ${subject}?`,
        `What are the most common data types available in ${subject}?`,
        `Explain the concept of 'loops' in ${subject} with a simple example.`,
        `What is ${subject} and what are its primary use cases?`,
        `How do you handle errors and exceptions in ${subject}?`,
        `Explain memory management briefly in the context of ${subject}.`,
        `What is a package manager, and how is it used in ${subject}?`,
        `Describe the 'if-else' logic structure in ${subject}.`
      ]
    };
    
    const category = Object.keys(EMERGENCY_QUESTIONS).find(k => subject.toString().includes(k)) || 'General';
    const fallbacks = EMERGENCY_QUESTIONS[category];
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
        ? `Ask an EXTREMELY BASIC, BEGINNER-FRIENDLY question about '${subject}'. Focus strictly on core definitions, basic use cases, and introductory concepts. Perfect examples: "What is ${subject}?", "What is the main use of ${subject}?", "What are the basic data types in ${subject}?". Keep it highly conversational, basic, and do NOT ask for code or complex theories.`
        : difficulty === 'Intermediate'
          ? `Ask a practical, RELATABLE question about '${subject}'. Focus on how things are used in real projects. Example: "How do you handle errors in ${subject}?", "What is the difference between a list and an array?".`
          : `Ask an advanced but DIRECT technical question about '${subject}'. Focus on architecture and performance. Example: "How does ${subject} manage memory?", "Explain the trade-offs of using ${subject} for high-traffic apps?".`;

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
- STRICTLY NO BEHAVIORAL QUESTIONS. Do NOT ask about "learning habits", "strengths", "weaknesses", or "experience".
- FOCUS ON CORE TECHNICAL KNOWLEDGE: Ask about data types, syntax, memory, keywords, or specific features of ${subject}.
- FOR BEGINNER LEVEL: If this is the FIRST question (previousQuestions is empty), you may simply ask "What is ${subject} and what is it used for?" or "What are the common data types in ${subject}?".
- Keep the question SHORT and COMPLETE — under 30 words. It MUST end with a question mark (?).
- Do NOT add any preamble, greeting, filler, or commentary.
- Start the question directly.
- Output ONLY the complete question text, nothing else.
${resumeContext}${prevContext}`;

    let question = '';

    if (genai) {
      try {
        const result = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt }
              ]
            }
          ],
          config: {
            temperature: 0.9,
            maxOutputTokens: 500
          }
        });
        const raw = (result.text || '').trim();
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
      } catch (geminiErr: any) {
        console.warn('Gemini generate-question failed, falling back to OpenAI:', geminiErr.message);
      }
    }
    
    if (!question && openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 120,
        });
        question = (response.choices[0].message?.content || '').trim();
      } catch (openaiErr: any) {
        console.warn('OpenAI generate-question failed:', openaiErr.message);
      }
    }
    if (!question) {
      question = getFallbackQuestion();
      console.warn('Both AI generations failed or returned empty. Using fallback question.');
    }

    // Do not cut at the first question mark, as scenario questions often contain multiple sentences.

    return res.json({ question });
  } catch (err: any) {
    console.error('generate error message:', err.message);
    // If it fails (e.g., rate limit, 404, invalid key), fallback to returning a generic question so the interview doesn't stall.
    return res.json({ question: getFallbackQuestion() });
  }
});

app.post('/api/analyze-resume', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const prompt = `You are an expert resume parser. Extract and summarize ALL of the following from this resume document:
1. Full name and contact details (if present)
2. Skills and technical competencies (list all technologies, tools, languages)
3. Programming languages and frameworks (be specific and exhaustive)
4. Key projects — for each project: name, description, and technologies used
5. Work experience — company names, roles, duration, and key responsibilities
6. Education — degree, institution, graduation year

Provide a well-structured, comprehensive plain-text summary optimized for an AI interview coach to generate targeted technical interview questions. Be thorough — include EVERY skill, technology, and project mentioned.`;

    let extracted = '';
    let analysisError: string | null = null;

    // Ensure base64Data is clean (remove data URI scheme prefix if present)
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    // ── Attempt 1: Gemini (supports PDF, images, and more natively) ──
    // Try multiple models in order of preference, falling back when quota is exceeded
    if (genai) {
      const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
      for (const model of GEMINI_MODELS) {
        if (extracted) break;
        try {
          console.log(`Trying Gemini model: ${model}`);
          const result = await genai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: cleanBase64 } }
                ]
              }
            ]
          });
          const text = (result.text || '').trim();
          if (text.length > 50) {
            extracted = text;
            console.log(`Gemini resume analysis successful with model: ${model}`);
          } else {
            throw new Error(`${model} returned an empty or too-short response`);
          }
        } catch (geminiErr: any) {
          const isQuotaError = geminiErr?.message?.includes('429') || geminiErr?.message?.includes('quota') || geminiErr?.message?.includes('RESOURCE_EXHAUSTED');
          if (isQuotaError) {
            console.warn(`${model} quota exceeded, trying next model...`);
            analysisError = `${model} quota exceeded`;
            // Continue to next model
          } else {
            analysisError = geminiErr?.message || `${model} analysis failed`;
            console.warn(`${model} resume analysis failed with non-quota error:`, geminiErr?.message);
            break; // Non-quota error — don't keep trying other models
          }
        }
      }
    }

    // ── Attempt 2: OpenAI vision (images only — PDFs are NOT supported by OpenAI image_url) ──
    const isImage = mimeType.startsWith('image/');
    if (!extracted && openai && isImage) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
            ] as any
          }],
          max_tokens: 1500
        });
        const text = (response.choices[0].message?.content || '').trim();
        if (text.length > 50) {
          extracted = text;
          console.log('OpenAI resume analysis successful');
        } else {
          throw new Error('OpenAI returned an empty response');
        }
      } catch (openaiErr: any) {
        const prevError = analysisError ? `${analysisError} | ` : '';
        analysisError = `${prevError}OpenAI Error: ${openaiErr?.message || 'Analysis failed'}`;
        console.warn('OpenAI resume analysis failed:', openaiErr?.message);
      }
    } else if (!extracted && !isImage) {
      const pdfMsg = 'All Gemini models have exceeded their free-tier quota. PDF analysis requires Gemini. Please wait a few minutes and try again, or upgrade your Gemini API key at https://ai.google.dev/';
      console.log(`PDF resume: ${pdfMsg}`);
      if (!analysisError || analysisError.includes('quota')) {
        analysisError = pdfMsg;
      }
    }

    if (!extracted) {
      const errorMessage = analysisError || 'Unable to analyze resume. Please ensure the backend has an AI key configured and quota available.';
      console.error('Resume analysis failed:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }

    res.json({ extractedText: extracted });
  } catch (err: any) {
    console.error('analyze-resume error:', err);
    const errorMessage = err?.message || 'Failed to analyze resume';
    res.status(500).json({ error: errorMessage });
  }
});


// Evaluate answer server-side and PERSIST to DB
app.post('/api/evaluate-answer', async (req, res) => {
  const { sessionId, userId, question, answer, subject, difficulty, imageB64Data } = req.body;
  
  if (!question || !answer || !subject || !difficulty) {
    return res.status(400).json({ error: 'question, answer, subject & difficulty required' });
  }

  const withVisual = !!imageB64Data;
  const prompt = `You are a professional technical interviewer evaluating a candidate's answer.

Subject: ${subject}
Difficulty Level: ${difficulty}
Question Asked: "${question}"
Candidate's Answer: "${answer}"
${withVisual ? "\nAlso analyze the candidate's facial expression for confidence, eye contact, and engagement from the provided image." : ""}

Evaluate the answer and return a JSON object with exactly these fields:
- "score": integer from 0-10 (0 = completely wrong, 5 = partially correct, 8-9 = very good, 10 = perfect)
- "feedback": string (2-4 sentences) — explain what was correct, what was missing/wrong, and how to improve
- "suggestedAnswer": string (3-6 sentences) — provide a specific, professional improvement of the candidate's answer. This should show "how their answer should have been" for a perfect score.
- "nonVerbalFeedback": ${withVisual ? "string — 1-2 sentences about body language, confidence, eye contact from the image" : "null"}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`;

  try {
    try {
      let result: any;
      
      // 1. Try Gemini first
      if (genai) {
        try {
          const parts: any[] = [{ text: prompt }];
          if (withVisual) {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageB64Data.split(',')[1] || imageB64Data
              }
            });
          }

          const resultRes = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts
              }
            ],
            config: { responseMimeType: 'application/json' }
          });

          const raw = (resultRes.text || '').trim();
          result = JSON.parse(raw.replace(/^```(json)?/, '').replace(/```$/, '').trim());
          console.log('Gemini evaluation successful');
        } catch (geminiErr: any) {
          console.warn('Gemini evaluation failed, trying OpenAI:', geminiErr.message);
        }
      }

      // 2. Try OpenAI if Gemini failed or wasn't available
      if (!result && openai) {
        try {
          const messages: any[] = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
          if (withVisual) {
            messages[0].content.push({
              type: 'image_url',
              image_url: { url: imageB64Data.startsWith('data:') ? imageB64Data : `data:image/jpeg;base64,${imageB64Data}` }
            });
          }
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            response_format: { type: 'json_object' }
          });
          result = JSON.parse(completion.choices[0].message?.content || '{}');
          console.log('OpenAI evaluation successful');
        } catch (openaiErr: any) {
          console.error('OpenAI evaluation failed:', openaiErr.message);
        }
      }

      // 3. Final Fallback: Static Rule-Based Evaluation (if all AIs fail)
      if (!result || typeof result.score !== 'number' || !result.feedback) {
        console.log('Using static evaluation fallback');
        const answerWords = (answer || '').trim().split(/\s+/).length;
        const score = answerWords > 15 ? 8 : answerWords > 5 ? 6 : 3;
        result = {
          score,
          feedback: `(Emergency Mode) Your answer is ${answerWords} words long. ${answerWords > 10 ? 'Good attempt at explaining the concept.' : 'Try to provide more details in your response next time.'} Note: AI services are currently at quota capacity.`,
          suggestedAnswer: `A perfect answer for "${question}" should clearly define the concept, mention its key properties, and provide a real-world example to demonstrate practical knowledge.`,
          nonVerbalFeedback: null
        };
      }

      // ── PERSISTENCE LOGIC ──
      if (result && typeof result.score === 'number' && sessionId && userId) {
        try {
          // 1. Create Question
          const dbQuestion = await prisma.question.create({
            data: {
              sessionId,
              text: question
            }
          });

          // 2. Create Feedback
          await prisma.feedback.create({
            data: {
              sessionId,
              userId,
              questionId: dbQuestion.id,
              score: result.score,
              feedback: result.feedback,
              suggestedAnswer: result.suggestedAnswer
            }
          });
          console.log(`Saved feedback for session ${sessionId}`);
        } catch (dbErr) {
          console.error('Database persistence failed:', dbErr);
        }
      }

      return res.json(result || { score: 5, feedback: 'Evaluation unavailable', suggestedAnswer: 'N/A' });
    } catch (innerErr: any) {
      console.error('Inner evaluation loop error:', innerErr.message);
      return res.json({ score: 5, feedback: 'Error processing AI response', suggestedAnswer: 'N/A' });
    }
  } catch (err: any) {
    console.error('evaluate-answer error:', err.message);
    return res.json({ score: 5, feedback: 'Issue evaluating answer', suggestedAnswer: 'N/A' });
  }
});

app.post('/api/sessions/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;
    const session = await prisma.session.update({
      where: { id },
      data: { endedAt: new Date(), score }
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'failed to end session' });
  }
});

app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await prisma.session.findMany({
      where: { userId },
      include: { feedbacks: true }
    });

    const totalAttempts = sessions.length;
    const totalQuestions = sessions.reduce((acc, s) => acc + s.feedbacks.length, 0);
    const avgScore = sessions.length > 0 
      ? sessions.reduce((acc, s) => acc + (s.score || 0), 0) / sessions.length 
      : 0;

    res.json({
      totalAttempts,
      totalQuestions,
      avgScore,
      sessions: sessions.map(s => ({
        id: s.id,
        subject: s.subject,
        difficulty: s.difficulty,
        score: s.score,
        date: s.startedAt,
        questions: s.feedbacks.length
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch stats' });
  }
});

app.listen(port, () => console.log(`Backend API listening on http://localhost:${port}`));
