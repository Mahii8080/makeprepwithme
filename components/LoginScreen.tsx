import React, { useState, useEffect } from 'react';
import { registerUser, loginUser, getCurrentUser, isLoggedIn } from '../services/authService';

interface LoginScreenProps {
  onGetStarted: () => void;
}

type AuthMode = 'splash' | 'login' | 'register';

const LoginScreen: React.FC<LoginScreenProps> = ({ onGetStarted }) => {
  const [mode, setMode] = useState<AuthMode>('splash');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      onGetStarted();
    }
  }, [onGetStarted]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = registerUser(username, email);
    if (result.success) {
      setMessage('✅ Registration successful! Redirecting...');
      setTimeout(() => {
        onGetStarted();
      }, 1500);
    } else {
      setMessage(`❌ ${result.message}`);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = loginUser(email);
    if (result.success) {
      setMessage('✅ Login successful! Redirecting...');
      setTimeout(() => {
        onGetStarted();
      }, 1500);
    } else {
      setMessage(`❌ ${result.message}`);
    }
    setLoading(false);
  };

  if (mode === 'splash') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 animate-fade-in-down">
            MakePrepWithMe
          </h1>
          <p className="text-lg md:text-2xl text-blue-300 mb-8 animate-fade-in-up">
            Your Personal AI Interview Coach
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setMode('login')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg shadow-blue-600/50 transform hover:scale-105 transition-all duration-300"
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg shadow-green-600/50 transform hover:scale-105 transition-all duration-300"
            >
              Register
            </button>
          </div>
        </div>
        <footer className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-gray-500 text-sm">Prepare smarter, not just harder.</p>
          <p className="text-gray-400 text-sm mt-1 font-light">developed by Team Techtitans</p>
        </footer>
      </div>
    );
  }

  if (mode === 'login') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
        <div className="bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md w-full border border-gray-700">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {message && (
              <div className={`text-sm text-center p-3 rounded-lg ${message.includes('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-400">Don't have an account? </p>
            <button
              onClick={() => setMode('register')}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Register now
            </button>
          </div>
          <button
            onClick={() => setMode('splash')}
            className="mt-4 w-full text-gray-400 hover:text-gray-300 text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Register mode
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
      <div className="bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md w-full border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Account</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username (min 3 chars)"
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          {message && (
            <div className={`text-sm text-center p-3 rounded-lg ${message.includes('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-gray-400">Already have an account? </p>
          <button
            onClick={() => setMode('login')}
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            Login here
          </button>
        </div>
        <button
          onClick={() => setMode('splash')}
          className="mt-4 w-full text-gray-400 hover:text-gray-300 text-sm"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;