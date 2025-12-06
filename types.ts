
export enum Subject {
  // Engineering
  Java = "Java",
  Python = "Python",
  DSA = "Data Structures and Algorithms",
  JavaScript = "JavaScript",
  TypeScript = "TypeScript",
  C_Plus_Plus = "C++",
  C_Sharp = "C#",
  Go = "Go",
  Rust = "Rust",
  Kotlin = "Kotlin",
  Swift = "Swift",
  PHP = "PHP",
  Ruby = "Ruby",

  // Professional Skills
  HR = "HR Interview",
  English = "English Speaking Practice",

  // Competitive Exams
  GATE = "GATE Exam",
  UPSC = "UPSC Exam",
}

export enum Company {
  // Tech Companies
  Google = "Google",
  Microsoft = "Microsoft",
  Amazon = "Amazon",
  Apple = "Apple",
  Meta = "Meta",
  Netflix = "Netflix",
  
  // Indian IT Companies
  TCS = "TCS (Tata Consultancy Services)",
  Infosys = "Infosys",
  Wipro = "Wipro",
  HCL = "HCL Technologies",
  Cognizant = "Cognizant",
  
  // Other Companies
  IBM = "IBM",
  Oracle = "Oracle",
  Accenture = "Accenture",
}

export type View = "login" | "dashboard" | "session" | "profile";
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  feedback?: Feedback;
}

export interface Feedback {
  score: number;
  feedback: string;
  suggestedAnswer: string;
  nonVerbalFeedback?: string;
  error?: boolean;
}

export interface ProfileData {
  username: string;
  interviewsCompleted: number;
  averageScore: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null;
  badges: string[];
  subjectStats: { [key in Subject]?: number };
}