"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { focusNextFieldOnEnter } from "@/lib/formNav";

// Drives both the live checklist below and the actual submit-time validation - mirrors
// profile/page.tsx's own PASSWORD_REQUIREMENTS exactly (kept as a separate copy since that one
// isn't exported, and this screen is meant to work fully standalone, before the rest of the app -
// including the profile page itself - is reachable at all).
const PASSWORD_REQUIREMENTS = [
  { regex: /[0-9]/, text: "Minimal 1 angka" },
  { regex: /.{8,}/, text: "Minimal 8 karakter" },
  { regex: /[a-z]/, text: "Minimal 1 huruf kecil" },
  { regex: /[A-Z]/, text: "Minimal 1 huruf besar" },
  { regex: /[^A-Za-z0-9]/, text: "Minimal 1 karakter spesial" },
] as const;

function meetsAllRequirements(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.regex.test(password));
}

// Full-screen gate rendered by (app)/layout.tsx in place of AppShell/children whenever
// me.mustChangePassword is true (an account Super Admin just created, or whose password Super
// Admin just reset - see UsersAdminController). Blocks all navigation until a real password
// replaces the one-time generated one: there is no "skip" or close button here on purpose.
export default function ForcedPasswordChangeScreen() {
  const { me, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const results = PASSWORD_REQUIREMENTS.map((r) => ({ met: r.regex.test(newPassword), text: r.text }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Password sementara yang diberikan Super Admin wajib diisi");
      return;
    }
    if (!meetsAllRequirements(newPassword)) {
      setError("Password baru belum memenuhi semua syarat di bawah");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak sama");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Password baru harus berbeda dari password sementara");
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      // Server has already cleared MustChangePassword (ProfileController.ChangePassword) - refresh
      // pulls that into `me` so this screen's own gate (in (app)/layout.tsx) drops away and the
      // page the person was headed to renders normally.
      await refresh();
    } catch (err) {
      setError((err as Error).message || "Gagal mengubah password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-outer">
        <div className="login-glass-card" style={{ maxWidth: 420 }}>
          <div className="login-brand">
            <h1>Ganti Password</h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {me ? `Halo, ${me.nama}. ` : ""}
              Akun ini menggunakan password sementara yang dibuat oleh Super Admin. Buat password
              baru sebelum melanjutkan.
            </p>
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
              <label htmlFor="forced-current-password">Password Sementara</label>
              <input
                id="forced-current-password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
              />
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="forced-new-password">Password Baru</label>
              <input
                id="forced-new-password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
              />
            </div>

            <ul className="password-requirement-list" aria-label="Syarat password" style={{ marginTop: 8 }}>
              {results.map((r) => (
                <li key={r.text} className={`password-requirement-item${r.met ? " met" : ""}`}>
                  {r.met ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  )}
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="forced-confirm-password">Konfirmasi Password Baru</label>
              <input
                id="forced-confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 24 }}>
              {submitting ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
