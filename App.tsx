import React, { useState, useCallback, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import InterviewSessionScreen from './components/InterviewSessionScreen';
import ProfileScreen from './components/ProfileScreen';
import ResumeScannerScreen from './components/ResumeScannerScreen';
import { Subject, View, Difficulty } from './types';
import { subscribeToAuthChanges } from './services/authService';
import { seedQuestionsToFirestore } from './services/questionBankService';

const App: React.FC = () => {
  const [view, setView] = useState<View>('login');
  const [currentSubject, setCurrentSubject] = useState<Subject | string | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Listen to Firebase auth state — runs seeder once user is logged in
  useEffect(() => {
    const unsub = subscribeToAuthChanges(user => {
      if (user) {
        setIsAuthenticated(true);
        setView('dashboard');
        // Seed Firestore question bank (no-op if already seeded)
        seedQuestionsToFirestore().catch(console.warn);
      } else {
        setIsAuthenticated(false);
        setView('login');
      }
    });
    return unsub;
  }, []);

  const handleStartInterview = useCallback((subject: Subject | string, difficulty: Difficulty) => {
    setCurrentSubject(subject);
    setCurrentDifficulty(difficulty);
    setView('session');
  }, []);

  const handleEndInterview = useCallback(() => {
    setView('dashboard');
    setCurrentSubject(null);
    setCurrentDifficulty(null);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setView('login');
  }, []);

  const renderView = () => {
    switch (view) {
      case 'login':
        return (
          <LoginScreen
            onGetStarted={() => {
              setIsAuthenticated(true);
              setView('dashboard');
            }}
          />
        );
      case 'dashboard':
        return <DashboardScreen onStartInterview={handleStartInterview} onViewProfile={() => setView('profile')} onNavigateToResumeScanner={() => setView('resumeScanner')} />;
      case 'profile':
        return <ProfileScreen onBack={() => setView('dashboard')} onLogout={handleLogout} />;
      case 'session':
        if (currentSubject && currentDifficulty) {
          return <InterviewSessionScreen subject={currentSubject} difficulty={currentDifficulty} onEndSession={handleEndInterview} />;
        }
        return <DashboardScreen onStartInterview={handleStartInterview} onViewProfile={() => setView('profile')} onNavigateToResumeScanner={() => setView('resumeScanner')} />;
      case 'resumeScanner':
        return <ResumeScannerScreen onBack={() => setView('dashboard')} onStartInterview={handleStartInterview} />;
      default:
        return <LoginScreen onGetStarted={() => setView('dashboard')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {renderView()}
    </div>
  );
};

export default App;