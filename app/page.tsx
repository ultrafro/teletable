"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./lib/auth";
import Link from "next/link";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  // Redirect if signed in
  useEffect(() => {
    if (!loading && user) {
      router.push("/home");
    }
  }, [user, loading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      setAuthError(error.message);
    } else {
      setShowSignInModal(false);
      router.push("/home");
    }
    setAuthLoading(false);
  };

  if (loading) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-white/5">
        <span className="text-lg font-semibold tracking-tight">
          chorebot<span className="text-white/30">.io</span>
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ultrafro/teletable"
            target="_blank"
            rel="noopener"
            className="text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <button
            onClick={() => setShowSignInModal(true)}
            className="px-5 py-2 bg-white/10 text-white/80 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Everything above the fold */}
      <main className="max-w-6xl mx-auto px-6 h-[calc(100vh-57px)] flex flex-col">
        {/* Hero - compact */}
        <div className="text-center pt-8 pb-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-2">
            chorebot
          </h1>
          <p className="text-base text-white/40 mb-1">
            a robot you can build at home to do chores
          </p>
          <p className="text-xs text-white/25 mb-5">
            open source robot &middot; open source platform
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-6 py-2.5 bg-white text-black rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Get Started
            </button>
            <a
              href="https://github.com/ultrafro/teletable"
              target="_blank"
              rel="noopener"
              className="px-6 py-2.5 bg-white/10 text-white/80 rounded-lg font-semibold text-sm hover:bg-white/15 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Demos - fills remaining space */}
        <div className="flex-1 min-h-0 pb-6">
          <h2 className="text-xs font-medium text-white/30 uppercase tracking-[0.2em] text-center mb-4">
            Demos
          </h2>
          <div className="grid grid-cols-3 gap-4 h-[calc(100%-2rem)] max-h-[70vh]">
            {[
              { src: "/videos/cleanbathroom.mp4", label: "Cleaning bathroom", subtitle: "teleoperated, 2x speed" },
              { src: "/videos/making_tea.mp4", label: "Making tea", subtitle: "teleoperated, 2x speed" },
              { src: "/videos/teleop.mp4", label: "Teleoperation", subtitle: "teleoperated, 1x speed" },
            ].map((vid) => (
              <div
                key={vid.src}
                className="bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-colors flex flex-col"
              >
                <video
                  src={vid.src}
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  className="flex-1 min-h-0 w-full object-cover bg-black"
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="px-3 py-2 text-xs text-white/50 font-medium">
                  {vid.label}
                  <span className="block text-white/30">{vid.subtitle}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] rounded-xl shadow-xl max-w-md w-full p-8 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {isSignUp ? "Create Account" : "Sign In"}
              </h2>
              <button
                onClick={() => {
                  setShowSignInModal(false);
                  setAuthError(null);
                }}
                className="text-white/40 hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2 text-white/70"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-white placeholder-white/30"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2 text-white/70"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-white placeholder-white/30"
                  placeholder="Enter your password"
                />
              </div>

              {authError && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading
                  ? "Loading..."
                  : isSignUp
                    ? "Sign Up"
                    : "Sign In"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-white/50 hover:text-white text-sm"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
