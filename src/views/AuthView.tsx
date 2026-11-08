import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Lock,
  User as UserIcon,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Check,
  Compass,
} from 'lucide-react';

export default function AuthView() {
  const { login, signup, resetPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [userIdOrEmail, setUserIdOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Signup fields (strictly username, email, password)
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Forgot password fields
  const [forgotInput, setForgotInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    setTimeout(() => {
      const res = login(userIdOrEmail, loginPassword);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to login. Please check your credentials.');
      }
    }, 350);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    setTimeout(() => {
      const res = signup(signupUsername, signupEmail, signupPassword);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to sign up.');
      }
    }, 400);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    setTimeout(() => {
      const res = resetPassword(forgotInput, newPasswordInput || 'password123');
      setLoading(false);
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    }, 350);
  };

  const fillDemoAccount = () => {
    setUserIdOrEmail('alex');
    setLoginPassword('password123');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 flex flex-col justify-center items-center px-4 py-6 sm:py-10 relative overflow-x-hidden selection:bg-teal-500 selection:text-white">
      {/* Subtle warm ambient backdrop (70% warm light cream ratio) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#F5ECE1] rounded-full blur-3xl opacity-70" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-[#EFE5D8] rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-[#FFF9F0] rounded-full blur-3xl opacity-80" />
      </div>

      {/* Balanced 55:45 Two-Column Layout (Desktop) / Clean Single Column (Mobile) */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* LEFT COLUMN: Brand, Headline, Short Description & Tasteful Social Illustration (55% / 7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5 lg:pr-4 text-center lg:text-left items-center lg:items-start">
          
          {/* Brand Logo & Name */}
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#EADBCE] shadow-xs p-1 flex items-center justify-center shrink-0">
              <img
                src="/brand/logo.png"
                alt="GenC Vibez"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left">
              <span className="text-base font-extrabold tracking-tight text-[#0F172A] block leading-none">
                GenC Vibez
              </span>
              <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase block mt-1">
                Virtual Spaces & Community
              </span>
            </div>
          </div>

          {/* Welcoming Headline & Subtitle */}
          <div className="space-y-2 max-w-lg">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0F172A] leading-tight">
              Your World. Your People.{' '}
              <span className="bg-gradient-to-r from-teal-600 via-teal-500 to-[#FF5E3A] bg-clip-text text-transparent">
                Your Vibe.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Meet new people, explore virtual spaces and find your community.
            </p>
          </div>

          {/* Tasteful, Small Avatar Cluster (Youthful & Welcoming) */}
          <div className="pt-1 flex items-center gap-3">
            <div className="flex -space-x-2.5 items-center">
              <div className="w-9 h-9 rounded-full bg-white p-0.5 shadow-xs border-2 border-white ring-1 ring-teal-500/30 overflow-hidden shrink-0">
                <img
                  src="/avatars/default-1-panda.png"
                  alt="Leo"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="w-9 h-9 rounded-full bg-white p-0.5 shadow-xs border-2 border-white ring-1 ring-[#FF5E3A]/30 overflow-hidden shrink-0">
                <img
                  src="/avatars/default-3-alien.png"
                  alt="Maya"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="w-9 h-9 rounded-full bg-white p-0.5 shadow-xs border-2 border-white ring-1 ring-emerald-500/30 overflow-hidden shrink-0">
                <img
                  src="/avatars/default-2-corgi.png"
                  alt="Chloe"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 font-medium text-left">
              Join <span className="font-bold text-[#0F172A]">Maya</span>,{' '}
              <span className="font-bold text-[#0F172A]">Leo</span>, and real members in live spaces.
            </p>
          </div>

          {/* Clean, Compact Social Features List (Hidden on tiny mobile, visible on sm+) */}
          <div className="hidden sm:grid grid-cols-1 gap-2 pt-2 text-left w-full max-w-md">
            <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium p-2.5 rounded-xl bg-white/70 border border-[#EADBCE]/70">
              <div className="w-5 h-5 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Move freely with real avatars across scenic parks & monuments</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium p-2.5 rounded-xl bg-white/70 border border-[#EADBCE]/70">
              <div className="w-5 h-5 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Private 1v1 friendly tables & voice chat hangouts</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium p-2.5 rounded-xl bg-white/70 border border-[#EADBCE]/70">
              <div className="w-5 h-5 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Real community members · Zero ads · End-to-end security</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Compact, Vertically Centered Login/Signup Card (45% / 5 cols) */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <div className="w-full max-w-md bg-[#FFFDF9] border border-[#EADBCE] rounded-2xl p-5 sm:p-7 shadow-sm transition-all">
            
            {/* Login / Sign Up Tabs */}
            {mode !== 'forgot' && (
              <div className="flex p-1 bg-[#F0EAE1] rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'signup'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* Error & Success Feedback Alerts */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-medium leading-tight">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium leading-tight">{successMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    User ID or Username
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. alex or cosmic_wanderer"
                      value={userIdOrEmail}
                      onChange={(e) => setUserIdOrEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setForgotInput(userIdOrEmail);
                      }}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-[#D5C9BA] text-teal-600 focus:ring-teal-500/20"
                    />
                    <span className="font-medium">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={fillDemoAccount}
                    className="text-xs text-teal-700 hover:text-teal-900 font-bold underline"
                  >
                    Quick Demo (alex)
                  </button>
                </div>

                {/* Prominent Teal / Coral CTA Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-teal-600 via-teal-500 to-[#FF5E3A] hover:brightness-105 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-md shadow-teal-700/15 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  <span>{loading ? 'Logging in...' : 'Sign In to GenC Vibez'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TAB 2: SIGN UP */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Choose a username"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create password (min 4 characters)"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Prominent Coral & Orange CTA Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-[#FF5E3A] via-[#FF6E40] to-[#F97316] hover:brightness-105 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-md shadow-coral-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  <span>{loading ? 'Creating Account...' : 'Complete Sign Up'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TAB 3: FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                    <KeyRound className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900">
                      Reset Password
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Enter user ID or email to restore access
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    User ID or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. alex or your email"
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6F0] focus:bg-white border border-[#E3DACD] text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#F0EAE1] hover:bg-[#E5DCD0] text-slate-700 font-bold text-xs transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs transition-all shadow-xs disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Update'}
                  </button>
                </div>
              </form>
            )}

            {/* Small Security Message Footer */}
            <div className="mt-5 pt-3.5 border-t border-[#EADBCE] flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Secure authentication · Privacy protected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
