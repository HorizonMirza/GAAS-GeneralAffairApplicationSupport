"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { api } from "@/lib/api";
import { focusNextFieldOnEnter } from "@/lib/formNav";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 3D tilt-toward-cursor on the card - mouse position relative to the card's own center drives
  // a small rotation, so the card reads as leaning toward wherever the pointer is.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-140, 140], [6, -6]);
  const rotateY = useTransform(mouseX, [-200, 200], [-6, 6]);

  function handleCardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleCardMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/dashboard"))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.login(username.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = (err as Error).message;
      setError(status === 401 ? "Invalid username or password" : message || "Login failed");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <motion.div
        className="login-glow-blob login-glow-blob-top"
        animate={{ opacity: [0.25, 0.4, 0.25], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="login-glow-blob login-glow-blob-bottom"
        animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />

      <motion.div
        className="login-outer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="brand-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo-pgm-solution.png"
            alt="PGM Solution"
            className="brand-logo-img"
            style={{ maxWidth: 240, maxHeight: 72, width: "auto", height: "auto" }}
          />
        </div>

        <div className="login-card-perspective">
          <motion.div
            className="login-card-beam-wrap"
            style={{ rotateX, rotateY }}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
          >
            <div className="login-card">
              <div className="login-brand">
                <h1>Login</h1>
                <p>Enter your username to sign in your account</p>
              </div>

              <div className={`alert-error ${error ? "alert-error-visible" : ""}`}>
                <svg className="alert-error-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div className="alert-error-text">
                  <strong>Error</strong>
                  <span>{error}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
                <div className="field">
                  <label htmlFor="username">Username</label>
                  <div className="field-icon-input">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
                    </span>
                    <input
                      type="text"
                      id="username"
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="Enter Username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="password-wrapper field-icon-input">
                    <span className="field-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Logging in..." : "Login"}
                  {!submitting && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  )}
                </button>
              </form>

              <div className="login-divider"><span>or</span></div>

              <button
                type="button"
                className="btn btn-azure"
                disabled
                title="Login dengan Azure AD belum aktif - gunakan akun GAAS Anda untuk sementara"
              >
                <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Sign in with Azure
                <span className="btn-azure-badge">Coming soon</span>
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
