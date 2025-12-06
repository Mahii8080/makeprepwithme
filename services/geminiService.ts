
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, Feedback, Difficulty } from '../types';

// Lazily initialize GoogleGenAI client so the app doesn't crash at module import in the browser.
// Support both Node-style `process.env.API_KEY` (server) and Vite client env `import.meta.env.VITE_GEMINI_API_KEY` (local/dev).
const getApiKey = () => {
    try {
        // Prefer Node environment variable when available (e.g., server-side execution)
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // ignore
    }

    // Fallback to Vite client env (set in .env.local as VITE_GEMINI_API_KEY). Note: exposing API keys to client is insecure for production.
    // Use this only for local development or when running a secure backend proxy.
    try {
        // import.meta may not be typed here; use any to safely access env
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
        if (meta && meta.env && meta.env.VITE_GEMINI_API_KEY) {
            return meta.env.VITE_GEMINI_API_KEY;
        }
    } catch (e) {
        // ignore
    }

    return '';
};

let ai: any | null = null;
const getAi = () => {
    if (!ai) {
        const apiKey = getApiKey();
        if (!apiKey) {
            // Keep initialization lazy; functions will catch and report errors when using the client.
            console.warn('No Gemini API key found in environment. Set API_KEY (server) or VITE_GEMINI_API_KEY (client .env.local).');
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const model = 'gemini-2.5-flash';

const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: {
            type: Type.STRING,
            description: "A single interview question. No multiple parts, no follow-ups, no numbering."
        }
    },
    required: ["question"]
};

const baseFeedbackSchema = {
    type: Type.OBJECT,
    properties: {
        score: {
            type: Type.INTEGER,
            description: "A score from 0 to 10 for the user's answer. 0 is very poor, 10 is excellent."
        },
        feedback: {
            type: Type.STRING,
            description: "Constructive feedback on the user's answer. Highlight good points and areas for improvement. Be encouraging."
        },
        suggestedAnswer: {
            type: Type.STRING,
            description: "An ideal, well-structured answer to the original question."
        }
    },
    required: ["score", "feedback", "suggestedAnswer"]
};

const visualFeedbackSchema = {
    ...baseFeedbackSchema,
    properties: {
        ...baseFeedbackSchema.properties,
        nonVerbalFeedback: {
            type: Type.STRING,
            description: "Feedback on the user's non-verbal communication (e.g., facial expression, confidence, engagement) based on their image. Comment on their professionalism. Be constructive."
        }
    }
};


const getQuestionGenerationPrompt = (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = []): string => {
    let persona: string;
    let examContext: string = '';
    let avoidRepetitionContext: string = '';
    const isHrInterview = /hr/i.test(subject);

    // List of company names to detect company-specific interviews
    const companyNames = [
        'Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix',
        'TCS', 'Infosys', 'Wipro', 'HCL', 'Cognizant', 'IBM', 'Oracle', 'Accenture'
    ];
    const isCompanyInterview = companyNames.some(company => subject.includes(company));

    // Add context about previously asked questions to avoid repetition
    if (previousQuestions.length > 0) {
        avoidRepetitionContext = `\n\nIMPORTANT: Do NOT ask any of these previously asked questions:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAsk a completely different and new question.`;
    }

    // Special handling for companies
    if (isCompanyInterview) {
        examContext = `You are conducting a technical interview for ${subject}. Ask questions tailored to ${subject}'s typical interview style, focus areas, and coding standards. `;
    }
    // Special handling for competitive exams
    else if (subject === 'GATE Exam' || subject === 'UPSC Exam') {
        const examType = subject === 'GATE Exam' ? 'GATE (Graduate Aptitude Test in Engineering)' : 'UPSC (Union Public Service Commission)';
        examContext = `This is a practice session for ${examType}. Ask questions in the style and format of the actual exam. For GATE: focus on Engineering concepts in a technical depth suitable for the difficulty level. For UPSC: focus on General Knowledge, History, Geography, or Civics. `;
    }
    // HR/behavioral interviews
    if (isHrInterview) {
        examContext += `This is an HR/behavioral interview. Ask a single behavioral question such as "Tell me about yourself", "Describe a time you resolved a conflict", "What are your strengths and weaknesses", "Why do you want this role", or "Describe a challenge you faced". Avoid technical or coding questions. `;
    }

    switch (difficulty) {
        case 'Beginner':
            persona = isHrInterview
                ? "You are a friendly HR interviewer focusing on soft skills and motivations. Keep the tone supportive and ask one behavioral question."
                : "You are a friendly and encouraging interviewer for a beginner candidate. Your goal is to test fundamental knowledge in a non-intimidating way.";
            break;
        case 'Intermediate':
            persona = isHrInterview
                ? "You are a professional HR interviewer. Ask one behavioral or situational question to understand the candidate's experiences, motivations, and values."
                : "You are a professional interviewer for an intermediate-level candidate. Your goal is to assess their practical knowledge and problem-solving skills.";
            break;
        case 'Advanced':
            persona = isHrInterview
                ? "You are a seasoned HR/leadership interviewer. Ask one high-level behavioral question probing leadership, conflict resolution, decision-making, or vision."
                : "You are a senior-level interviewer assessing an expert candidate. Your goal is to probe the depths of their knowledge.";
            break;
    }
    // Make the instruction explicit to avoid multi-question outputs
    // Request a strict JSON reply to force a single, machine-parsable question
    return `${persona} ${examContext}The topic is '${subject}'. 

IMPORTANT: Ask EXACTLY ONE interview question only. Do not ask multiple questions, sub-questions, or follow-up questions. Do not include any numbering, bullets, introductions, or additional commentary.

CRITICAL: Return ONLY a JSON object with a single property named "question". Example: {"question": "What is ...?"}. Do not include any other text or commentary.${avoidRepetitionContext}`;
};


export const generateQuestion = async (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = []): Promise<string> => {
    try {
        const prompt = getQuestionGenerationPrompt(subject, difficulty, previousQuestions);
        const response = await getAi().models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
                temperature: 0.6,
                maxOutputTokens: 120,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const raw = (response.text || '').trim();

        const keepOnlyFirstQuestion = (text: string): string => {
            if (!text) return '';
            let candidate = text.replace(/\s+/g, ' ').trim();
            // Remove any leading numbering or labels
            candidate = candidate.replace(/^[\d]+[\.]?\)?\s*/, '').replace(/^(Question|Q|Ask)[:\s-]*/i, '').trim();
            // Cut anything after connectors that often introduce follow-ups
            candidate = candidate.split(/\b(?:Also|Additionally|And then|Next|Follow up|Follow-up|As well as)\b/i)[0].trim();
            if (candidate.includes('?')) {
                const firstQ = candidate.split('?')[0].trim();
                return firstQ ? `${firstQ}?` : candidate;
            }
            // If no question mark, stop at first sentence end to avoid double prompts
            const sentenceEnd = candidate.search(/[.!]/);
            if (sentenceEnd !== -1) {
                candidate = candidate.slice(0, sentenceEnd + 1).trim();
            }
            return candidate;
        };

        // Prefer the schema-constrained response
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.question === 'string') {
                const single = keepOnlyFirstQuestion(parsed.question);
                if (single) {
                    return single;
                }
            }
        } catch (e) {
            // fall through to sanitization
            console.warn('Failed to parse JSON from model output, falling back to sanitization.');
        }

        // Debug: if model returned multiple question markers, log raw output to help diagnose why multiples appear
        try {
            const questionMarkCount = (raw.match(/\?/g) || []).length;
            const newlineQuestionLines = (raw.match(/\n.*(what|how|why|explain|describe|define)/ig) || []).length;
            if (questionMarkCount > 1 || newlineQuestionLines > 1) {
                // eslint-disable-next-line no-console
                console.warn('Gemini returned multiple-question-like output. Raw response follows:\n', raw);
            }
        } catch (e) {
            // ignore logging errors
        }

        // First, attempt to parse strict JSON as requested in the prompt.
        try {
            // Some models may wrap the JSON in backticks or markdown; try to extract the first JSON object.
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed && typeof parsed.question === 'string' && parsed.question.trim().length > 0) {
                    return parsed.question.trim();
                }
            }
        } catch (e) {
            // fall through to sanitization
            console.warn('Failed to parse JSON from model output, falling back to sanitization.');
        }

        // Fallback sanitization: pick the first real question-like line.
        let cleanText = raw.replace(/^[\d]+[\.]?\)?\s*/, '').replace(/^Question\s+[\d]+[\:\-\s]*/, '').trim();
        const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

        // 1) Prefer the first line that contains a question mark
        let candidateLine = lines.find(l => l.includes('?'));

        // 2) If none found, look for lines containing common question words
        if (!candidateLine) {
            const questionWordRegex = /\b(what|how|why|explain|describe|define|implement|compare|difference|when|where|which)\b/i;
            candidateLine = lines.find(l => questionWordRegex.test(l));
        }

        // 3) If still none, try to find the first numbered item like "1) ..." or "1. ..."
        if (!candidateLine) {
            const numbered = lines.map(l => l.replace(/^[\d]+[\.)]\s*/, '')).find(l => l && l.length > 5);
            candidateLine = numbered || lines[0] || '';
        }

        candidateLine = keepOnlyFirstQuestion(candidateLine || '');

        const question = candidateLine ? (candidateLine.endsWith('?') ? candidateLine : candidateLine + '?') : '';

        if (!question || question === '?') {
            return "I'm having trouble coming up with a question right now. Let's try again in a moment.";
        }

        return question;
    } catch (error) {
        console.error("Error generating question:", error);
        return "I'm having trouble coming up with a question right now. Let's try again in a moment.";
    }
};

export const askCustomQuestion = async (question: string, subject: Subject | string, difficulty: Difficulty): Promise<string> => {
    try {
        const response = await getAi().models.generateContent({
            model,
            contents: `You are an interview coach. Subject focus: ${subject}. Difficulty: ${difficulty}. Answer the user's question directly and concisely (under 150 words). Do not ask follow-up questions. User question: "${question}"`,
            config: {
                temperature: 0.6,
                maxOutputTokens: 220,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const text = (response.text || '').trim();
        if (!text) {
            return "I couldn't generate an answer just now. Please try asking again.";
        }
        return text;
    } catch (error) {
        console.error("Error answering custom question:", error);
        return "Sorry, I hit a snag answering that. Please try again.";
    }
};

const getEvaluationPrompt = (question: string, answer: string, subject: Subject, difficulty: Difficulty, withVisualAnalysis: boolean): string => {
    let evaluationCriteria: string;
    let examContext: string = '';

    // Special handling for competitive exams
    if (subject === 'GATE Exam' || subject === 'UPSC Exam') {
        examContext = `Note: This is a ${subject} practice question. Evaluate answers as an expert in the relevant domain would for that exam. `;
    }

    switch (difficulty) {
        case 'Beginner':
            evaluationCriteria = "Evaluate the answer from the perspective of a beginner. Be encouraging and focus on whether the core concept is understood. Minor inaccuracies can be gently corrected. The suggested answer should be simple, clear, and foundational.";
            break;
        case 'Intermediate':
            evaluationCriteria = "Evaluate the answer for correctness, clarity, and completeness. The candidate should demonstrate a solid grasp of the topic. The suggested answer should be a well-structured, comprehensive response that a competent professional would give.";
            break;
        case 'Advanced':
            evaluationCriteria = "Evaluate the answer critically, as you would for a senior or staff-level candidate. Assess the depth of knowledge, consideration of edge cases, performance implications, and trade-offs. The suggested answer should be expert-level, detailed, and showcase best practices.";
            break;
    }

    let visualAnalysisInstruction = '';
    if (withVisualAnalysis) {
        visualAnalysisInstruction = "Additionally, analyze the candidate's facial expression from the provided image. Comment on their confidence, engagement, and professionalism. Is their expression appropriate for a professional interview setting? Provide this analysis in the 'nonVerbalFeedback' field.";
    }

    return `
        You are an AI Interview Coach for the subject: ${subject}. The interview difficulty is set to ${difficulty}.
        Your task is to evaluate a candidate's answer to a specific interview question.
        ${examContext}${evaluationCriteria}
        ${visualAnalysisInstruction}

        Original Question: "${question}"
        Candidate's Answer: "${answer}"

        Please provide a detailed evaluation in JSON format. The JSON should include:
        1.  A 'score' from 0 to 10.
        2.  Constructive 'feedback' explaining the score.
        3.  A 'suggestedAnswer' that serves as a model response.
        ${withVisualAnalysis ? "4. A 'nonVerbalFeedback' field with your analysis of the candidate's image." : ""}
    `;
};


export const evaluateAnswer = async (question: string, answer: string, subject: Subject, difficulty: Difficulty, imageB64Data?: string | null): Promise<Feedback> => {
    try {
        const withVisualAnalysis = difficulty === 'Advanced' && !!imageB64Data;
        const schema = withVisualAnalysis ? visualFeedbackSchema : baseFeedbackSchema;
        const prompt = getEvaluationPrompt(question, answer, subject, difficulty, withVisualAnalysis);
        
        let requestContents: string | { parts: any[] };

        if (withVisualAnalysis && imageB64Data) {
            requestContents = {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: imageB64Data.split(',')[1], // remove dataURL prefix
                        },
                    }
                ]
            };
        } else {
            requestContents = prompt;
        }

        const response = await getAi().models.generateContent({
            model,
            contents: requestContents,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as Feedback;

    } catch (error) {
        console.error("Error evaluating answer:", error);
        return {
            score: 0,
            feedback: "Sorry, I encountered an error while evaluating your answer. It might be due to a content safety policy or a network issue. Please try a different answer or restart the session.",
            suggestedAnswer: "No suggestion available due to an error.",
            error: true
        };
    }
};
