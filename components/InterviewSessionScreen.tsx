
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Subject, ChatMessage, Feedback, Difficulty } from '../types';
import { generateQuestion, evaluateAnswer } from '../services/geminiService';
import { updateProfileOnSessionEnd, getProfileData } from '../services/profileService';
import { Avatar, AvatarState } from './Avatar';
import { ThreeAvatar } from './ThreeAvatar';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { FeedbackCard } from './FeedbackCard';
import { WebcamMonitor } from './WebcamMonitor';

// SpeechRecognition type shims
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface InterviewSessionScreenProps {
  subject: Subject | string;
  difficulty: Difficulty;
  onEndSession: () => void;
}

const speakingAvatarStates: AvatarState[] = ['speaking', 'speaking_o', 'speaking_e', 'speaking_m'];

const InterviewSessionScreen: React.FC<InterviewSessionScreenProps> = ({ subject, difficulty, onEndSession }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [showNextQuestionButton, setShowNextQuestionButton] = useState(false);
  const [isUserPresent, setIsUserPresent] = useState(true);
  const [absentLimitReached, setAbsentLimitReached] = useState(false);
  const [usePhotoMode, setUsePhotoMode] = useState(false);

  // Refs — stable across renders
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);       // mirror of isListening for use inside recognition callbacks
  const isStartingRef = useRef(false);        // prevent double-start InvalidStateError
  const isLoadingRef = useRef(false);          // mirror of isLoading
  const showNextRef = useRef(false);           // mirror of showNextQuestionButton
  const handleSubmitRef = useRef<(text: string) => void>(() => {});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionScores = useRef<number[]>([]);
  const previousQuestionsRef = useRef<string[]>([]);
  const absentCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouthShapeIndex = useRef(0);
  const hasInitializedRef = useRef(false);

  // Keep mirror refs in sync
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { showNextRef.current = showNextQuestionButton; }, [showNextQuestionButton]);

  // ── Speech synthesis ───────────────────────────────────────────────────────
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      // Safety timeout: resolve if speech synthesis hangs for more than 15s
      const timeout = setTimeout(() => {
        console.warn('Speech synthesis timed out.');
        setAvatarState('idle');
        resolve();
      }, 15000);

      utterance.onstart = () => setAvatarState('speaking');
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          mouthShapeIndex.current = (mouthShapeIndex.current + 1) % speakingAvatarStates.length;
          setAvatarState(speakingAvatarStates[mouthShapeIndex.current]);
        }
      };
      utterance.onend = () => { 
        clearTimeout(timeout);
        setAvatarState('idle'); 
        resolve(); 
      };
      utterance.onerror = (err) => { 
        console.error('Speech synthesis error:', err);
        clearTimeout(timeout);
        setAvatarState('idle'); 
        resolve(); 
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── SpeechRecognition — created ONCE, never recreated ─────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let accumulatedTranscript = '';

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      isListeningRef.current = true;
      setAvatarState('listening'); // AI mentor also enters listening state
      accumulatedTranscript = '';
      setMicError('');
      setUserInput('');
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interimFound = '';
      let newlyFinal = '';

      // Only process results starting from event.resultIndex (new results)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newlyFinal += transcript + ' ';
        } else {
          interimFound += transcript;
        }
      }

      if (newlyFinal) {
        accumulatedTranscript += newlyFinal;
      }

      const display = (accumulatedTranscript + interimFound).trim();
      setUserInput(display);
      setInterimTranscript(interimFound);
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript('');

      const finalText = accumulatedTranscript.trim();
      if (finalText && !isLoadingRef.current && !showNextRef.current) {
        handleSubmitRef.current(finalText);
      }
      accumulatedTranscript = '';
    };

    recognition.onerror = (event: any) => {
      isStartingRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;

      const silentErrors = ['aborted', 'no-speech'];
      if (!silentErrors.includes(event.error)) {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Microphone access denied. Please allow mic access in your browser settings and reload.');
        } else if (event.error === 'network') {
          setMicError('Network error. Check your connection.');
        } else {
          setMicError(`Mic issues: ${event.error}.`);
        }
      }
      setInterimTranscript('');
      accumulatedTranscript = '';
    };

    recognitionRef.current = recognition;
    return () => {
      isStartingRef.current = false;
      try { recognition.abort(); } catch (_) { /* ignore */ }
    };
  }, []); // <-- EMPTY dep array: create recognition exactly once

  // ── Mic control helpers ───────────────────────────────────────────────────
  const startListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition not available. Please use Chrome or Edge.');
      return;
    }
    if (isListeningRef.current || isStartingRef.current) return;
    setMicError('');
    setUserInput('');
    setInterimTranscript('');
    isStartingRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      console.error('Failed to start recognition:', err);
      isStartingRef.current = false;
      setMicError('Could not start microphone. Please try again.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListeningRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
    }
  };

  const toggleListen = () => {
    if (isLoading) return; // blocked while AI is thinking/evaluating
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (text: string) => {
    const currentInput = text.trim();
    if (!currentInput || isLoadingRef.current) return;

    try {
      setUserInput('');
      setInterimTranscript('');
      setIsLoading(true);
      setAvatarState('thinking');

      // Find the last question asked by the model locally
      const lastQuestion = [...messages].reverse().find(m => m.role === 'model')?.text;
      
      // If we can't find it in local state (rare race condition), check the ref
      const targetQuestion = lastQuestion || previousQuestionsRef.current[previousQuestionsRef.current.length - 1];

      if (!targetQuestion) {
        console.warn('Could not find the last question. Evaluating feedback based on context...');
      }

      setMessages(prev => [...prev, { role: 'user', text: currentInput } as ChatMessage]);

      const imageB64Data = difficulty === 'Advanced' ? captureFrame() : null;
      const feedback: Feedback = await evaluateAnswer(targetQuestion || 'the previous topic', currentInput, subject, difficulty, imageB64Data);

      if (!feedback.error) sessionScores.current.push(feedback.score);

      if (feedback.error) {
        setAvatarState('confused');
      } else if (feedback.score >= 8) {
        setAvatarState('happy');
      } else if (feedback.score >= 5) {
        setAvatarState('encouraging');
      } else {
        setAvatarState('serious');
      }

      await new Promise(resolve => setTimeout(resolve, 800));

      setMessages(prev => [...prev, {
        role: 'system',
        text: 'Review your feedback:',
        feedback,
      } as ChatMessage]);

      await speak(
        feedback.feedback +
        (feedback.nonVerbalFeedback ? ` Now, regarding your on-camera presence: ${feedback.nonVerbalFeedback}` : '')
      );
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        text: 'I ran into an issue evaluating that. Let\'s move to the next question.' 
      } as ChatMessage]);
    } finally {
      setIsLoading(false);
      setAvatarState('idle');
      setShowNextQuestionButton(true);
    }
  }, [messages, subject, difficulty, speak]);

  // Keep the ref always pointing at the latest handleSubmit
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  // ── Start new question turn ───────────────────────────────────────────────
  const startNewTurn = useCallback(async () => {
    setShowNextQuestionButton(false);
    setIsLoading(true);
    const resumeText = getProfileData().resumeText;
    const question = await generateQuestion(subject, difficulty, previousQuestionsRef.current, resumeText);
    previousQuestionsRef.current.push(question);
    setMessages(prev => [...prev, { role: 'model', text: question }]);
    setIsLoading(false);
    setShowNextQuestionButton(false); // ensure we don't show "Next" if we failed
    await speak(question);
    
    // Auto-start microphone after AI finishes speaking
    if (!isListeningRef.current && !isLoadingRef.current) {
      startListening();
    }
  }, [subject, difficulty, speak]);

  const handleRetry = () => {
    // Remove the last error message from the chat history
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'model' && last.text.includes('[Error:')) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    startNewTurn();
  };

  // ── Frame capture (Advanced mode) ─────────────────────────────────────────
  const captureFrame = (): string | null => {
    if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    }
    return null;
  };

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    setMessages([{ role: 'system', text: `Starting a new ${difficulty} session for ${subject}. Let's begin.` }]);
    startNewTurn();
    return () => { window.speechSynthesis.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Webcam handlers
  const handleUserPresent = () => { absentCountRef.current = 0; setIsUserPresent(true); };
  const handleUserNotPresent = () => {
    absentCountRef.current += 1;
    setIsUserPresent(false);
    if (absentCountRef.current >= 10) {
      setAbsentLimitReached(true);
      setTimeout(() => handleEndSessionClick(), 1200);
    }
  };

  const handleEndSessionClick = () => {
    if (sessionScores.current.length > 0) {
      const avg = sessionScores.current.reduce((a, b) => a + b, 0) / sessionScores.current.length;
      updateProfileOnSessionEnd(subject, avg);
    }
    window.speechSynthesis.cancel();
    stopListening();
    onEndSession();
  };

  // ── Shared mic button ─────────────────────────────────────────────────────
  const MicButton = ({ large = false }: { large?: boolean }) => (
    <button
      onClick={toggleListen}
      disabled={isLoading}
      title={isListening ? 'Stop recording' : 'Start recording'}
      className={`relative flex items-center justify-center rounded-full transition-all transform hover:scale-105
        ${large ? 'w-16 h-16 sm:w-20 sm:h-20' : 'p-3'}
        ${isListening
          ? 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/40'
          : 'bg-blue-600 hover:bg-blue-500'}
        disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100`}
    >
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-400 opacity-40 animate-ping" />
          <span className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-ping" style={{ animationDelay: '0.4s' }} />
        </>
      )}
      {isListening
        ? <StopIcon className={large ? 'w-8 h-8 sm:w-10 sm:h-10 text-white relative z-10' : 'text-white relative z-10'} />
        : <MicrophoneIcon className={large ? 'w-8 h-8 sm:w-10 sm:h-10 text-white' : 'text-white'} />
      }
    </button>
  );

  // ── ADVANCED mode layout ──────────────────────────────────────────────────
  if (difficulty === 'Advanced') {
    const lastMessage = messages[messages.length - 1];
    const feedbackToShow = lastMessage?.feedback;

    return (
      <div className="flex flex-col h-screen bg-black relative overflow-hidden">
        {absentLimitReached && (
          <div className="absolute inset-0 bg-black bg-opacity-90 z-40 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-8 shadow-xl max-w-sm w-full text-center border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-2">Session Ended</h2>
              <p className="text-sm text-gray-300 mb-4">You were away from the camera too many times.</p>
              <div className="text-gray-400 text-sm">Redirecting...</div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <header className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{subject}</h1>
            <span className="text-sm font-semibold px-2 py-1 rounded-md bg-red-600">{difficulty}</span>
          </div>
          <button onClick={handleEndSessionClick} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            End Session
          </button>
        </header>

        <div className="flex-1 flex items-stretch justify-center relative px-6">
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-lg w-full flex flex-col items-center">
              <div className="w-full max-w-sm aspect-[3/4] bg-blue-900/10 rounded-xl border border-blue-500/20 shadow-2xl overflow-hidden backdrop-blur-md relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                {usePhotoMode
                  ? <img src="/cartoon-3d-avatar.png" alt="AI Interviewer" className="w-full h-full object-cover" />
                  : <ThreeAvatar state={avatarState} />
                }
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${avatarState !== 'idle' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-xs font-semibold text-blue-200 tracking-wider uppercase">AI Interviewer</span>
                  </div>
                  <button onClick={() => setUsePhotoMode(v => !v)} className="text-[10px] bg-blue-600/40 hover:bg-blue-600/60 text-white px-2 py-1 rounded border border-blue-400/30 transition-colors">
                    {usePhotoMode ? 'Switch to 3D' : 'Ultra Realistic'}
                  </button>
                </div>
              </div>
              <p className="mt-4 text-gray-300 text-center font-medium tracking-wide">
                {avatarState.charAt(0).toUpperCase() + avatarState.slice(1).replace(/_./g, c => ' ' + c[1].toUpperCase())}...
              </p>
            </div>
          </div>

          <div className="w-80 md:w-96 p-4 flex items-center justify-center">
            <div className="w-full h-full border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl bg-black">
              <WebcamMonitor ref={videoRef} onUserPresent={handleUserPresent} onUserNotPresent={handleUserNotPresent} />
            </div>
          </div>

          {!isUserPresent && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 p-2 bg-yellow-600/90 text-white text-center rounded-md font-semibold animate-pulse">
              Please remain visible to the camera.
            </div>
          )}
        </div>

        <div className="w-full p-6 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col items-center z-20">
          {(!feedbackToShow && lastMessage?.role === 'model' && lastMessage.text) && (
            <div className="w-full max-w-3xl mb-3 p-3 bg-gray-800/60 border border-gray-700 rounded-lg text-white text-sm">
              <div className="text-xs text-gray-300 font-semibold mb-1">Question</div>
              <div className="truncate" title={lastMessage.text}>{lastMessage.text}</div>
            </div>
          )}

          {/* Live status / transcript area */}
          <div className="text-center text-white text-lg sm:text-xl font-medium mb-4 min-h-[3rem] p-2 flex items-center justify-center">
            {isLoading
              ? <span className="text-gray-400 animate-pulse">Thinking...</span>
              : isListening
                ? <span className="text-blue-300 italic">{userInput || interimTranscript || <span className="text-gray-400">Listening — speak now</span>}</span>
                : showNextQuestionButton
                  ? <span className="text-gray-400 text-base">Review your feedback below.</span>
                  : micError
                    ? <span className="text-red-400 text-sm">{micError}</span>
                    : lastMessage?.role === 'model' && lastMessage.text && lastMessage.text.includes('[Error:')
                      ? <button onClick={handleRetry} className="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-full font-bold animate-bounce transition-colors">
                          ⚠️ Error Occurred — Tap to Retry
                        </button>
                      : <span className="text-gray-500 text-base">Wait for AI or press the mic to skip wait</span>}
          </div>

          <div className="flex flex-col items-center gap-2">
            <MicButton large />
            <p className="text-gray-500 text-sm h-5">
              {isListening
                ? '🔴 Recording — pause briefly when done to auto-submit'
                : isLoading ? ''
                : 'Tap mic, speak your answer, then pause — it will auto-submit'}
            </p>
          </div>
        </div>

        {feedbackToShow && showNextQuestionButton && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-30 p-4">
            <div className="max-w-2xl w-full">
              <FeedbackCard feedback={feedbackToShow} />
              <div className="flex justify-center mt-6">
                <button onClick={startNewTurn} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full transition-colors text-lg">
                  Next Question
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── BEGINNER / INTERMEDIATE layout ────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen p-4 bg-gray-900 relative">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{subject}</h1>
          <span className={`text-sm font-semibold px-2 py-1 rounded-md ${difficulty === 'Beginner' ? 'bg-green-600' : 'bg-yellow-600'}`}>
            {difficulty}
          </span>
        </div>
        <button onClick={handleEndSessionClick} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          End Session
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">

          {/* Avatar panel */}
          <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-slate-900 rounded-xl p-3 space-y-3">
            <div className="w-full max-w-xs aspect-[3/4] bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border border-slate-600/40 overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none z-10" />
              {/* Default: premium 2D SVG mentor. Alternate: 3D Studio */}
              {!usePhotoMode
                ? <Avatar state={avatarState} sizeClassName="w-full h-full" />
                : <ThreeAvatar state={avatarState} />
              }
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end z-20">
                <div className="flex items-center gap-2 px-1">
                  <div className={`w-2 h-2 rounded-full ${avatarState !== 'idle' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-[11px] font-bold text-blue-200 tracking-widest uppercase">AI Mentor</span>
                </div>
                <button onClick={() => setUsePhotoMode(v => !v)} className="text-[9px] bg-blue-600/40 hover:bg-blue-500/60 text-white px-2 py-0.5 rounded-full border border-blue-400/30 transition-colors">
                  {usePhotoMode ? '2D View' : '3D Studio'}
                </button>
              </div>
            </div>
            <p className="text-gray-400 text-center animate-pulse h-6">
              {avatarState.charAt(0).toUpperCase() + avatarState.slice(1).replace(/_./g, c => ' ' + c[1].toUpperCase())}...
            </p>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col bg-gray-800 rounded-lg overflow-hidden">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div key={index} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.feedback ? (
                    <div className="w-full">
                      <FeedbackCard feedback={msg.feedback} />
                      {showNextQuestionButton && (
                        <div className="flex justify-center mt-4">
                          <button onClick={startNewTurn} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-full transition-colors">
                            Next Question
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2 max-w-xl">
                      <div className={`p-3 rounded-lg ${
                        msg.role === 'user' ? 'bg-blue-600 text-white' :
                        msg.role === 'model' ? 'bg-gray-700 text-gray-200' :
                        'bg-transparent text-center w-full text-gray-400 italic'
                      }`}>
                        {msg.text}
                      </div>
                      {msg.role === 'model' && msg.text.includes('[Error:') && (
                         <button onClick={handleRetry} className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold">
                           Retry Question
                         </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 text-gray-200 p-3 rounded-lg animate-pulse">...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-gray-700">
              {/* Mic error banner */}
              {micError && (
                <div className="mb-2 px-3 py-2 bg-red-900/60 border border-red-500/50 rounded-lg text-red-300 text-xs flex justify-between items-center">
                  <span>⚠️ {micError}</span>
                  <button onClick={() => setMicError('')} className="ml-2 text-red-400 hover:text-red-200">✕</button>
                </div>
              )}
              {/* Live transcript banner */}
              {isListening && (
                <div className="mb-2 px-3 py-1.5 bg-blue-900/40 border border-blue-500/30 rounded-lg text-blue-300 text-xs">
                  🔴 {userInput || interimTranscript || 'Listening — speak now...'}
                </div>
              )}
              <div className="flex items-center gap-2">
                <MicButton />
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && userInput.trim() && !isLoading) handleSubmit(userInput); }}
                  placeholder={
                    isListening ? 'Speaking... (press Enter to submit early)' :
                    isLoading ? 'Please wait...' :
                    showNextQuestionButton ? 'Review feedback and click Next Question' :
                    'Type your answer or click the mic to speak...'
                  }
                  className="flex-1 bg-gray-700 text-white rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  disabled={isLoading && !isListening}
                />
                <button
                  onClick={() => handleSubmit(userInput)}
                  disabled={!userInput.trim() || isLoading}
                  className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSessionScreen;
