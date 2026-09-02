"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { focusNextFieldOnEnter } from "@/lib/formNav";
import { useToast } from "@/components/ui/ToastProvider";

type AccountField = "username" | "noHp" | "email";

const FIELD_META: Record<AccountField, { label: string; type: string; placeholder?: string; icon: React.ReactNode }> = {
  username: {
    label: "Username",
    type: "text",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
    ),
  },
  noHp: {
    label: "Nomor Handphone",
    type: "tel",
    placeholder: "Contoh: 0812xxxxxxx",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
    ),
  },
  email: {
    label: "Email",
    type: "email",
    placeholder: "nama@perusahaan.com",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m2 6 10 7 10-7"></path></svg>
    ),
  },
};

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

  const [editingField, setEditingField] = useState<AccountField | null>(null);
  const [draft, setDraft] = useState("");
  const [savingField, setSavingField] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (!me) return null;

  const currentValue: Record<AccountField, string> = {
    username: me.username,
    noHp: me.noHp ?? "",
    email: me.email ?? "",
  };

  function openFieldEdit(field: AccountField) {
    setDraft(currentValue[field]);
    setEditingField(field);
  }

  async function handleFieldSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingField) return;
    setSavingField(true);
    try {
      const next = { ...currentValue, [editingField]: draft.trim() };
      await api.updateProfile({
        nama: me!.nama,
        username: next.username,
        noHp: next.noHp || null,
        email: next.email || null,
      });
      await refresh();
      setEditingField(null);
      showToast(`${FIELD_META[editingField].label} berhasil diperbarui`);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingField(false);
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
        <div className="card-header"><h3>Kontak &amp; Akun</h3></div>
        {(Object.keys(FIELD_META) as AccountField[]).map((field) => (
          <div key={field} className="settings-icon-row">
            <div className="settings-icon-chip">{FIELD_META[field].icon}</div>
            <div className="settings-icon-row-body">
              <div className="profile-info-label">{FIELD_META[field].label}</div>
              <div className="profile-info-value">{currentValue[field] || "-"}</div>
            </div>
            <button type="button" className="btn btn-secondary settings-ubah-btn" onClick={() => openFieldEdit(field)}>
              Ubah
            </button>
          </div>
        ))}

        {editingField && (
          <form className="settings-edit-panel" onSubmit={handleFieldSubmit} onKeyDown={focusNextFieldOnEnter}>
            <div className="field">
              <label htmlFor="field-draft">Ubah {FIELD_META[editingField].label}</label>
              <input
                id="field-draft"
                type={FIELD_META[editingField].type}
                placeholder={FIELD_META[editingField].placeholder}
                required={editingField === "username"}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <div className="settings-edit-panel-actions">
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setEditingField(null)}>Batal</button>
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={savingField}>
                {savingField ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="settings-section-header">
          <div className="settings-icon-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h3>Keamanan</h3>
        </div>

        <form className="settings-edit-panel" onSubmit={handlePasswordSubmit} onKeyDown={focusNextFieldOnEnter}>
          <PasswordField id="current-password" label="Password Saat Ini" placeholder="Min. 8 Karakter" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordField id="new-password" label="Password Baru" placeholder="Min. 8 Karakter" minLength={8} value={newPassword} onChange={setNewPassword} />
          <PasswordField id="confirm-password" label="Konfirmasi Password Baru" placeholder="Ulangi Password Baru" minLength={8} value={confirmPassword} onChange={setConfirmPassword} />
          <div className="error-text">{passwordError}</div>
          <div className="settings-edit-panel-actions">
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}
