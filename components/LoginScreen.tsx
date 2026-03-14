import React, { useState, useEffect } from 'react';
import { registerUser, loginUser, isLoggedIn } from '../services/authService';
import { resetProfileData } from '../services/profileService';

interface LoginScreenProps {
  onGetStarted: () => void;
}

type AuthMode = 'splash' | 'login' | 'register';

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onGetStarted }) => {
  const [mode, setMode] = useState<AuthMode>('splash');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset fields when switching mode
  const switchMode = (newMode: AuthMode) => {
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setMessage('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMode(newMode);
  };

  // Check if user is already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      onGetStarted();
    }
  }, [onGetStarted]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('❌ Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = registerUser(username, email, password);
    if (result.success) {
      resetProfileData(username);
      setMessage('✅ Account created! Redirecting...');
      setTimeout(() => {
        onGetStarted();
      }, 1200);
    } else {
      setMessage(`❌ ${result.message}`);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = loginUser(email, password);
    if (result.success) {
      setMessage('✅ Login successful! Redirecting...');
      setTimeout(() => {
        onGetStarted();
      }, 1200);
    } else {
      setMessage(`❌ ${result.message}`);
    }
    setLoading(false);
  };

  // ── Shared input style ──
  const inputClass = (accent: string) =>
    `w-full bg-gray-700/80 border border-gray-600 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 ${accent} placeholder-gray-400`;

  if (mode === 'splash') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 animate-fade-in-down">
            MakePrepWithMe
          </h1>
          <p className="text-lg md:text-2xl text-blue-300 mb-12 animate-fade-in-up">
            Your Personal AI Interview Coach
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => switchMode('login')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg shadow-blue-600/50 transform hover:scale-105 transition-all duration-300 min-w-[150px]"
            >
              Login
            </button>
            <button
              onClick={() => switchMode('register')}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg shadow-green-600/50 transform hover:scale-105 transition-all duration-300 min-w-[150px]"
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
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full border border-gray-700">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Welcome Back</h2>
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={inputClass('focus:ring-blue-500')}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${inputClass('focus:ring-blue-500')} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
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
            <p className="text-gray-400">Don't have an account?{' '}
              <button
                onClick={() => switchMode('register')}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Register now
              </button>
            </p>
          </div>
          <button
            onClick={() => switchMode('splash')}
            className="mt-4 w-full text-gray-400 hover:text-gray-300 text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Register mode ──
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-blue-900">
      <div className="bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Account</h2>
        <form onSubmit={handleRegister} className="space-y-4">

          {/* Username */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username (min 3 chars)"
              className={inputClass('focus:ring-green-500')}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputClass('focus:ring-green-500')}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className={`${inputClass('focus:ring-green-500')} pr-12`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`${inputClass('focus:ring-green-500')} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
            {/* Live password match hint */}
            {confirmPassword && (
              <p className={`text-xs mt-1 ${password === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">Already have an account?{' '}
            <button
              onClick={() => switchMode('login')}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Login here
            </button>
          </p>
        </div>
        <button
          onClick={() => switchMode('splash')}
          className="mt-4 w-full text-gray-400 hover:text-gray-300 text-sm"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;