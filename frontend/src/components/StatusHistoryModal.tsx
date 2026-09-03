"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PengirimanLog } from "@/lib/types";
import ApprovalLog from "./ApprovalLog";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  itemId: number | null;
  onClose: () => void;
}

export default function StatusHistoryModal({ open, itemId, onClose }: Props) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<PengirimanLog[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || itemId == null) return;
    setLogs(null);
    setError("");
    api
      .getPengirimanLogs(itemId)
      .then(setLogs)
      .catch((err) => setError((err as Error).message));
  }, [open, itemId]);

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal">
        <div className="modal-header">
          <h3>{t("history.title")}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div style={{ marginTop: 16 }}>
          {error ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>{t("history.loadFailed")}: {error}</p>
          ) : (
            <ApprovalLog logs={logs} />
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
