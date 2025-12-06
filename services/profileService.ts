
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


export const updateProfileOnSessionEnd = (subject: Subject, score: number) => {
  const profile = getProfileData();

  // Update core stats
  const totalScore = profile.averageScore * profile.interviewsCompleted;
  profile.interviewsCompleted += 1;
  profile.averageScore = (totalScore + score) / profile.interviewsCompleted;
  
  // Update subject stats
  profile.subjectStats[subject] = (profile.subjectStats[subject] || 0) + 1;

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
    if (!profile.badges.includes(badge.name) && badge.condition(profile, subject, score)) {
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
