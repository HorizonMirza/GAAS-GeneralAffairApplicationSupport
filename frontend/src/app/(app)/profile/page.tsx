"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COVER_PRESETS, ROLE_LABEL } from "@/lib/constants";
import { useToast } from "@/components/ui/ToastProvider";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, matches ProfileController's UploadPhoto limit

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const { showToast } = useToast();

  const [editingNama, setEditingNama] = useState(false);
  const [namaDraft, setNamaDraft] = useState(me?.nama ?? "");
  const [savingNama, setSavingNama] = useState(false);

  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [editingCover, setEditingCover] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingCoverPreset, setSavingCoverPreset] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!me) return null;

  function openNamaEdit() {
    setNamaDraft(me!.nama);
    setEditingNama(true);
  }

  async function handleNamaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingNama(true);
    try {
      // Only Nama Akun is edited here - Username/No HP/Email live on the Settings page, so they're
      // passed through unchanged rather than re-typed on this page.
      await api.updateProfile({ nama: namaDraft.trim(), username: me!.username, noHp: me!.noHp, email: me!.email });
      await refresh();
      setEditingNama(false);
      showToast("Nama akun berhasil diperbarui");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingNama(false);
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

  const bannerStyle =
    !me.hasCoverPhoto && me.coverPreset
      ? { background: COVER_PRESETS.find((p) => p.key === me.coverPreset)?.gradient }
      : undefined;

  return (
    <div className="card profile-hero-card">
      <div className="profile-hero-banner" style={bannerStyle}>
        {me.hasCoverPhoto && (
          <img className="profile-hero-banner-img" src={api.coverPhotoUrl(coverVersion || undefined)} alt="" />
        )}
      </div>
      <div className="profile-hero-header">
        <div className="profile-hero-avatar">
          {me.hasPhoto ? (
            <img src={api.profilePhotoUrl(photoVersion || undefined)} alt="Foto profil" />
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
          )}
        </div>
        <div className="profile-hero-identity">
          <div className="profile-hero-name">{me.nama}</div>
          <div className="profile-role-badge">{ROLE_LABEL[me.role] || me.role}</div>
        </div>
        <div className="profile-hero-actions">
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
            {uploadingPhoto ? "Mengunggah..." : "Ganti Foto"}
          </button>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoChange} />
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setEditingCover((v) => !v)}>
            Ganti Background
          </button>
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handleCoverPhotoChange} />
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={openNamaEdit}>
            Ubah Nama
          </button>
        </div>
      </div>
      <div className="profile-photo-hint profile-photo-hint-header">JPG atau PNG, maks. 5 MB</div>

      {editingCover && (
        <div className="settings-edit-panel">
          <div className="field">
            <label>Pilih Warna Background</label>
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
            </div>
          </div>
          <div className="settings-edit-panel-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto" }}
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploadingCover ? "Mengunggah..." : "Upload Gambar"}
            </button>
            {me.hasCoverPhoto && (
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={handleRemoveCoverPhoto}>
                Hapus Foto
              </button>
            )}
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={() => setEditingCover(false)}>
              Selesai
            </button>
          </div>
        </div>
      )}

      {editingNama && (
        <form className="settings-edit-panel" onSubmit={handleNamaSubmit}>
          <div className="field">
            <label htmlFor="nama-akun">Nama Akun</label>
            <input type="text" id="nama-akun" required autoFocus value={namaDraft} onChange={(e) => setNamaDraft(e.target.value)} />
          </div>
          <div className="settings-edit-panel-actions">
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setEditingNama(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={savingNama}>
              {savingNama ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

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
  );
}
