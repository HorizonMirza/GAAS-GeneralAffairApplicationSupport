import { LOG_ACTION_META, LOG_ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { BookingKendaraanLog, BookingRuangLog, PengirimanLog, PerbaikanSaranaLog, PermintaanArsipLog, PermintaanAtkLog } from "@/lib/types";

export default function ApprovalLog({ logs }: { logs: (PengirimanLog | BookingRuangLog | BookingKendaraanLog | PermintaanAtkLog | PerbaikanSaranaLog | PermintaanArsipLog)[] | null }) {
  if (!logs || logs.length === 0) {
    return <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>Belum ada riwayat approval.</p>;
  }
  return (
    <div className="approval-log">
      {logs.map((log) => {
        const meta = LOG_ACTION_META[log.action] || { label: log.action, type: "neutral" as const };
        const actorLabel = log.actorRole ? LOG_ROLE_LABEL[log.actorRole] || log.actorRole : "-";
        let title = meta.label;
        if (log.action === "APPROVED_L1" || log.action === "REJECTED_L1") {
          const track = log.actorRole === "APPROVAL_DIVISI" ? "Divisi" : "Departemen";
          title = log.action === "APPROVED_L1" ? `Disetujui Approval ${track}` : `Ditolak Approval ${track}`;
        }
        return (
          <div key={log.id} className={`approval-log-item approval-log-${meta.type}`}>
            <div className="approval-log-dot"></div>
            <div className="approval-log-body">
              <div className="approval-log-header">
                <span className="approval-log-title">{title}</span>
                <span className="approval-log-time">{formatDateTime(log.createdAt)}</span>
              </div>
              <div className="approval-log-actor">{actorLabel}</div>
              {log.reason && (
                <div className="approval-log-reason">
                  <strong>Catatan:</strong> {log.reason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
