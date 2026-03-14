
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { Subject, Feedback, Difficulty } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseAiJson = (text: string) => {
    try {
        // Remove markdown code blocks if present
        let clean = text.trim();
        if (clean.startsWith('```')) {
            clean = clean.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        return JSON.parse(clean);
    } catch (e) {
        console.error("AI: Failed to parse JSON response:", text);
        throw e;
    }
};

// ── API Key Setup ────────────────────────────────────────────────────────────

const getGeminiApiKey = () => {
    // Primary: Vite exposes env vars via import.meta.env with VITE_ prefix
    try {
        const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
        if (meta?.env?.VITE_GEMINI_API_KEY) {
            return meta.env.VITE_GEMINI_API_KEY;
        }
    } catch (e) { /* ignore */ }

    // Secondary: process.env fallback (SSR / Node)
    try {
        if (typeof process !== 'undefined' && process.env) {
            const key = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
            if (key) return key;
        }
    } catch (e) { /* ignore */ }

    console.error('GeminiService: No Gemini API key found! Check VITE_GEMINI_API_KEY in .env.local');
    return '';
};

const getOpenAiApiKey = () => {
    // 1. Try process.env (Vite-defined or Node)
    if (typeof process !== 'undefined' && process.env) {
        const key = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (key && key !== 'your_openai_api_key_here') return key;
    }

    // 2. Try import.meta.env (Vite standard)
    try {
        const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
        if (meta?.env?.VITE_OPENAI_API_KEY && meta.env.VITE_OPENAI_API_KEY !== 'your_openai_api_key_here') {
            return meta.env.VITE_OPENAI_API_KEY;
        }
    } catch (e) { /* ignore */ }

    return '';
};

// ── Clients ──────────────────────────────────────────────────────────────────

let genAI: any | null = null;
let genAIKey: string = '';
const getGenAI = () => {
    const apiKey = getGeminiApiKey();
    // Re-initialize if key changed or was missing before
    if (!genAI || apiKey !== genAIKey) {
        genAIKey = apiKey;
        genAI = new GoogleGenAI({ apiKey });
    }
    return genAI;
};

let openaiClient: OpenAI | null = null;
const getOpenAI = () => {
    if (!openaiClient) {
        const apiKey = getOpenAiApiKey();
        if (apiKey && apiKey !== 'your_openai_api_key_here') {
            openaiClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        }
    }
    return openaiClient;
};

const GEMINI_MODEL = 'gemini-2.0-flash';
const OPENAI_MODEL = 'gpt-4o-mini';

const EMERGENCY_QUESTIONS: Record<string, Record<Difficulty, string[]>> = {
    'JavaScript': {
        'Beginner': [
            "What is the difference between 'let', 'const', and 'var'?",
            "How do you create an array in JavaScript?",
            "What are the basic data types in JavaScript?",
            "How do you write a simple 'for' loop?"
        ],
        'Intermediate': [
            "Can you explain the concept of closures in JavaScript?",
            "How does the 'this' keyword work in different contexts?",
            "Explain the difference between '==' and '==='.",
            "What is the difference between an arrow function and a regular function?"
        ],
        'Advanced': [
            "What is the Event Loop and how does it handle asynchronous code?",
            "Explain prototypal inheritance in JavaScript.",
            "How do generators and iterators work?",
            "What are WeakMaps and WeakSets, and when should you use them?"
        ]
    },
    'React': {
        'Beginner': [
            "What is a React component?",
            "How do you pass data from a parent to a child component?",
            "What is JSX?",
            "What is the purpose of the 'useState' hook?"
        ],
        'Intermediate': [
            "What are the main differences between Functional and Class components?",
            "Explain the purpose and usage of the useEffect hook.",
            "How do you handle forms in React?",
            "What is the purpose of 'keys' in React lists?"
        ],
        'Advanced': [
            "What is the Virtual DOM and how does it improve performance?",
            "How do you manage state across multiple components using Context API or Redux?",
            "Explain React's 'reconciliation' process.",
            "When and why would you use useMemo or useCallback hooks?"
        ]
    },
    'Python': {
        'Beginner': [
            "What are the basic data types in Python?",
            "How do you define a function in Python?",
            "What is a list and how do you add items to it?",
            "What is the difference between a list and a tuple?"
        ],
        'Intermediate': [
            "How do you manage dependencies and environments in Python?",
            "Explain the concept of list comprehensions.",
            "What is the difference between deep copy and shallow copy?",
            "How do you handle exceptions in Python using try-except?"
        ],
        'Advanced': [
            "Explain the concept of decorators in Python.",
            "How does Python's Global Interpreter Lock (GIL) work?",
            "What are metaclasses and when would you use them?",
            "Explain the difference between @staticmethod and @classmethod."
        ]
    },
    'General': {
        'Beginner': [
            "What is a variable?",
            "What is the purpose of a function?",
            "How do you comment your code?",
            "What is a 'string' in programming?"
        ],
        'Intermediate': [
            "Tell me about a challenging technical problem you solved recently.",
            "How do you stay updated with the latest trends in software development?",
            "Explain the difference between a stack and a queue.",
            "What is the purpose of version control like Git?"
        ],
        'Advanced': [
            "Explain the principles of Object-Oriented Programming (OOP).",
            "How would you describe your process for debugging a complex issue?",
            "Explain the SOLID principles of software design.",
            "What is the difference between Monolithic and Microservices architecture?"
        ]
    }
};

// ── Schemas ──────────────────────────────────────────────────────────────────

const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: {
            type: Type.STRING,
            description: "A single interview question."
        }
    },
    required: ["question"]
};

// ── Prompts ──────────────────────────────────────────────────────────────────

const getQuestionGenerationPrompt = (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = [], resumeText?: string): string => {
    let persona: string;
    let resumeContext = resumeText ? `\n\nCandidate Profile:\n${resumeText}\n\nAsk questions based on this profile.` : '';
    let avoidRepetition = previousQuestions.length > 0 ? `\n\nAvoid these questions:\n${previousQuestions.join('\n')}` : '';

    switch (difficulty) {
        case 'Beginner': 
            persona = "Extremely basic entry-level interviewer. Focus ONLY on core syntax, basic definitions, and fundamental concepts that a Day 1 learner would know. Strictly avoid complex logic or frameworks."; 
            break;
        case 'Intermediate': 
            persona = "Professional mid-level interviewer. Focus on practical application, problem-solving, common libraries, and best practices."; 
            break;
        case 'Advanced': 
            persona = "Senior technical architect or Lead developer. Focus on internal architecture, high-level design patterns, performance optimization, and complex edge cases."; 
            break;
        default: 
            persona = "Professional interviewer.";
    }

    return `${persona} Topic: '${subject}'. Level to target: '${difficulty}'. ${resumeContext}${avoidRepetition} 
    
    IMPORTANT: Ask EXACTLY ONE interview question. For BEGINNER level, if no previous questions are listed, you may ask "What is ${subject} and what is it used for?". Keep the question under 30 words. Return ONLY a JSON object with a single property "question". No extra text.`;
};

// ── Core Functions ───────────────────────────────────────────────────────────

export const generateQuestion = async (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = [], resumeText?: string): Promise<string> => {
    // ── PRIMARY: Try backend API for specialized question generation ──
    try {
        const response = await fetch('http://localhost:4000/api/generate-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, difficulty, previousQuestions, resumeText }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.question === 'string') {
                console.log('Question generated by backend successfully.');
                return data.question;
            }
        }
    } catch (err) {
        console.warn('Backend generate-question failed, falling back to direct AI:', err);
    }

    // ── SECONDARY: Direct Gemini call ──
    const prompt = getQuestionGenerationPrompt(subject, difficulty, previousQuestions, resumeText);
    try {
        const response = await getGenAI().models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
            }
        });
        const jsonText = response.text;
        const parsed = parseAiJson(jsonText);
        if (parsed.question) return parsed.question;
    } catch (geminiError: any) {
        console.warn("Gemini direct failed, falling back to OpenAI:", geminiError?.message || geminiError);
    }

    // 2. Fallback to OpenAI
    const openai = getOpenAI();
    if (openai) {
        try {
            console.log("AI: Gemini failed. Falling back to OpenAI (GPT)...");
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "You are a professional interviewer. Respond only in raw JSON format." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content || '{}';
            const parsed = parseAiJson(content);
            if (parsed.question) {
                console.log("AI: OpenAI successfully generated the question.");
                return parsed.question;
            }
        } catch (openaiError: any) {
            console.error("AI: OpenAI fallback failed:", openaiError?.message || openaiError);
        }
    } else {
        console.warn("AI: OpenAI fallback skipped (No API Key found).");
    }

    console.warn("AI: Both Gemini and OpenAI failed. Entering Emergency Basic Mode.");

    // 3. Final Emergency Fallback (Static Content)
    const category = Object.keys(EMERGENCY_QUESTIONS).find(k => subject.toString().includes(k)) || 'General';
    const emergencySet = EMERGENCY_QUESTIONS[category][difficulty];
    const randomIndex = Math.floor(Math.random() * emergencySet.length);
    return emergencySet[randomIndex];
};

export const evaluateAnswer = async (question: string, answer: string, subject: Subject | string, difficulty: Difficulty, imageB64Data?: string | null, sessionId?: string, userId?: string): Promise<Feedback> => {
    // ── PRIMARY: Call the backend API (avoids CORS errors when calling AI from browser) ──
    try {
        const response = await fetch('http://localhost:4000/api/evaluate-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, answer, subject, difficulty, imageB64Data, sessionId, userId }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.score === 'number' && data.feedback) {
                console.log('Feedback received from backend successfully.');
                return data as Feedback;
            }
        } else {
            console.warn('Backend evaluate-answer returned non-OK status:', response.status);
        }
    } catch (backendError: any) {
        console.warn('Backend evaluate-answer failed, trying direct AI:', backendError?.message);
    }

    // ── FALLBACK: Try Gemini directly (only works if CORS permits) ──
    const withVisual = difficulty === 'Advanced' && !!imageB64Data;
    const prompt = `You are a professional technical interviewer evaluating a candidate's answer.

Subject: ${subject}
Difficulty Level: ${difficulty}
Question Asked: "${question}"
Candidate's Answer: "${answer}"
${withVisual ? "\nAlso analyze the candidate's facial expression for confidence, eye contact, and engagement." : ""}

Evaluate the answer and return a JSON object with exactly these fields:
- "score": integer from 0-10 (0 = completely wrong, 5 = partially correct, 8-9 = very good, 10 = perfect)
- "feedback": string (2-4 sentences) — explain what was correct, what was missing/wrong, and how to improve
- "suggestedAnswer": string (3-6 sentences) — provide a clear, complete model answer the candidate should have given
${withVisual ? '- "nonVerbalFeedback": string — 1-2 sentences about body language, confidence, eye contact from the video' : '- "nonVerbalFeedback": null'}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`;

    try {
        const parts: any[] = [{ text: prompt }];
        if (withVisual && imageB64Data) {
            parts.push({
                inlineData: { mimeType: 'image/jpeg', data: imageB64Data.split(',')[1] }
            });
        }
        const response = await getGenAI().models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts }],
            config: { responseMimeType: "application/json" }
        });
        return parseAiJson(response.text);
    } catch (e: any) {
        console.warn("Direct Gemini evaluation failed:", e?.message || e);
    }

    // ── FINAL FALLBACK: OpenAI ──
    const openaiClient = getOpenAI();
    if (openaiClient) {
        try {
            const completion = await openaiClient.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown blocks." }],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content || '{}';
            return parseAiJson(content);
        } catch (e: any) {
            console.error("OpenAI evaluation failed:", e?.message || e);
        }
    }

    return {
        score: 5,
        feedback: "Could not reach the AI service. Please ensure the backend server is running on port 4000.",
        suggestedAnswer: "Restart the backend server and try again.",
        error: true
    };
};

export const askCustomQuestion = async (question: string, subject: Subject | string, difficulty: Difficulty): Promise<string> => {
    const prompt = `You are an interview coach. Answer: "${question}" for ${subject} (${difficulty}). Concise, under 150 words.`;

    try {
        const response = await getGenAI().models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return response.text();
    } catch (e) {
        const openai = getOpenAI();
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [{ role: "user", content: prompt }]
                });
                return completion.choices[0].message.content || "Error.";
            } catch (e2) {}
        }
    }
    return "I hit a snag. Please check your connection.";
};

export const analyzeResumeFile = async (base64Data: string, mimeType: string): Promise<string> => {
    try {
        const response = await getGenAI().models.generateContent({
            model: GEMINI_MODEL,
            contents: [{
                parts: [
                    { text: "Extract skills, technologies, and projects from this resume. Return a well-formatted summary." },
                    { inlineData: { mimeType, data: base64Data } }
                ]
            }]
        });
        return response.text();
    } catch (e) {
        // Fallback to OpenAI Vision (requires different format)
        const openai = getOpenAI();
        if (openai && mimeType.startsWith('image/')) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: "Extract skills and projects from this resume." },
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                        ]
                    }]
                });
                return completion.choices[0].message.content || "Error.";
            } catch (e2) {}
        }
        throw new Error("Failed to process resume. Try using a clear image.");
    }
};
