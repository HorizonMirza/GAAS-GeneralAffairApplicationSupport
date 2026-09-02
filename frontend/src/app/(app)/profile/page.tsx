"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/constants";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useToast } from "@/components/ui/ToastProvider";

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  minLength,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrapper">
        <input
          type={show ? "text" : "password"}
          id={id}
          placeholder={placeholder}
          minLength={minLength}
          required
          value={value}
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
    </div>
  );
}

export default function ProfilePage() {
  const { me } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, me?.username);

  if (!me) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok");
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast("Password berhasil diubah");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="profile-grid">
      <div className="card">
        <div className="card-header"><h3>Data Akun</h3></div>
        <div className="field">
          <label>Nama Akun</label>
          <input type="text" disabled value={me.nama} />
        </div>
        <div className="field">
          <label>Username</label>
          <input type="text" disabled value={me.username} />
        </div>
        <div className="field">
          <label>Peran</label>
          <input type="text" disabled value={ROLE_LABEL[me.role] || me.role} />
        </div>
        {me.direktorat && (
          <div className="field">
            <label>Direktorat</label>
            <input type="text" disabled value={me.direktorat} />
          </div>
        )}
        {me.divisi && (
          <div className="field">
            <label>Divisi</label>
            <input type="text" disabled value={me.divisi} />
          </div>
        )}
        {me.departemen && (
          <div className="field">
            <label>Departemen</label>
            <input type="text" disabled value={me.departemen} />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h3>Ubah Password</h3></div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <PasswordField id="current-password" label="Password Saat Ini" placeholder="Min. 8 Karakter" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordField id="new-password" label="Password Baru" placeholder="Min. 8 Karakter" minLength={8} value={newPassword} onChange={setNewPassword} />
          <PasswordField id="confirm-password" label="Konfirmasi Password Baru" placeholder="Ulangi Password Baru" minLength={8} value={confirmPassword} onChange={setConfirmPassword} />
          <div className="error-text">{error}</div>
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan Password</button>
        </form>
      </div>
    </div>
  );
}
