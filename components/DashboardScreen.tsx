
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Subject, Difficulty, Company, ChatMessage } from '../types';
import { askCustomQuestion } from '../services/geminiService';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { StopIcon } from './icons/StopIcon';
import { getProfileData } from '../services/profileService';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface DashboardScreenProps {
  onStartInterview: (subject: Subject | string, difficulty: Difficulty) => void;
  onViewProfile: () => void;
  onNavigateToResumeScanner: () => void;
}

interface SubjectItem {
  name: Subject;
  icon: string;
}

interface CompanyItem {
  name: string;
  icon: string;
}

interface Category {
  title: string;
  subjects: SubjectItem[];
}

const categories: Category[] = [
  {
    title: 'Engineering',
    subjects: [
      { name: Subject.Java, icon: '☕' },
      { name: Subject.Python, icon: '🐍' },
      { name: Subject.DSA, icon: '📊' },
      { name: Subject.JavaScript, icon: '🟨' },
      { name: Subject.TypeScript, icon: '🟦' },
      { name: Subject.C_Plus_Plus, icon: '⚙️' },
      { name: Subject.C_Sharp, icon: '#️⃣' },
      { name: Subject.Go, icon: '🐹' },
      { name: Subject.Rust, icon: '🦀' },
      { name: Subject.Kotlin, icon: '🤖' },
      { name: Subject.Swift, icon: '🐦' },
      { name: Subject.PHP, icon: '🐘' },
      { name: Subject.Ruby, icon: '💎' },
    ]
  },
  {
    title: 'Professional Skills',
    subjects: [
      { name: Subject.HR, icon: '🤝' },
      { name: Subject.English, icon: '🗣️' },
    ]
  },
  {
    title: 'Competitive Exams',
    subjects: [
      { name: Subject.GATE, icon: '🎓' },
      { name: Subject.UPSC, icon: '🏛️' },
    ]
  }
];

interface CompaniesGroup {
  title: string;
  items: CompanyItem[];
}

const companies: CompaniesGroup[] = [
  {
    title: 'Companies',
    items: [
      { name: Company.Google, icon: '🔵' },
      { name: Company.Microsoft, icon: '🪟' },
      { name: Company.Amazon, icon: '🚀' },
      { name: Company.Apple, icon: '🍎' },
      { name: Company.Meta, icon: '👍' },
      { name: Company.Netflix, icon: '🎬' },
      { name: Company.TCS, icon: '🏢' },
      { name: Company.Infosys, icon: '💼' },
      { name: Company.Wipro, icon: '🌐' },
      { name: Company.HCL, icon: '⚙️' },
      { name: Company.Cognizant, icon: '🧠' },
      { name: Company.IBM, icon: '🖥️' },
      { name: Company.Oracle, icon: '📊' },
      { name: Company.Accenture, icon: '🎯' },
    ]
  }
];

const DifficultyModal: React.FC<{
  subject: string;
  onSelect: (difficulty: Difficulty) => void;
  onClose: () => void;
}> = ({ subject, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in-up">
      <div className="bg-gray-800 rounded-lg p-8 shadow-xl max-w-sm w-full text-center border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">Select Difficulty</h2>
        <p className="text-lg text-gray-300 mb-6">for <span className="font-bold text-blue-400">{subject}</span></p>
        <div className="flex flex-col space-y-4">
          <button onClick={() => onSelect('Beginner')} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
            Beginner
          </button>
          <button onClick={() => onSelect('Intermediate')} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
            Intermediate
          </button>
          <button onClick={() => onSelect('Advanced')} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
            Advanced
          </button>
        </div>
        <button onClick={onClose} className="mt-6 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};


const DashboardScreen: React.FC<DashboardScreenProps> = ({ onStartInterview, onViewProfile, onNavigateToResumeScanner }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [customMessages, setCustomMessages] = useState<ChatMessage[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [customDifficulty, setCustomDifficulty] = useState<Difficulty>('Beginner');
  const [isCustomLoading, setIsCustomLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const handleCustomAskRef = useRef<(val?: string) => void>(() => {});

  const handleDifficultySelect = (difficulty: Difficulty) => {
    if (selectedSubject) {
      onStartInterview(selectedSubject, difficulty);
      setSelectedSubject(null);
    }
  };

  const handleCompanyDifficultySelect = (difficulty: Difficulty) => {
    if (selectedCompany) {
      // Use the company name as the subject for now
      const companyAsSubject = selectedCompany as any as Subject;
      onStartInterview(companyAsSubject, difficulty);
      setSelectedCompany(null);
    }
  };

  const handleCustomAsk = useCallback(async (value?: string) => {
    const question = (value ?? customInput).trim();
    if (!question || isCustomLoading) return;
    setCustomInput('');
    setIsCustomLoading(true);
    setCustomMessages(prev => [...prev, { role: 'user', text: question }]);
    try {
      const answer = await askCustomQuestion(question, customSubject || 'Dashboard Q&A', customDifficulty);
      setCustomMessages(prev => [...prev, { role: 'model', text: answer }]);
    } catch (error) {
      setCustomMessages(prev => [...prev, { role: 'system', text: "Sorry, I couldn't answer that right now. Please try again." }]);
    } finally {
      setIsCustomLoading(false);
    }
  }, [customDifficulty, customInput, customSubject, isCustomLoading]);

  // Keep ref in sync to avoid stale closures in recognition callbacks
  useEffect(() => { handleCustomAskRef.current = handleCustomAsk; }, [handleCustomAsk]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let accumulatedTranscript = '';

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      isListeningRef.current = true;
      accumulatedTranscript = '';
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      const final = accumulatedTranscript.trim();
      if (final && !isCustomLoading) {
        handleCustomAskRef.current(final);
      }
      accumulatedTranscript = '';
    };

    recognition.onerror = () => {
      isStartingRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let newlyFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newlyFinal += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (newlyFinal) {
        accumulatedTranscript += newlyFinal;
      }

      setCustomInput((accumulatedTranscript + interim).trim());
    };

    recognitionRef.current = recognition;
    return () => {
      isStartingRef.current = false;
      try { recognition.abort(); } catch (_) { /* ignore */ }
    };
  }, []); // Run ONCE

  const toggleListen = () => {
    if (!recognitionRef.current || isCustomLoading) return;
    if (isListeningRef.current || isStartingRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    } else {
      isStartingRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Mic start error:', err);
        isStartingRef.current = false;
      }
    }
  };

  return (
    <>
      <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center w-full">
        <header className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4 sm:gap-0">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Welcome Back!</h1>
            <p className="text-md sm:text-lg text-gray-400">Choose your preparation module to get started.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4 self-start sm:self-auto">
            <button
              onClick={onNavigateToResumeScanner}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>📄</span> AI Resume Scanner
            </button>
            <button
              onClick={onViewProfile}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              View Profile
            </button>
          </div>
        </header>
        <div className="w-full max-w-6xl space-y-12">
          {categories.map((category) => (
            <div key={category.title}>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-6 border-b-2 border-gray-700 pb-3">{category.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {category.subjects.map((subject) => (
                  <button
                    key={subject.name}
                    onClick={() => setSelectedSubject(subject.name)}
                    className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-blue-800/50 hover:border-blue-600 transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="text-4xl sm:text-5xl mb-3 transition-transform duration-300 group-hover:scale-110">{subject.icon}</div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">{subject.name}</h3>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Companies Section */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-6 border-b-2 border-gray-700 pb-3">{companies[0].title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {companies[0].items.map((company) => (
                <button
                  key={company.name}
                  onClick={() => setSelectedCompany(company.name as Company)}
                  className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-green-800/50 hover:border-green-600 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="text-4xl sm:text-5xl mb-3 transition-transform duration-300 group-hover:scale-110">{company.icon}</div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">{company.name}</h3>
                </button>
              ))}
            </div>
          </div>



          <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Dashboard Q&A</h2>
                <p className="text-sm text-gray-400">Ask any question directly from the dashboard.</p>
              </div>
              {isCustomLoading && <span className="text-xs text-blue-300 animate-pulse">Thinking...</span>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full sm:w-1/2 bg-gray-700 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Subject/context (e.g., Java, System Design, HR)"
              />
              <select
                value={customDifficulty}
                onChange={(e) => setCustomDifficulty(e.target.value as Difficulty)}
                className="w-full sm:w-1/4 bg-gray-700 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Beginner">Beginner</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={toggleListen}
                className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:bg-gray-600 disabled:cursor-not-allowed`}
                disabled={isCustomLoading}
              >
                {isListening ? <StopIcon /> : <MicrophoneIcon />}
              </button>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomAsk()}
                className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-full py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ask any question..."
                disabled={isCustomLoading}
              />
              <button
                onClick={() => handleCustomAsk()}
                disabled={!customInput.trim() || isCustomLoading}
                className="px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Ask
              </button>
            </div>
            <div className="h-52 overflow-y-auto space-y-3 bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              {customMessages.length === 0 && (
                <div className="text-sm text-gray-500">No questions yet. Try asking about a concept, an interview strategy, or a code snippet.</div>
              )}
              {customMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl text-sm p-3 rounded-lg ${msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.role === 'system'
                      ? 'bg-yellow-700 text-white'
                      : 'bg-gray-700 text-gray-100'
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {selectedSubject && (
        <DifficultyModal
          subject={selectedSubject}
          onSelect={handleDifficultySelect}
          onClose={() => setSelectedSubject(null)}
        />
      )}

      {selectedCompany && (
        <DifficultyModal
          subject={selectedCompany}
          onSelect={handleCompanyDifficultySelect}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </>
  );
};

export default DashboardScreen;
