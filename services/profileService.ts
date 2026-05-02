// Profile service — powered by Cloud Firestore

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { ProfileData, Subject } from '../types';

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultProfile: ProfileData = {
  username: 'Learner',
  interviewsCompleted: 0,
  averageScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionDate: null,
  badges: [],
  subjectStats: {},
  totalQuestionsAnswered: 0,
};

// ── Badge Definitions ─────────────────────────────────────────────────────────

interface Badge {
  name: string;
  description: string;
  icon: string;
  condition: (profile: ProfileData, subject?: Subject, score?: number) => boolean;
}

const allBadges: Badge[] = [
  { name: 'First Step',     description: 'Complete your first interview.',      icon: '🎉', condition: (p) => p.interviewsCompleted >= 1 },
  { name: 'High Achiever',  description: 'Get an average score of 8 or higher.', icon: '🏆', condition: (p) => p.averageScore >= 8 },
  { name: 'Perfect Score',  description: 'Score a perfect 10 in a session.',     icon: '🎯', condition: (_, __, score) => score === 10 },
  { name: 'Pythonista',     description: 'Complete 5 Python interviews.',         icon: '🐍', condition: (p) => (p.subjectStats[Subject.Python] ?? 0) >= 5 },
  { name: 'Java Master',    description: 'Complete 5 Java interviews.',           icon: '☕', condition: (p) => (p.subjectStats[Subject.Java] ?? 0) >= 5 },
  { name: 'Algo Expert',    description: 'Complete 5 DSA interviews.',            icon: '📊', condition: (p) => (p.subjectStats[Subject.DSA] ?? 0) >= 5 },
  { name: 'Hot Streak',     description: 'Maintain a 3-day streak.',              icon: '🔥', condition: (p) => p.currentStreak >= 3 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isYesterday = (d1: Date, d2: Date) => {
  const yesterday = new Date(d2);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d1, yesterday);
};

/** Returns the current user's uid, or null if not signed in */
const currentUid = (): string | null => auth.currentUser?.uid ?? null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the logged-in user's profile from Firestore.
 * Falls back to the local localStorage cache so the UI never shows blank.
 */
export const getProfileData = async (): Promise<ProfileData> => {
  const uid = currentUid();
  if (!uid) {
    // Not logged in — try localStorage fallback
    try {
      const local = localStorage.getItem('makePrepWithMeProfile');
      if (local) return { ...defaultProfile, ...JSON.parse(local) };
    } catch { /* ignore */ }
    return defaultProfile;
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      // Firestore Timestamps → ISO strings
      const profile: ProfileData = {
        ...defaultProfile,
        ...data,
        lastSessionDate: data.lastSessionDate?.toDate?.()?.toISOString() ?? data.lastSessionDate ?? null,
      };
      return profile;
    }
  } catch (err) {
    console.error('Failed to fetch Firestore profile:', err);
  }
  return defaultProfile;
};

/**
 * Synchronous version backed by localStorage — use only where async is impossible.
 */
export const getProfileDataSync = (): ProfileData => {
  try {
    const local = localStorage.getItem('makePrepWithMeProfile');
    if (local) return { ...defaultProfile, ...JSON.parse(local) };
  } catch { /* ignore */ }
  return defaultProfile;
};

/** Resets profile for a given username (used after registration) */
export const resetProfileData = async (username: string): Promise<ProfileData> => {
  const fresh: ProfileData = { ...defaultProfile, username };
  const uid = currentUid();
  if (uid) {
    try {
      await setDoc(doc(db, 'users', uid), { ...fresh, createdAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Failed to reset profile in Firestore:', err);
    }
  }
  localStorage.setItem('makePrepWithMeProfile', JSON.stringify(fresh));
  return fresh;
};

/**
 * Called after an interview session ends.
 * Updates Firestore and mirrors the data to localStorage for instant reads.
 */
export const updateProfileOnSessionEnd = async (
  subject: Subject | string,
  score: number,
  questionsCount: number = 0
): Promise<void> => {
  const profile = await getProfileData();

  // Update core stats
  const totalScore = profile.averageScore * profile.interviewsCompleted;
  profile.interviewsCompleted += 1;
  profile.averageScore = (totalScore + score) / profile.interviewsCompleted;
  profile.totalQuestionsAnswered += questionsCount;

  // Subject stats
  const subj = subject as Subject;
  profile.subjectStats[subj] = (profile.subjectStats[subj] || 0) + 1;

  // Streak logic
  const today = new Date();
  const lastSession = profile.lastSessionDate ? new Date(profile.lastSessionDate) : null;
  if (lastSession) {
    if (!isSameDay(today, lastSession)) {
      profile.currentStreak = isYesterday(lastSession, today) ? profile.currentStreak + 1 : 1;
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
    if (!profile.badges.includes(badge.name) && badge.condition(profile, subj, score)) {
      profile.badges.push(badge.name);
    }
  });

  // Persist
  const uid = currentUid();
  if (uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        interviewsCompleted: profile.interviewsCompleted,
        averageScore: profile.averageScore,
        totalQuestionsAnswered: profile.totalQuestionsAnswered,
        subjectStats: profile.subjectStats,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        lastSessionDate: profile.lastSessionDate,
        badges: profile.badges,
      });
    } catch (err) {
      console.error('Failed to update Firestore profile:', err);
    }
  }
  // Mirror to localStorage for synchronous reads
  localStorage.setItem('makePrepWithMeProfile', JSON.stringify(profile));
};

/** Update resume text in Firestore + localStorage */
export const updateResume = async (text: string): Promise<void> => {
  const uid = currentUid();
  if (uid) {
    try {
      await updateDoc(doc(db, 'users', uid), { resumeText: text });
    } catch (err) {
      console.error('Failed to save resume to Firestore:', err);
    }
  }
  const profile = getProfileDataSync();
  profile.resumeText = text;
  localStorage.setItem('makePrepWithMeProfile', JSON.stringify(profile));
};

/** Clear all stats (Firestore + localStorage) */
export const clearAllStats = async (): Promise<void> => {
  localStorage.removeItem('makePrepWithMeProfile');
  const uid = currentUid();
  if (uid) {
    try {
      await setDoc(doc(db, 'users', uid), defaultProfile, { merge: true });
    } catch (err) {
      console.error('Failed to clear Firestore profile:', err);
    }
  }
  window.location.reload();
};

/** Return all badge definitions with earned status */
export const getAllBadges = (): (Badge & { earned: boolean })[] => {
  const profile = getProfileDataSync();
  return allBadges.map(badge => ({ ...badge, earned: profile.badges.includes(badge.name) }));
};

/** Fetch backend stats (kept for compatibility) */
export const getBackendStats = async (userId: string) => {
  try {
    const res = await fetch(`http://localhost:4000/api/stats/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to fetch backend stats:', e);
  }
  return null;
};
