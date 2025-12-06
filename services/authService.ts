// Authentication service for user login and registration

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

const USERS_KEY = 'makePrepWithMe_users';
const CURRENT_SESSION_KEY = 'makePrepWithMe_session';

/**
 * Get all registered users
 */
export const getAllUsers = (): User[] => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get users:', error);
    return [];
  }
};

/**
 * Save all users
 */
const saveUsers = (users: User[]) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save users:', error);
  }
};

/**
 * Register a new user
 */
export const registerUser = (username: string, email: string): { success: boolean; message: string; user?: User } => {
  // Validation
  if (!username || username.trim().length < 3) {
    return { success: false, message: 'Username must be at least 3 characters long.' };
  }

  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const users = getAllUsers();

  // Check if user already exists
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'Email already registered. Please login instead.' };
  }

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username already taken. Please choose a different one.' };
  }

  // Create new user
  const newUser: User = {
    id: `user_${Date.now()}`,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // Auto-login after registration
  setCurrentSession(newUser);

  return { success: true, message: 'Registration successful!', user: newUser };
};

/**
 * Login user
 */
export const loginUser = (email: string, password?: string): { success: boolean; message: string; user?: User } => {
  // Note: In a real app, password would be hashed and verified on a secure backend.
  // For this demo, we use email-based login (no password).
  
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const users = getAllUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return { success: false, message: 'User not found. Please register first.' };
  }

  // Set current session
  setCurrentSession(user);

  return { success: true, message: 'Login successful!', user };
};

/**
 * Set current user session
 */
export const setCurrentSession = (user: User) => {
  try {
    const session: UserSession = {
      user,
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to set session:', error);
  }
};

/**
 * Get current logged-in user
 */
export const getCurrentUser = (): User | null => {
  try {
    const data = localStorage.getItem(CURRENT_SESSION_KEY);
    if (data) {
      const session: UserSession = JSON.parse(data);
      return session.user;
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }
  return null;
};

/**
 * Logout current user
 */
export const logoutUser = () => {
  try {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  } catch (error) {
    console.error('Failed to logout:', error);
  }
};

/**
 * Check if user is logged in
 */
export const isLoggedIn = (): boolean => {
  return getCurrentUser() !== null;
};
