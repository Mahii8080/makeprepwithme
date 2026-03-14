
import { ProfileData, Subject } from '../types';

const PROFILE_KEY = 'makePrepWithMeProfile';

const defaultProfile: ProfileData = {
  username: "Learner",
  interviewsCompleted: 0,
  averageScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionDate: null,
  badges: [],
  subjectStats: {},
  totalQuestionsAnswered: 0,
};

interface Badge {
    name: string;
    description: string;
    icon: string;
    condition: (profile: ProfileData, subject?: Subject, score?: number) => boolean;
}

const allBadges: Badge[] = [
    { name: "First Step", description: "Complete your first interview.", icon: "🎉", condition: (p) => p.interviewsCompleted >= 1 },
    { name: "High Achiever", description: "Get an average score of 8 or higher.", icon: "🏆", condition: (p) => p.averageScore >= 8 },
    { name: "Perfect Score", description: "Score a perfect 10 in a session.", icon: "🎯", condition: (_, __, score) => score === 10 },
    { name: "Pythonista", description: "Complete 5 Python interviews.", icon: "🐍", condition: (p) => (p.subjectStats[Subject.Python] ?? 0) >= 5 },
    { name: "Java Master", description: "Complete 5 Java interviews.", icon: "☕", condition: (p) => (p.subjectStats[Subject.Java] ?? 0) >= 5 },
    { name: "Algo Expert", description: "Complete 5 DSA interviews.", icon: "📊", condition: (p) => (p.subjectStats[Subject.DSA] ?? 0) >= 5 },
    { name: "Hot Streak", description: "Maintain a 3-day streak.", icon: "🔥", condition: (p) => p.currentStreak >= 3 },
];


export const getProfileData = (): ProfileData => {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (data) {
      return { ...defaultProfile, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Failed to parse profile data from localStorage", error);
  }
  return defaultProfile;
};

const saveProfileData = (profile: ProfileData) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error("Failed to save profile data to localStorage", error);
  }
};

export const resetProfileData = (username: string) => {
    const newProfile: ProfileData = {
        ...defaultProfile,
        username: username
    };
    saveProfileData(newProfile);
    return newProfile;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

const isYesterday = (date1: Date, date2: Date): boolean => {
    const yesterday = new Date(date2);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date1, yesterday);
}


export const updateProfileOnSessionEnd = (subject: Subject | string, score: number, questionsCount: number = 0) => {
  const profile = getProfileData();

  // Update core stats
  const totalScore = profile.averageScore * profile.interviewsCompleted;
  profile.interviewsCompleted += 1;
  profile.averageScore = (totalScore + score) / profile.interviewsCompleted;
  profile.totalQuestionsAnswered += questionsCount;
  
  // Update subject stats
  if (typeof subject === 'string') {
      const subj = subject as Subject;
      profile.subjectStats[subj] = (profile.subjectStats[subj] || 0) + 1;
  }

  // Update streak
  const today = new Date();
  const lastSession = profile.lastSessionDate ? new Date(profile.lastSessionDate) : null;

  if (lastSession) {
      if (!isSameDay(today, lastSession)) {
          if (isYesterday(lastSession, today)) {
              profile.currentStreak += 1;
          } else {
              profile.currentStreak = 1; // Streak reset
          }
      }
  } else {
      profile.currentStreak = 1;
  }
  
  profile.lastSessionDate = today.toISOString();
  if (profile.currentStreak > profile.longestStreak) {
      profile.longestStreak = profile.currentStreak;
  }
  
  // Award badges
  allBadges.forEach(badge => {
    if (!profile.badges.includes(badge.name) && badge.condition(profile, subject as Subject, score)) {
        profile.badges.push(badge.name);
    }
  });

  saveProfileData(profile);
};



// For displaying in the profile screen
export const getAllBadges = (): (Badge & { earned: boolean })[] => {
    const profile = getProfileData();
    return allBadges.map(badge => ({
        ...badge,
        earned: profile.badges.includes(badge.name)
    }));
}

export const updateResume = (text: string) => {
    const profile = getProfileData();
    profile.resumeText = text;
    saveProfileData(profile);
}

export const clearAllStats = () => {
    localStorage.removeItem(PROFILE_KEY);
    window.location.reload(); // Refresh to apply changes
}

export const getBackendStats = async (userId: string) => {
    try {
        const res = await fetch(`http://localhost:4000/api/stats/${userId}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error('Failed to fetch backend stats:', e);
    }
    return null;
}

