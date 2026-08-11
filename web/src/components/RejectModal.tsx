"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { RejectTarget } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

export type RejectType = "l1" | "ga" | "ga-approval" | "kpu";

interface Props {
  open: boolean;
  targetId: number | null;
  targetType: RejectType | null;
  onClose: () => void;
  onDone: () => void;
}

const NEEDS_TARGET_CHOICE: RejectType[] = ["ga-approval", "kpu"];

const SUCCESS_MESSAGE: Record<RejectType, string> = {
  l1: "Data ditolak, dikembalikan ke Admin Departemen/Divisi",
  ga: "Data ditolak, dikembalikan ke Admin Departemen/Divisi",
  "ga-approval": "Data ditolak",
  kpu: "Data ditolak",
};

export default function RejectModal({ open, targetId, targetType, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<RejectTarget | "">("");
  const [error, setError] = useState("");
  const { showToast } = useToast();

  if (!open) return null;

  const needsTarget = targetType ? NEEDS_TARGET_CHOICE.includes(targetType) : false;

  function reset() {
    setReason("");
    setTarget("");
    setError("");
  }

  async function handleConfirm() {
    if (targetId == null || !targetType) return;
    const reasonValue = reason.trim() || null;
    if (needsTarget && !target) {
      setError("Pilih tujuan pengembalian data terlebih dahulu.");
      return;
    }
    try {
      let message = SUCCESS_MESSAGE[targetType];
      if (targetType === "l1") {
        await api.rejectL1(targetId, reasonValue);
      } else if (targetType === "ga") {
        await api.rejectGa(targetId, reasonValue);
      } else if (targetType === "ga-approval") {
        await api.rejectGaApproval(targetId, reasonValue, target as RejectTarget);
        message = target === "GA" ? "Data ditolak, dikembalikan ke Admin GA" : "Data ditolak, dikembalikan ke Admin Departemen/Divisi";
      } else {
        await api.rejectKpu(targetId, reasonValue, target as RejectTarget);
        message = target === "GA" ? "Data ditolak, dikembalikan ke Admin GA" : "Data ditolak, dikembalikan ke Admin Departemen/Divisi";
      }
      showToast(message);
      reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Reject Data</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {needsTarget && (
          <div className="field">
            <label>Kembalikan data ke</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                <input type="radio" name="reject-target" value="GA" checked={target === "GA"} onChange={() => setTarget("GA")} />
                Admin GA
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                <input type="radio" name="reject-target" value="ORIGIN" checked={target === "ORIGIN"} onChange={() => setTarget("ORIGIN")} />
                Admin Departemen/Divisi (pembuat data)
              </label>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="reject-reason-input">Alasan (opsional)</label>
          <textarea
            id="reject-reason-input"
            placeholder="Contoh: Barang fisik tidak ditemukan"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: "auto", background: "#d64545", color: "#fff", border: "none" }}
            onClick={handleConfirm}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
