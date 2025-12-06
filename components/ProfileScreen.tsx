
import React, { useState, useEffect } from 'react';
import { ProfileData } from '../types';
import { getProfileData, getAllBadges } from '../services/profileService';
import { getCurrentUser, logoutUser } from '../services/authService';
import { getUserFeedbacks, SessionFeedback } from '../services/feedbackService';

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

const FeedbackCard: React.FC<{ session: SessionFeedback }> = ({ session }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-750 transition-colors">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h4 className="font-semibold text-white">{session.subject} - {session.difficulty}</h4>
        <p className="text-xs text-gray-400">{new Date(session.timestamp).toLocaleDateString()} at {new Date(session.timestamp).toLocaleTimeString()}</p>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-yellow-400">{session.averageScore.toFixed(1)}</div>
        <p className="text-xs text-gray-400">avg score</p>
      </div>
    </div>
    <p className="text-sm text-gray-300">{session.feedbacks.length} question(s) answered</p>
  </div>
);

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onLogout }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [userFeedbacks, setUserFeedbacks] = useState<SessionFeedback[]>([]);
  const [showFeedbacks, setShowFeedbacks] = useState(false);
  const badges = getAllBadges();

  useEffect(() => {
    setProfile(getProfileData());
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user) {
      setUserFeedbacks(getUserFeedbacks(user.id));
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

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center w-full animate-fade-in-up">
      <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Your Profile</h1>
          <p className="text-md sm:text-lg text-gray-400">Keep track of your progress and achievements.</p>
          {currentUser && (
            <p className="text-sm text-blue-400 mt-2">👤 {currentUser.username} ({currentUser.email})</p>
          )}
        </div>
        <div className="flex gap-2 flex-col sm:flex-row self-start sm:self-auto">
          <button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            Back to Dashboard
          </button>
          {currentUser && (
            <button onClick={handleLogout} className="bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Logout
            </button>
          )}
        </div>
      </header>
      
      <div className="w-full max-w-5xl space-y-8">
        {/* Stats Grid */}
        <section>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-6 border-b-2 border-gray-700 pb-3">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Interviews Completed" value={profile.interviewsCompleted} icon="📈" />
                <StatCard label="Average Score" value={profile.averageScore.toFixed(1)} icon="⭐" />
                <StatCard label="Current Streak" value={profile.currentStreak} icon="🔥" />
                <StatCard label="Longest Streak" value={profile.longestStreak} icon="🏅" />
            </div>
        </section>

        {/* Badges Section */}
        <section>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-6 border-b-2 border-gray-700 pb-3">Badges</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {badges.map(badge => (
                    <BadgeDisplay key={badge.name} badge={badge} />
                ))}
            </div>
        </section>

        {/* Feedback History Section */}
        {currentUser && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white border-b-2 border-gray-700 pb-3 flex-1">Feedback History</h2>
              <button
                onClick={() => setShowFeedbacks(!showFeedbacks)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                {showFeedbacks ? 'Hide' : 'Show'} ({userFeedbacks.length})
              </button>
            </div>
            {showFeedbacks && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userFeedbacks.length > 0 ? (
                  userFeedbacks.slice().reverse().map(session => (
                    <FeedbackCard key={session.sessionId} session={session} />
                  ))
                ) : (
                  <p className="text-gray-400 col-span-full">No feedback history yet. Start an interview to build your history!</p>
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
