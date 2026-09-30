"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import ModalOverlay from "./ModalOverlay";
import PasswordField from "./PasswordField";

interface Props {
  open: boolean;
  title: string;
  // The item's own fields, rendered exactly like its Add/Edit form (disabled inputs) so this
  // reads as "the same form, but for deleting" rather than a different kind of dialog.
  children?: React.ReactNode;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
  // ModalOverlay always renders its children (visibility is CSS-only, see that component), so
  // this modal's password field sits in the DOM even while closed - a page that mounts more than
  // one DeleteWithPasswordModal at once (e.g. SuperAdminAppSettingsTab's several cards) needs a
  // distinct id per instance to avoid a duplicate-id collision. Defaults to the original hardcoded
  // id so every existing single-modal-per-page caller is unaffected.
  passwordFieldId?: string;
}

// A permanent delete of a room/vehicle roster entry - gated by re-entering the Super Admin's own
// password (verified server-side). Same modal chrome and field layout as the Add/Edit form in the
// same tab, just with disabled fields and a red "Hapus" button instead of green "Save".
export default function DeleteWithPasswordModal({ open, title, children, onConfirm, onClose, passwordFieldId = "delete-confirm-password" }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError("");
    setBusy(false);
  }, [open]);

  async function handleConfirm() {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={busy ? () => {} : onClose} className={`modal-overlay modal-overlay-centered ${open ? "" : "hidden"}`}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}>&times;</button>
        </div>

        {children}

        <div style={{ marginTop: 12 }}>
          <PasswordField
            id={passwordFieldId}
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={password}
            error={error}
            onChange={(v) => { setPassword(v); if (error) setError(""); }}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-confirm-danger" style={{ width: "auto" }} disabled={!password || busy} onClick={handleConfirm}>
            {busy ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
