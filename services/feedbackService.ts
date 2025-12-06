// Service to store and retrieve feedback for each user and session

import { Subject, Difficulty, Feedback } from '../types';

export interface SessionFeedback {
  sessionId: string;
  subject: Subject;
  difficulty: Difficulty;
  timestamp: string;
  feedbacks: Array<{
    question: string;
    answer: string;
    feedback: Feedback;
  }>;
  averageScore: number;
}

/**
 * Get storage key for user feedbacks
 */
const getFeedbackKey = (userId: string): string => {
  return `makePrepWithMe_feedbacks_${userId}`;
};

/**
 * Get all feedbacks for a user
 */
export const getUserFeedbacks = (userId: string): SessionFeedback[] => {
  try {
    const key = getFeedbackKey(userId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get user feedbacks:', error);
    return [];
  }
};

/**
 * Save feedbacks for a session
 */
export const saveFeedback = (
  userId: string,
  subject: Subject,
  difficulty: Difficulty,
  feedbacks: Array<{ question: string; answer: string; feedback: Feedback }>
): { success: boolean; message: string } => {
  try {
    if (!userId) {
      return { success: false, message: 'User not logged in' };
    }

    const allFeedbacks = getUserFeedbacks(userId);
    
    const averageScore = feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.feedback.score, 0) / feedbacks.length
      : 0;

    const sessionFeedback: SessionFeedback = {
      sessionId: `session_${userId}_${Date.now()}`,
      subject,
      difficulty,
      timestamp: new Date().toISOString(),
      feedbacks,
      averageScore,
    };

    allFeedbacks.push(sessionFeedback);

    // Keep only last 100 sessions per user to avoid localStorage bloat
    if (allFeedbacks.length > 100) {
      allFeedbacks.splice(0, allFeedbacks.length - 100);
    }

    const key = getFeedbackKey(userId);
    localStorage.setItem(key, JSON.stringify(allFeedbacks));

    return { success: true, message: 'Feedback saved successfully' };
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return { success: false, message: 'Failed to save feedback' };
  }
};

/**
 * Add single feedback to the current session
 */
export const addFeedback = (
  userId: string,
  question: string,
  answer: string,
  feedback: Feedback,
  subject: Subject,
  difficulty: Difficulty
): void => {
  try {
    if (!userId) return;

    const tempKey = `makePrepWithMe_temp_session_${userId}`;
    let currentSession = [] as Array<{ question: string; answer: string; feedback: Feedback }>;

    const data = localStorage.getItem(tempKey);
    if (data) {
      currentSession = JSON.parse(data);
    }

    currentSession.push({ question, answer, feedback });
    localStorage.setItem(tempKey, JSON.stringify(currentSession));
  } catch (error) {
    console.error('Failed to add feedback:', error);
  }
};

/**
 * End session and save all accumulated feedbacks
 */
export const endSessionAndSaveFeedbacks = (
  userId: string,
  subject: Subject,
  difficulty: Difficulty
): { success: boolean; message: string } => {
  try {
    if (!userId) {
      return { success: false, message: 'User not logged in' };
    }

    const tempKey = `makePrepWithMe_temp_session_${userId}`;
    const data = localStorage.getItem(tempKey);

    if (!data) {
      return { success: true, message: 'No feedbacks to save' };
    }

    const feedbacks = JSON.parse(data) as Array<{ question: string; answer: string; feedback: Feedback }>;
    localStorage.removeItem(tempKey);

    return saveFeedback(userId, subject, difficulty, feedbacks);
  } catch (error) {
    console.error('Failed to end session:', error);
    return { success: false, message: 'Failed to end session' };
  }
};

/**
 * Get statistics for a user
 */
export const getUserStats = (userId: string) => {
  const feedbacks = getUserFeedbacks(userId);

  const totalSessions = feedbacks.length;
  const avgScore = feedbacks.length > 0
    ? feedbacks.reduce((sum, f) => sum + f.averageScore, 0) / feedbacks.length
    : 0;

  const subjectStats: { [key in Subject]?: number } = {};
  feedbacks.forEach(session => {
    subjectStats[session.subject] = (subjectStats[session.subject] || 0) + 1;
  });

  return {
    totalSessions,
    avgScore,
    subjectStats,
  };
};

/**
 * Clear all feedbacks for a user (destructive operation)
 */
export const clearUserFeedbacks = (userId: string): void => {
  try {
    const key = getFeedbackKey(userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear feedbacks:', error);
  }
};
