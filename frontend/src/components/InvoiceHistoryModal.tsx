"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { INVOICE_LOG_ACTION_META, LOG_ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { InvoiceLog } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  invoiceId: number | null;
  onClose: () => void;
}

export default function InvoiceHistoryModal({ open, invoiceId, onClose }: Props) {
  const [logs, setLogs] = useState<InvoiceLog[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || invoiceId == null) return;
    setLogs(null);
    setError("");
    api
      .getInvoiceLogs(invoiceId)
      .then(setLogs)
      .catch((err) => setError((err as Error).message));
  }, [open, invoiceId]);

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal">
        <div className="modal-header">
          <h3>Riwayat Invoice</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div style={{ marginTop: 16 }}>
          {error ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>Gagal memuat riwayat: {error}</p>
          ) : !logs || logs.length === 0 ? (
            logs == null ? (
              <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>Memuat riwayat...</p>
            ) : (
              <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>Belum ada riwayat.</p>
            )
          ) : (
            <div className="approval-log">
              {logs.map((log) => {
                const meta = INVOICE_LOG_ACTION_META[log.action] || { label: log.action, type: "neutral" as const };
                const actorLabel = log.actorRole ? LOG_ROLE_LABEL[log.actorRole] || log.actorRole : "-";
                return (
                  <div key={log.id} className={`approval-log-item approval-log-${meta.type}`}>
                    <div className="approval-log-dot"></div>
                    <div className="approval-log-body">
                      <div className="approval-log-header">
                        <span className="approval-log-title">{meta.label}</span>
                        <span className="approval-log-time">{formatDateTime(log.createdAt)}</span>
                      </div>
                      <div className="approval-log-actor">{actorLabel}</div>
                      {log.reason && (
                        <div className="approval-log-reason">
                          <strong>Catatan:</strong> {log.reason}
                        </div>
                      )}
                      {log.originalFilename && invoiceId != null && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="text-secondary" style={{ fontSize: "0.8rem" }}>{log.originalFilename}</span>
                          <a className="btn btn-secondary btn-sm" style={{ width: "auto", padding: "4px 10px", fontSize: "0.75rem" }} href={api.invoiceLogFileUrl(invoiceId, log.id)} target="_blank" rel="noopener noreferrer">Lihat PDF</a>
                          <a className="btn btn-secondary btn-sm" style={{ width: "auto", padding: "4px 10px", fontSize: "0.75rem" }} href={api.invoiceLogDownloadUrl(invoiceId, log.id)}>Download PDF</a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={onClose}>Tutup</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
