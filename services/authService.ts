// Authentication service for user login and registration

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
}

export interface UserSession {
  user: User;
  loginTime: string;
}

const USERS_KEY = 'makePrepWithMe_users';
const CURRENT_SESSION_KEY = 'makePrepWithMe_session';


const hashPassword = (password: string): string => {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return (hash >>> 0).toString(16); // unsigned 32-bit hex string
};

/**
 * Get all registered users (stored users include password hash)
 */
const getAllStoredUsers = (): StoredUser[] => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get users:', error);
    return [];
  }
};

/**
 * Get all registered users (public view — no password hash)
 */
export const getAllUsers = (): User[] => {
  return getAllStoredUsers().map(({ passwordHash: _ph, ...user }) => user);
};

/**
 * Save all users
 */
const saveStoredUsers = (users: StoredUser[]) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save users:', error);
  }
};

/**
 * Register a new user
 */
export const registerUser = (
  username: string,
  email: string,
  password: string
): { success: boolean; message: string; user?: User } => {
  // Validation
  if (!username || username.trim().length < 3) {
    return { success: false, message: 'Username must be at least 3 characters long.' };
  }

  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }

  const users = getAllStoredUsers();

  // Check if user already exists
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'Email already registered. Please login instead.' };
  }

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username already taken. Please choose a different one.' };
  }

  // Create new user
  const newStoredUser: StoredUser = {
    id: `user_${Date.now()}`,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  users.push(newStoredUser);
  saveStoredUsers(users);

  // Return public user (no password hash)
  const { passwordHash: _ph, ...publicUser } = newStoredUser;
  // Auto-login after registration
  setCurrentSession(publicUser);

  return { success: true, message: 'Registration successful!', user: publicUser };
};

/**
 * Login user
 */
export const loginUser = (
  email: string,
  password: string
): { success: boolean; message: string; user?: User } => {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  if (!password) {
    return { success: false, message: 'Please enter your password.' };
  }

  const users = getAllStoredUsers();
  const storedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!storedUser) {
    return { success: false, message: 'No account found with this email. Please register first.' };
  }

  // Verify password
  if (storedUser.passwordHash !== hashPassword(password)) {
    return { success: false, message: 'Incorrect password. Please try again.' };
  }

  // Return public user (no password hash)
  const { passwordHash: _ph, ...publicUser } = storedUser;
  setCurrentSession(publicUser);

  return { success: true, message: 'Login successful!', user: publicUser };
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
