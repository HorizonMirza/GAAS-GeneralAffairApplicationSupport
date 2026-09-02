"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/constants";
import { useToast } from "@/components/ui/ToastProvider";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, matches ProfileController's UploadPhoto limit

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const { showToast } = useToast();

  const [nama, setNama] = useState(me?.nama ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!me) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Only Nama Akun is edited here - Username/No HP/Email live on the Settings page, so they're
      // passed through unchanged rather than re-typed on this page.
      await api.updateProfile({ nama: nama.trim(), username: me!.username, noHp: me!.noHp, email: me!.email });
      await refresh();
      showToast("Profil berhasil diperbarui");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
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

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="card">
        <div className="card-header"><h3>Data Akun</h3></div>

        <div className="profile-photo-row">
          <div className="profile-photo-preview">
            {me.hasPhoto ? (
              <img src={api.profilePhotoUrl(photoVersion || undefined)} alt="Foto profil" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
            )}
          </div>
          <div>
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
              {uploadingPhoto ? "Mengunggah..." : "Ganti Foto"}
            </button>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoChange} />
            <div className="profile-photo-hint">JPG atau PNG, maks. 5 MB</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="nama-akun">Nama Akun</label>
            <input type="text" id="nama-akun" required value={nama} onChange={(e) => setNama(e.target.value)} />
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
          <div className="error-text">{error}</div>
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    </div>
  );
}
