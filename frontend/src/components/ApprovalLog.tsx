import { getLogActionMeta, getLogRoleLabelMap } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingKendaraanLog, BookingRuangLog, PengirimanLog, PerbaikanSaranaLog, PermintaanArsipLog, PermintaanAtkLog } from "@/lib/types";

export default function ApprovalLog({ logs }: { logs: (PengirimanLog | BookingRuangLog | BookingKendaraanLog | PermintaanAtkLog | PerbaikanSaranaLog | PermintaanArsipLog)[] | null }) {
  const { language, t } = useLanguage();
  if (!logs || logs.length === 0) {
    return <p className="text-secondary" style={{ textAlign: "center", padding: "16px 0" }}>{t("common.noApprovalHistory")}</p>;
  }
  const actionMeta = getLogActionMeta(language);
  const roleLabel = getLogRoleLabelMap(language);
  return (
    <div className="approval-log">
      {logs.map((log) => {
        const meta = actionMeta[log.action] || { label: log.action, type: "neutral" as const };
        const actorLabel = log.actorRole ? roleLabel[log.actorRole] || log.actorRole : "-";
        let title = meta.label;
        if (log.action === "APPROVED_L1" || log.action === "REJECTED_L1") {
          const track = log.actorRole === "APPROVAL_DIVISI" ? t("word.division") : t("word.department");
          title = log.action === "APPROVED_L1" ? `${t("word.approved")} ${t("word.approval")} ${track}` : `${t("word.rejected")} ${t("word.approval")} ${track}`;
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
                  <strong>{t("common.notes")}:</strong> {log.reason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
