"use client";

import { useEffect, useRef, useState } from "react";
import ModalOverlay from "./ModalOverlay";

// The word the Super Admin has to type before the delete button unlocks.
const KATA_KUNCI = "HAPUS";

export interface BulkDeleteTarget {
  // Section name as it appears on the page ("Room Booking", "Archive", ...).
  section: string;
  // What one row is called in this section ("booking", "pengajuan", "transaksi", ...) - used in
  // the sentence so it reads like the section's own pagination line.
  noun: string;
  // How many rows the section's table currently reports, i.e. how many will go.
  count: number;
  // Human-readable description of every filter currently narrowing the table, e.g.
  // ["Status: Approved", "Bulan: September 2026"]. Empty means nothing is filtered.
  filters: string[];
  onConfirm: () => Promise<void>;
}

interface Props {
  target: BulkDeleteTarget | null;
  onClose: () => void;
}

// A permanent delete of everything a section is showing is the most destructive thing this app
// can do, and the shared confirm dialog is one click on a button that already says "Delete" all
// over the same page. So this one states the exact count, spells out whether a filter is
// narrowing it (the difference between deleting this month and deleting everything), and does
// not unlock until the word is typed.
export default function BulkDeleteModal({ target, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-arm for every new target, so a previous confirmation never carries over into the next
  // section's dialog.
  useEffect(() => {
    if (!target) return;
    setTyped("");
    setBusy(false);
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [target]);

  const unlocked = typed.trim().toUpperCase() === KATA_KUNCI;
  const nothingToDelete = !target || target.count === 0;

  async function handleConfirm() {
    if (!target || !unlocked || busy) return;
    setBusy(true);
    try {
      await target.onConfirm();
      onClose();
    } finally {
      // The caller toasts its own error; leaving the modal open lets them retry without
      // re-opening it and re-typing.
      setBusy(false);
    }
  }

  return (
    <ModalOverlay
      open={!!target}
      onClose={busy ? () => {} : onClose}
      className={`modal-overlay modal-overlay-centered ${target ? "" : "hidden"}`}
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Hapus Semua &mdash; {target?.section}</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}>&times;</button>
        </div>

        {nothingToDelete ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            Tidak ada {target?.noun} untuk dihapus pada tampilan ini.
          </p>
        ) : (
          <>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{target.count} {target.noun}</strong>{" "}
              akan dihapus permanen beserta seluruh riwayat approval dan chat-nya. Tindakan ini
              tidak dapat dibatalkan.
            </p>

            {target.filters.length > 0 ? (
              <div className="bulk-delete-scope">
                <span className="bulk-delete-scope-title">Hanya yang cocok dengan filter aktif:</span>
                <ul className="bulk-delete-scope-list">
                  {target.filters.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            ) : (
              <div className="bulk-delete-scope bulk-delete-scope-danger">
                <span className="bulk-delete-scope-title">Tidak ada filter aktif</span>
                <p style={{ margin: "4px 0 0" }}>
                  Seluruh data {target.section} akan dihapus. Pasang filter dulu kalau hanya ingin
                  menghapus sebagian.
                </p>
              </div>
            )}

            <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label htmlFor="bulk-delete-konfirmasi">
                Ketik <strong>{KATA_KUNCI}</strong> untuk mengonfirmasi
              </label>
              <input
                id="bulk-delete-konfirmasi"
                ref={inputRef}
                type="text"
                value={typed}
                autoComplete="off"
                disabled={busy}
                placeholder={KATA_KUNCI}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && unlocked) handleConfirm(); }}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={onClose} disabled={busy}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-confirm-danger"
                style={{ width: "auto" }}
                disabled={!unlocked || busy}
                onClick={handleConfirm}
              >
                {busy ? "Menghapus..." : `Hapus ${target.count} ${target.noun}`}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
