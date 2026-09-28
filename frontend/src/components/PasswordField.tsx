"use client";

import { useState } from "react";

interface Props {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

// Shared version of the password-entry field profile/page.tsx defines locally for its own
// "re-enter your password to confirm" dialogs - used here by the Super Admin room/vehicle roster
// editors, which gate Add/Edit/Delete the same way.
export default function PasswordField({ id, label, placeholder, value, onChange, minLength, error, hint, icon }: Props) {
  const [show, setShow] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`password-wrapper ${icon ? "has-leading-icon" : ""}`}>
        {icon && <span className="password-leading-icon">{icon}</span>}
        <input
          type={show ? "text" : "password"}
          id={id}
          placeholder={placeholder}
          minLength={minLength}
          required
          value={value}
          aria-invalid={!!error}
          aria-describedby={errorId}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="password-toggle" aria-label="Tampilkan password" onClick={() => setShow((v) => !v)}>
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          )}
        </button>
      </div>
      <div id={errorId} className={`alert-error ${error ? "alert-error-visible" : ""}`} role="alert" aria-live="polite">
        <div className="alert-error-text"><strong>Error</strong><span>{error}</span></div>
      </div>
      {!error && hint && <div className="field-hint-text">{hint}</div>}
    </div>
  );
}
