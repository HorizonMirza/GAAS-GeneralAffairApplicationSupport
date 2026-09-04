"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PermintaanArsipLog } from "@/lib/types";
import ApprovalLog from "./ApprovalLog";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  itemId: number | null;
  onClose: () => void;
}

export default function ArsipStatusHistoryModal({ open, itemId, onClose }: Props) {
  const [logs, setLogs] = useState<PermintaanArsipLog[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || itemId == null) return;
    setLogs(null);
    setError("");
    api
      .getArsipLogs(itemId)
      .then(setLogs)
      .catch((err) => setError((err as Error).message));
  }, [open, itemId]);

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal">
        <div className="modal-header">
          <h3>Riwayat Approval</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div style={{ marginTop: 16 }}>
          {error ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>Gagal memuat riwayat: {error}</p>
          ) : (
            <ApprovalLog logs={logs} />
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={onClose}>Tutup</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
