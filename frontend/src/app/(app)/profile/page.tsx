"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COVER_PRESETS, getRoleLabelMap } from "@/lib/constants";
import { focusNextFieldOnEnter } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { Camera, Lock, Palette, Pencil, X } from "lucide-react";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, matches ProfileController's UploadPhoto limit

type AccountField = "username" | "noHp" | "email";

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  minLength,
  error,
  hint,
  icon,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const errorId = error ? `${id}-error` : undefined;
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
        <button type="button" className="password-toggle" aria-label={t("profile.showPassword")} onClick={() => setShow((v) => !v)}>
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          )}
        </button>
      </div>
      {error && <div className="field-error-text" id={errorId} aria-live="polite">{error}</div>}
      {!error && hint && <div className="field-hint-text">{hint}</div>}
    </div>
  );
}

type PasswordErrors = { currentPassword?: string; newPassword?: string; confirmPassword?: string; general?: string };

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const { showToast } = useToast();
  const { language, t } = useLanguage();

  const FIELD_META: Record<AccountField, { label: string; type: string; placeholder?: string; icon: React.ReactNode }> = {
    username: {
      label: t("profile.usernameLabel"),
      type: "text",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
      ),
    },
    noHp: {
      label: t("profile.phoneLabel"),
      type: "tel",
      placeholder: t("profile.phonePlaceholder"),
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      ),
    },
    email: {
      label: t("profile.emailLabel"),
      type: "email",
      placeholder: "nama@perusahaan.com",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m2 6 10 7 10-7"></path></svg>
      ),
    },
  };

  const NEW_FIELD_LABEL: Record<AccountField, string> = {
    username: t("profile.newUsername"),
    noHp: t("profile.newPhone"),
    email: t("profile.newEmail"),
  };

  function validateCurrentPassword(value: string): string | undefined {
    if (!value.trim()) return t("profile.errCurrentPasswordRequired");
    return undefined;
  }

  function validateNewPassword(value: string, currentPassword: string): string | undefined {
    if (!value.trim()) return t("profile.errNewPasswordRequired");
    if (value.length < 8) return t("profile.errPasswordMinLength");
    if (!/(?=.*[a-z])/.test(value)) return t("profile.errPasswordLowercase");
    if (!/(?=.*[A-Z])/.test(value)) return t("profile.errPasswordUppercase");
    if (!/(?=.*\d)/.test(value)) return t("profile.errPasswordNumber");
    if (value === currentPassword) return t("profile.errPasswordSameAsCurrent");
    return undefined;
  }

  function validateConfirmPassword(value: string, newPassword: string): string | undefined {
    if (!value.trim()) return t("profile.errConfirmPasswordRequired");
    if (value !== newPassword) return t("profile.errConfirmPasswordMismatch");
    return undefined;
  }

  const [editOpen, setEditOpen] = useState(false);
  const [namaDraft, setNamaDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [editingField, setEditingField] = useState<AccountField | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");
  const [fieldPassword, setFieldPassword] = useState("");
  const [fieldPasswordError, setFieldPasswordError] = useState("");
  const [savingField, setSavingField] = useState(false);

  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoSrc, setPendingPhotoSrc] = useState<string | null>(null);

  const [coverVersion, setCoverVersion] = useState(0);
  const [removingCover, setRemovingCover] = useState(false);
  const [savingCoverPreset, setSavingCoverPreset] = useState<string | null>(null);
  const [showCoverPresets, setShowCoverPresets] = useState(false);

  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  if (!me) return null;

  const currentValue: Record<AccountField, string> = {
    username: me.username,
    noHp: me.noHp ?? "",
    email: me.email ?? "",
  };

  function openEditProfile() {
    setNamaDraft(me!.nama);
    setShowCoverPresets(false);
    setEditOpen(true);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile({
        nama: namaDraft.trim(),
        username: me!.username,
        noHp: me!.noHp,
        email: me!.email,
      });
      await refresh();
      setEditOpen(false);
      showToast(t("profile.toastProfileUpdated"));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  function openFieldEdit(field: AccountField) {
    setFieldDraft(currentValue[field]);
    setFieldPassword("");
    setFieldPasswordError("");
    setEditingField(field);
    closePasswordForm();
  }

  function openPasswordForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({});
    setEditingField(null);
    setPasswordFormOpen(true);
  }

  function closePasswordForm() {
    setPasswordFormOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({});
  }

  async function handleFieldSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingField) return;
    if (!fieldPassword.trim()) {
      setFieldPasswordError(t("profile.errCurrentPasswordRequired"));
      return;
    }

    setSavingField(true);
    try {
      const next = { ...currentValue, [editingField]: fieldDraft.trim() };
      await api.updateProfile({
        nama: me!.nama,
        username: next.username,
        noHp: next.noHp || null,
        email: next.email || null,
        currentPassword: fieldPassword,
      });
      await refresh();
      showToast(`${FIELD_META[editingField].label} ${t("profile.toastUpdatedSuffix")}`);
      setEditingField(null);
    } catch (err) {
      setFieldPasswordError((err as Error).message);
    } finally {
      setSavingField(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      showToast(t("profile.toastPhotoFormatUnsupported"), "error");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showToast(t("profile.toastPhotoTooLarge"), "error");
      return;
    }

    setPendingPhotoSrc(URL.createObjectURL(file));
  }

  function closePhotoCrop() {
    if (pendingPhotoSrc) URL.revokeObjectURL(pendingPhotoSrc);
    setPendingPhotoSrc(null);
  }

  async function handlePhotoCropConfirm(blob: Blob) {
    setUploadingPhoto(true);
    try {
      await api.uploadProfilePhoto(new File([blob], "profile-photo.png", { type: "image/png" }));
      await refresh();
      setPhotoVersion(Date.now());
      showToast(t("profile.toastPhotoUpdated"));
      closePhotoCrop();
    } catch (err) {
      showToast((err as Error).message || t("profile.toastPhotoUploadFailed"), "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleCoverPresetPick(key: string) {
    setSavingCoverPreset(key);
    try {
      await api.updateCoverPreset(key);
      await refresh();
      showToast(t("profile.toastBackgroundUpdated"));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingCoverPreset(null);
    }
  }

  async function handleRemoveCoverPhoto() {
    setRemovingCover(true);
    try {
      await api.deleteCoverPhoto();
      await refresh();
      showToast(t("profile.toastBackgroundRemoved"));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRemovingCover(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    const currentPasswordError = validateCurrentPassword(currentPassword);
    const newPasswordError = validateNewPassword(newPassword, currentPassword);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, newPassword);
    if (currentPasswordError || newPasswordError || confirmPasswordError) {
      setPasswordErrors({ currentPassword: currentPasswordError, newPassword: newPasswordError, confirmPassword: confirmPasswordError });
      return;
    }

    setPasswordErrors({});
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast(t("profile.toastPasswordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFormOpen(false);
    } catch (err) {
      setPasswordErrors({ general: (err as Error).message });
    } finally {
      setSavingPassword(false);
    }
  }

  const bannerStyle =
    !me.hasCoverPhoto && me.coverPreset
      ? { background: COVER_PRESETS.find((p) => p.key === me.coverPreset)?.gradient }
      : undefined;

  const roleLabel = getRoleLabelMap(language);

  return (
    <>
      <div className="card profile-hero-card">
        <div className="profile-hero-banner" style={bannerStyle}>
          {me.hasCoverPhoto && (
            <img className="profile-hero-banner-img" src={api.coverPhotoUrl(coverVersion || undefined)} alt="" />
          )}
          <button type="button" className="profile-hero-edit-btn" onClick={openEditProfile}>
            <Pencil width={14} height={14} />
            {t("profile.editProfile")}
          </button>
        </div>
        <div className="profile-hero-body">
          <div className="profile-hero-avatar-wrap">
            <div className="profile-hero-avatar">
              {me.hasPhoto ? (
                <img src={api.profilePhotoUrl(photoVersion || undefined)} alt={t("profile.profilePhotoAlt")} />
              ) : (
                <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
              )}
            </div>
          </div>
          <div>
            <div className="profile-hero-name">{me.nama}</div>
            <div className="profile-role-badge">{roleLabel[me.role] || me.role}</div>
          </div>
        </div>

        {(me.direktorat || me.divisi || me.departemen) && (
          <div className="profile-org-grid profile-org-grid-wide">
            {me.direktorat && (
              <div>
                <div className="profile-info-label">{t("profile.directorate")}</div>
                <div className="profile-info-value">{me.direktorat}</div>
              </div>
            )}
            {me.divisi && (
              <div>
                <div className="profile-info-label">{t("profile.division")}</div>
                <div className="profile-info-value">{me.divisi}</div>
              </div>
            )}
            {me.departemen && (
              <div>
                <div className="profile-info-label">{t("profile.department")}</div>
                <div className="profile-info-value">{me.departemen}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
          {(Object.keys(FIELD_META) as AccountField[]).map((field) => (
            <div key={field} className="settings-icon-row">
              <div className="settings-icon-chip">{FIELD_META[field].icon}</div>
              <div className="settings-icon-row-body">
                <div className="profile-info-label">{FIELD_META[field].label}</div>
                <div className="profile-info-value">{currentValue[field] || "-"}</div>
              </div>
              <button type="button" className="btn btn-secondary settings-ubah-btn" onClick={() => openFieldEdit(field)}>
                {t("common.change")}
              </button>
            </div>
          ))}

          <div className="settings-icon-row">
            <div className="settings-icon-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div className="settings-icon-row-body">
              <div className="profile-info-label">{t("profile.passwordLabel")}</div>
              <div className="profile-info-value">••••••••</div>
            </div>
            <button type="button" className="btn btn-secondary settings-ubah-btn" onClick={openPasswordForm}>
              {t("common.change")}
            </button>
          </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.editProfile")}</DialogTitle>
          </DialogHeader>

          <div className="edit-profile-cover-wrap">
            <div className="edit-profile-cover" style={bannerStyle}>
              {me.hasCoverPhoto && (
                <img className="edit-profile-cover-img" src={api.coverPhotoUrl(coverVersion || undefined)} alt="" />
              )}
              <div className="edit-profile-cover-actions">
                <button
                  type="button"
                  className="edit-profile-icon-btn"
                  aria-label={t("profile.chooseBackgroundColor")}
                  onClick={() => setShowCoverPresets((v) => !v)}
                >
                  <Palette width={16} height={16} />
                </button>
                {me.hasCoverPhoto && (
                  <button
                    type="button"
                    className="edit-profile-icon-btn"
                    aria-label={t("profile.removeBackgroundPhoto")}
                    disabled={removingCover}
                    onClick={handleRemoveCoverPhoto}
                  >
                    <X width={16} height={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="edit-profile-avatar">
              {me.hasPhoto ? (
                <img src={api.profilePhotoUrl(photoVersion || undefined)} alt={t("profile.profilePhotoAlt")} />
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
              )}
              <button
                type="button"
                className="edit-profile-icon-btn edit-profile-avatar-edit-btn"
                aria-label={t("profile.changeProfilePhoto")}
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera width={16} height={16} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoChange} />
            </div>
          </div>

          <form id="edit-profile-form" onSubmit={handleProfileSubmit} onKeyDown={focusNextFieldOnEnter}>
            <div className="field">
              <label htmlFor="edit-nama">{t("profile.accountNameLabel")}</label>
              <input
                type="text"
                id="edit-nama"
                required
                value={namaDraft}
                onChange={(e) => setNamaDraft(e.target.value)}
              />
            </div>

            {showCoverPresets && (
              <div className="field">
                <label>{t("profile.coverImageLabel")}</label>
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
            )}
          </form>

          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }}>{t("common.cancel")}</button>
            </DialogClose>
            <button type="submit" form="edit-profile-form" className="btn btn-primary" style={{ width: "auto" }} disabled={savingProfile}>
              {savingProfile ? t("common.saving") : t("common.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingField !== null} onOpenChange={(open) => { if (!open) setEditingField(null); }}>
        <DialogContent>
          {editingField && (
            <>
              <DialogHeader>
                <DialogTitle>{t("common.change")} {FIELD_META[editingField].label}</DialogTitle>
              </DialogHeader>

              <form id="field-edit-form" onSubmit={handleFieldSubmit} onKeyDown={focusNextFieldOnEnter}>
                <div className="settings-current-value">
                  <div className="settings-current-value-icon">{FIELD_META[editingField].icon}</div>
                  <div>
                    <div className="settings-current-value-label">{t("profile.currentValueLabel")}</div>
                    <div className="settings-current-value-text">{currentValue[editingField] || "-"}</div>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="field-draft">{NEW_FIELD_LABEL[editingField]}</label>
                  <div className="field-icon-wrap">
                    <span className="field-input-icon">{FIELD_META[editingField].icon}</span>
                    <input
                      id="field-draft"
                      type={FIELD_META[editingField].type}
                      placeholder={FIELD_META[editingField].placeholder}
                      required={editingField === "username"}
                      autoFocus
                      value={fieldDraft}
                      onChange={(e) => setFieldDraft(e.target.value)}
                    />
                  </div>
                </div>

                <PasswordField
                  id="field-password"
                  label={t("profile.passwordLabel")}
                  placeholder={t("profile.enterCurrentPassword")}
                  icon={<Lock width={15} height={15} />}
                  value={fieldPassword}
                  error={fieldPasswordError}
                  onChange={(v) => {
                    setFieldPassword(v);
                    if (fieldPasswordError) setFieldPasswordError("");
                  }}
                />
              </form>

              <DialogFooter>
                <DialogClose asChild>
                  <button type="button" className="btn btn-secondary" style={{ width: "auto" }}>{t("common.cancel")}</button>
                </DialogClose>
                <button type="submit" form="field-edit-form" className="btn btn-primary" style={{ width: "auto" }} disabled={savingField}>
                  {savingField ? t("common.saving") : t("common.save")}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordFormOpen} onOpenChange={(open) => { if (!open) closePasswordForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.changePasswordTitle")}</DialogTitle>
          </DialogHeader>

          <form id="password-edit-form" onSubmit={handlePasswordSubmit} onKeyDown={focusNextFieldOnEnter}>
            <PasswordField
              id="current-password"
              label={t("profile.currentPasswordLabel")}
              placeholder={t("profile.min8Chars")}
              icon={<Lock width={15} height={15} />}
              value={currentPassword}
              error={passwordErrors.currentPassword}
              onChange={(v) => {
                setCurrentPassword(v);
                if (passwordErrors.currentPassword) setPasswordErrors((prev) => ({ ...prev, currentPassword: validateCurrentPassword(v) }));
              }}
            />
            <PasswordField
              id="new-password"
              label={t("profile.newPasswordLabel")}
              placeholder={t("profile.min8Chars")}
              minLength={8}
              icon={<Lock width={15} height={15} />}
              value={newPassword}
              error={passwordErrors.newPassword}
              hint={t("profile.newPasswordHint")}
              onChange={(v) => {
                setNewPassword(v);
                if (passwordErrors.newPassword) setPasswordErrors((prev) => ({ ...prev, newPassword: validateNewPassword(v, currentPassword) }));
                if (passwordErrors.confirmPassword && confirmPassword) {
                  setPasswordErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, v) }));
                }
              }}
            />
            <PasswordField
              id="confirm-password"
              label={t("profile.confirmNewPasswordLabel")}
              placeholder={t("profile.repeatNewPassword")}
              minLength={8}
              icon={<Lock width={15} height={15} />}
              value={confirmPassword}
              error={passwordErrors.confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                if (passwordErrors.confirmPassword) setPasswordErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(v, newPassword) }));
              }}
            />
            {passwordErrors.general && <div className="error-text">{passwordErrors.general}</div>}
          </form>

          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }}>{t("common.cancel")}</button>
            </DialogClose>
            <button type="submit" form="password-edit-form" className="btn btn-primary" style={{ width: "auto" }} disabled={savingPassword}>
              {savingPassword ? t("common.saving") : t("common.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog imageSrc={pendingPhotoSrc} onCancel={closePhotoCrop} onConfirm={handlePhotoCropConfirm} saving={uploadingPhoto} />
    </>
  );
}
