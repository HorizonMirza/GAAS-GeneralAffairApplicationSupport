"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import ModalOverlay from "./ModalOverlay";
import PasswordField from "./PasswordField";

interface Props {
  open: boolean;
  title: string;
  // e.g. `ruang meeting "Ruang Golf"` - read as a sentence continuing "Anda akan menghapus ...".
  itemLabel: string;
  // Read-only summary of the item being removed (Nama/Kapasitas/Lantai/... etc.) - reuses the
  // same .detail-grid/.detail-row treatment every other Detail modal in the app uses.
  details?: { label: string; value: string }[];
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

// A permanent delete of a room/vehicle roster entry - gated by re-entering the Super Admin's own
// password (verified server-side), same styling as the Add/Edit forms in the same tab.
export default function DeleteWithPasswordModal({ open, title, itemLabel, details, onConfirm, onClose }: Props) {
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
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}>&times;</button>
        </div>

        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Anda akan menghapus <strong style={{ color: "var(--text-primary)" }}>{itemLabel}</strong> secara
          permanen. Tindakan ini tidak dapat dibatalkan.
        </p>

        {details && details.length > 0 && (
          <div className="detail-grid" style={{ marginTop: 12, maxHeight: "none", overflowY: "visible" }}>
            {details.map((d) => (
              <div className="detail-row" key={d.label}>
                <span className="detail-label">{d.label}</span>
                <span className="detail-value">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <PasswordField
            id="delete-confirm-password"
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
