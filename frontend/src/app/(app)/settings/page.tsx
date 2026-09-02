"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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

export default function SettingsPage() {
  const { me, refresh } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState(me?.username ?? "");
  const [noHp, setNoHp] = useState(me?.noHp ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [accountError, setAccountError] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, me?.username);

  if (!me) return null;

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError("");
    setSavingAccount(true);
    try {
      // Nama Akun and photo live on the Profile page, so it's passed through unchanged here.
      await api.updateProfile({ nama: me!.nama, username: username.trim(), noHp: noHp.trim() || null, email: email.trim() || null });
      await refresh();
      showToast("Pengaturan akun berhasil diperbarui");
    } catch (err) {
      setAccountError((err as Error).message);
    } finally {
      setSavingAccount(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok");
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast("Password berhasil diubah");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError((err as Error).message);
    }
  }

  return (
    <div className="profile-grid">
      <div className="card">
        <div className="card-header"><h3>Pengaturan Akun</h3></div>
        <form onSubmit={handleAccountSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="field">
            <label htmlFor="username-akun">Username</label>
            <input type="text" id="username-akun" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="nohp-akun">Nomor Handphone</label>
            <input type="tel" id="nohp-akun" placeholder="Contoh: 0812xxxxxxx" value={noHp} onChange={(e) => setNoHp(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email-akun">Email</label>
            <input type="email" id="email-akun" placeholder="nama@perusahaan.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="error-text">{accountError}</div>
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={savingAccount}>
            {savingAccount ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><h3>Ubah Password</h3></div>
        <form ref={formRef} onSubmit={handlePasswordSubmit} onKeyDown={focusNextFieldOnEnter}>
          <PasswordField id="current-password" label="Password Saat Ini" placeholder="Min. 8 Karakter" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordField id="new-password" label="Password Baru" placeholder="Min. 8 Karakter" minLength={8} value={newPassword} onChange={setNewPassword} />
          <PasswordField id="confirm-password" label="Konfirmasi Password Baru" placeholder="Ulangi Password Baru" minLength={8} value={confirmPassword} onChange={setConfirmPassword} />
          <div className="error-text">{passwordError}</div>
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan Password</button>
        </form>
      </div>
    </div>
  );
}
