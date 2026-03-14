
import React, { useState, useEffect } from 'react';
import { ProfileData, Subject, Difficulty } from '../types';
import { getProfileData, getAllBadges, clearAllStats } from '../services/profileService';
import { getCurrentUser, logoutUser } from '../services/authService';
import { getUserFeedbacks, SessionFeedback } from '../services/feedbackService';
import { FeedbackCard } from './FeedbackCard';

interface ProfileScreenProps {
  onBack: () => void;
  onLogout?: () => void;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
  <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 flex items-center space-x-4">
    <div className="text-3xl sm:text-4xl">{icon}</div>
    <div>
      <div className="text-2xl sm:text-3xl font-bold text-white">{value}</div>
      <div className="text-xs sm:text-sm text-gray-400">{label}</div>
    </div>
  </div>
);

const BadgeDisplay: React.FC<{ badge: { name: string; description: string; icon: string; earned: boolean } }> = ({ badge }) => (
  <div className={`bg-gray-800 p-4 rounded-lg text-center transition-all duration-300 ${badge.earned ? 'border-2 border-yellow-400' : 'opacity-40'}`}>
    <div className={`text-5xl mx-auto mb-2 ${badge.earned ? '' : 'filter grayscale'}`}>{badge.icon}</div>
    <h3 className="font-bold text-white">{badge.name}</h3>
    <p className="text-xs text-gray-400">{badge.description}</p>
  </div>
);

const SessionFeedbackSummary: React.FC<{ session: SessionFeedback }> = ({ session }) => (
  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="font-bold text-white text-lg">{session.subject}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${session.difficulty === 'Beginner' ? 'bg-green-600/30 text-green-400' :
          session.difficulty === 'Intermediate' ? 'bg-yellow-600/30 text-yellow-400' : 'bg-red-600/30 text-red-400'
          }`}>
          {session.difficulty}
        </span>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-blue-400">{session.averageScore.toFixed(1)}</div>
        <div className="text-[10px] text-gray-500">{new Date(session.timestamp).toLocaleDateString()}</div>
      </div>
    </div>
    <div className="space-y-4">
      {session.feedbacks.map((f, i) => (
        <div key={i} className="border-t border-gray-700 pt-3">
          <div className="text-xs font-semibold text-gray-400 mb-1">Q: {f.question}</div>
          <FeedbackCard feedback={f.feedback} />
        </div>
      ))}
    </div>
  </div>
);

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onLogout }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [userFeedbacks, setUserFeedbacks] = useState<SessionFeedback[]>([]);
  const [showFeedbacks, setShowFeedbacks] = useState(false);
  const [backendStats, setBackendStats] = useState<any>(null);
  const badges = getAllBadges();

  useEffect(() => {
    setProfile(getProfileData());
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user) {
      // Local feedbacks as initial state
      const local = getUserFeedbacks(user.id);
      setUserFeedbacks(local);
      
      // Fetch stats and history from backend
      fetch(`http://localhost:4000/api/stats/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setBackendStats(data);
          // If backend has sessions, we can merge or prefer them
          if (data.sessions && data.sessions.length > 0) {
            // Map backend sessions to SessionFeedback structure
            const mapped: SessionFeedback[] = data.sessions.map((s: any) => ({
               sessionId: s.id,
               subject: s.subject as Subject,
               difficulty: (s.difficulty || 'Beginner') as Difficulty,
               timestamp: s.date,
               averageScore: s.score || 0,
               feedbacks: [] // Backend summary doesn't have full details in the stat call yet, 
                             // but we can show the list and link to details if needed.
                             // For now, we'll keep local feedbacks for details if available.
            }));
            
            // Simple merge: prefer backend records, but use local for details if IDs match
            const merged = mapped.map(bs => {
                const localMatch = local.find(l => l.sessionId === bs.sessionId);
                return localMatch ? localMatch : bs;
            });
            setUserFeedbacks(merged);
          }
        })
        .catch(e => console.warn('Failed to load backend stats:', e));
    }
  }, []);

  const handleLogout = () => {
    logoutUser();
    if (onLogout) {
      onLogout();
    }
  };

  if (!profile) {
    return <div>Loading...</div>;
  }

  // Use backend stats if available for better accuracy
  const sessionsCount = backendStats?.totalAttempts || profile.interviewsCompleted;
  const questionsCount = backendStats?.totalQuestions || profile.totalQuestionsAnswered;

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center w-full animate-fade-in-up">
      <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 underline decoration-blue-500 decoration-4 underline-offset-8">Candidate Profile</h1>
          <p className="text-md sm:text-lg text-gray-400">Mastering your interview skills, one step at a time.</p>
          {currentUser && (
            <div className="mt-4 flex items-center gap-2 bg-blue-900/20 border border-blue-500/30 px-3 py-1.5 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-200 tracking-wider">ACTIVE: {currentUser.username.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-col sm:flex-row self-start sm:self-auto">
          <button onClick={onBack} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 px-6 rounded-xl border border-gray-700 transition-all shadow-lg hover:shadow-blue-500/10">
            ← Dashboard
          </button>
          {currentUser && (
            <button onClick={handleLogout} className="bg-red-900/40 hover:bg-red-900/60 text-red-100 font-semibold py-2.5 px-6 rounded-xl border border-red-500/30 transition-all">
              Sign Out
            </button>
          )}
        </div>
      </header>

      <div className="w-full max-w-5xl space-y-10">
        {/* Stats Grid */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="p-2 bg-blue-500/20 rounded-lg text-blue-400">📊</span>
            Performance Metrics
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Interviews" value={sessionsCount} icon="📈" />
            <StatCard label="Questions" value={questionsCount} icon="❓" />
            <StatCard label="Avg Score" value={profile.averageScore.toFixed(1)} icon="⭐" />
            <StatCard label="Streak" value={profile.currentStreak} icon="🔥" />
            <StatCard label="Record" value={profile.longestStreak} icon="🏅" />
          </div>
          <div className="mt-4 text-right">
            <button 
                onClick={() => { if(confirm("Are you sure? This will wipe your local statistics to zero.")) clearAllStats(); }}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors uppercase tracking-tighter"
            >
                ⚠️ Reset All Progress
            </button>
          </div>
        </section>

        {/* Badges Section */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">🏆</span>
            Earned Achievements
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {badges.map(badge => (
              <BadgeDisplay key={badge.name} badge={badge} />
            ))}
          </div>
        </section>


        {/* Feedback History Section */}
        {currentUser && (
          <section className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                <span className="p-2 bg-purple-500/20 rounded-lg text-purple-400">🕒</span>
                Interview History
              </h2>
              <button
                onClick={() => setShowFeedbacks(!showFeedbacks)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
              >
                {showFeedbacks ? 'Minimize' : `View All (${userFeedbacks.length})`}
              </button>
            </div>
            {showFeedbacks && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userFeedbacks.length > 0 ? (
                  userFeedbacks.slice().sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((session, idx) => (
                    <div key={session.sessionId || idx} className="transform transition-all hover:scale-[1.02]">
                       <SessionFeedbackSummary session={session} />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                    <p className="text-gray-500 mb-2">No session records found.</p>
                    <button onClick={onBack} className="text-blue-400 font-bold hover:underline">Start your first interview →</button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ProfileScreen;
