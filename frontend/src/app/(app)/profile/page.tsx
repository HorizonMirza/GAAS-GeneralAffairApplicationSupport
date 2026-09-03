"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COVER_PRESETS, ROLE_LABEL } from "@/lib/constants";
import { focusNextFieldOnEnter } from "@/lib/formNav";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Camera, ImagePlus } from "lucide-react";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, matches ProfileController's UploadPhoto limit

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

type ProfileDraft = { nama: string; username: string; noHp: string; email: string };

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const { showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ nama: "", username: "", noHp: "", email: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [coverVersion, setCoverVersion] = useState(0);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingCoverPreset, setSavingCoverPreset] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  function openEditProfile() {
    setProfileDraft({ nama: me!.nama, username: me!.username, noHp: me!.noHp ?? "", email: me!.email ?? "" });
    setEditOpen(true);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile({
        nama: profileDraft.nama.trim(),
        username: profileDraft.username.trim(),
        noHp: profileDraft.noHp.trim() || null,
        email: profileDraft.email.trim() || null,
      });
      await refresh();
      setEditOpen(false);
      showToast("Profil berhasil diperbarui");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      showToast("Format foto tidak didukung. Gunakan JPG atau PNG.", "error");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showToast("Ukuran foto maksimal 5 MB", "error");
      return;
    }

    setUploadingPhoto(true);
    try {
      await api.uploadProfilePhoto(file);
      await refresh();
      setPhotoVersion(Date.now());
      showToast("Foto profil berhasil diubah");
    } catch (err) {
      showToast((err as Error).message || "Gagal mengunggah foto", "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleCoverPresetPick(key: string) {
    setSavingCoverPreset(key);
    try {
      await api.updateCoverPreset(key);
      await refresh();
      showToast("Background berhasil diubah");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingCoverPreset(null);
    }
  }

  async function handleCoverPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      showToast("Format gambar tidak didukung. Gunakan JPG atau PNG.", "error");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showToast("Ukuran gambar maksimal 5 MB", "error");
      return;
    }

    setUploadingCover(true);
    try {
      await api.uploadCoverPhoto(file);
      await refresh();
      setCoverVersion(Date.now());
      showToast("Background berhasil diubah");
    } catch (err) {
      showToast((err as Error).message || "Gagal mengunggah gambar", "error");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleRemoveCoverPhoto() {
    setUploadingCover(true);
    try {
      await api.deleteCoverPhoto();
      await refresh();
      showToast("Foto background dihapus");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setUploadingCover(false);
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

  const bannerStyle =
    !me.hasCoverPhoto && me.coverPreset
      ? { background: COVER_PRESETS.find((p) => p.key === me.coverPreset)?.gradient }
      : undefined;

  return (
    <>
      <div className="card profile-hero-card">
        <div className="profile-hero-banner" style={bannerStyle}>
          {me.hasCoverPhoto && (
            <img className="profile-hero-banner-img" src={api.coverPhotoUrl(coverVersion || undefined)} alt="" />
          )}
        </div>
        <div className="profile-hero-header">
          <div className="profile-hero-avatar-wrap">
            <div className="profile-hero-avatar-backdrop" aria-hidden="true" />
            <div className="profile-hero-avatar">
              {me.hasPhoto ? (
                <img src={api.profilePhotoUrl(photoVersion || undefined)} alt="Foto profil" />
              ) : (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
              )}
            </div>
          </div>
          <div className="profile-hero-identity">
            <div className="profile-hero-name">{me.nama}</div>
            <div className="profile-role-badge">{ROLE_LABEL[me.role] || me.role}</div>
          </div>
          <div className="profile-hero-actions">
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openEditProfile}>
              Edit Profile
            </button>
          </div>
        </div>

        {(me.direktorat || me.divisi || me.departemen) && (
          <div className="profile-org-grid profile-org-grid-wide">
            {me.direktorat && (
              <div>
                <div className="profile-info-label">Direktorat</div>
                <div className="profile-info-value">{me.direktorat}</div>
              </div>
            )}
            {me.divisi && (
              <div>
                <div className="profile-info-label">Divisi</div>
                <div className="profile-info-value">{me.divisi}</div>
              </div>
            )}
            {me.departemen && (
              <div>
                <div className="profile-info-label">Departemen</div>
                <div className="profile-info-value">{me.departemen}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="profile-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="settings-section-header">
            <div className="settings-icon-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
            </div>
            <h3>Kontak &amp; Akun</h3>
          </div>
          {(Object.keys(FIELD_META) as AccountField[]).map((field) => (
            <div key={field} className="settings-icon-row">
              <div className="settings-icon-chip">{FIELD_META[field].icon}</div>
              <div className="settings-icon-row-body">
                <div className="profile-info-label">{FIELD_META[field].label}</div>
                <div className="profile-info-value">{currentValue[field] || "-"}</div>
              </div>
            </div>
          ))}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Perbarui foto, background, dan informasi akun Anda.</DialogDescription>
          </DialogHeader>

          <div className="edit-profile-cover" style={bannerStyle}>
            {me.hasCoverPhoto && (
              <img className="edit-profile-cover-img" src={api.coverPhotoUrl(coverVersion || undefined)} alt="" />
            )}
            <button
              type="button"
              className="edit-profile-cover-overlay"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
            >
              <ImagePlus width={16} height={16} />
              {uploadingCover ? "Mengunggah..." : "Ganti Background"}
            </button>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handleCoverPhotoChange} />
          </div>

          <div className="edit-profile-avatar-row">
            <div className="edit-profile-avatar">
              {me.hasPhoto ? (
                <img src={api.profilePhotoUrl(photoVersion || undefined)} alt="Foto profil" />
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
              )}
              <button
                type="button"
                className="edit-profile-avatar-overlay"
                aria-label="Ganti foto profil"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera width={18} height={18} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoChange} />
            </div>
            <div className="cover-preset-row">
              {COVER_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`cover-preset-swatch ${!me.hasCoverPhoto && me.coverPreset === p.key ? "active" : ""}`}
                  style={{ background: p.gradient }}
                  title={p.label}
                  aria-label={p.label}
                  disabled={savingCoverPreset !== null}
                  onClick={() => handleCoverPresetPick(p.key)}
                />
              ))}
              {me.hasCoverPhoto && (
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={handleRemoveCoverPhoto}>
                  Hapus Foto
                </button>
              )}
            </div>
          </div>
          <div className="profile-photo-hint">JPG atau PNG, maks. 5 MB</div>

          <form id="edit-profile-form" onSubmit={handleProfileSubmit} onKeyDown={focusNextFieldOnEnter}>
            <div className="field">
              <label htmlFor="edit-nama">Nama Akun</label>
              <input
                type="text"
                id="edit-nama"
                required
                value={profileDraft.nama}
                onChange={(e) => setProfileDraft((d) => ({ ...d, nama: e.target.value }))}
              />
            </div>
            {(Object.keys(FIELD_META) as AccountField[]).map((field) => (
              <div className="field" key={field}>
                <label htmlFor={`edit-${field}`}>{FIELD_META[field].label}</label>
                <input
                  id={`edit-${field}`}
                  type={FIELD_META[field].type}
                  placeholder={FIELD_META[field].placeholder}
                  required={field === "username"}
                  value={profileDraft[field]}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, [field]: e.target.value }))}
                />
              </div>
            ))}
          </form>

          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }}>Batal</button>
            </DialogClose>
            <button type="submit" form="edit-profile-form" className="btn btn-primary" style={{ width: "auto" }} disabled={savingProfile}>
              {savingProfile ? "Menyimpan..." : "Simpan"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
