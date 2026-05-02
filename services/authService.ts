// Authentication service — powered by Firebase Authentication

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Public User Shape ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface UserSession {
  user: User;
  loginTime: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a FirebaseUser to our app's User shape */
const toAppUser = (fbUser: FirebaseUser): User => ({
  id: fbUser.uid,
  username: fbUser.displayName || fbUser.email?.split('@')[0] || 'Learner',
  email: fbUser.email || '',
  createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
});

// ── Auth Functions ────────────────────────────────────────────────────────────

/**
 * Register a new user with Firebase Auth + save their profile in Firestore
 */
export const registerUser = async (
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; message: string; user?: User }> => {
  if (!username || username.trim().length < 3) {
    return { success: false, message: 'Username must be at least 3 characters long.' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = credential.user;

    // Set display name
    await updateProfile(fbUser, { displayName: username.trim() });

    // Save profile document in Firestore
    await setDoc(doc(db, 'users', fbUser.uid), {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      createdAt: serverTimestamp(),
      interviewsCompleted: 0,
      averageScore: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: null,
      badges: [],
      subjectStats: {},
      totalQuestionsAnswered: 0,
    });

    const user = toAppUser(fbUser);
    return { success: true, message: 'Registration successful!', user };
  } catch (err: any) {
    const msg = err.code === 'auth/email-already-in-use'
      ? 'Email already registered. Please login instead.'
      : err.code === 'auth/weak-password'
      ? 'Password is too weak. Use at least 6 characters.'
      : err.message || 'Registration failed. Please try again.';
    return { success: false, message: msg };
  }
};

/**
 * Login with email and password
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; message: string; user?: User }> => {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { success: false, message: 'Please enter your password.' };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = toAppUser(credential.user);
    return { success: true, message: 'Login successful!', user };
  } catch (err: any) {
    const msg = err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'
      ? 'No account found with this email, or wrong password.'
      : err.code === 'auth/wrong-password'
      ? 'Incorrect password. Please try again.'
      : err.message || 'Login failed. Please try again.';
    return { success: false, message: msg };
  }
};

/**
 * Logout the current user
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Logout failed:', err);
  }
};

/**
 * Get the currently logged-in user (synchronous snapshot)
 * Returns null if no user is signed in
 */
export const getCurrentUser = (): User | null => {
  const fbUser = auth.currentUser;
  return fbUser ? toAppUser(fbUser) : null;
};

/**
 * Subscribe to auth state changes (use this in React components)
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * @example
 * useEffect(() => {
 *   const unsub = subscribeToAuthChanges(user => setUser(user));
 *   return unsub;
 * }, []);
 */
export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, (fbUser) => {
    callback(fbUser ? toAppUser(fbUser) : null);
  });
};

/**
 * Check if any user is currently signed in (synchronous)
 */
export const isLoggedIn = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Fetch full user document from Firestore by uid
 */
export const getUserDoc = async (uid: string) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('Failed to fetch user doc:', err);
    return null;
  }
};

// Legacy stubs — kept so existing code that calls these doesn't crash
export const setCurrentSession = (_user: User) => { /* handled by Firebase */ };
export const getAllUsers = (): User[] => [];
