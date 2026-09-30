import { getStatusLabel, getWaitingLabel } from "@/lib/constants";
import type { Pengiriman, Status } from "@/lib/types";

interface Props {
  status: Status;
  rejectTarget?: Pengiriman["rejectTarget"];
  departemen?: Pengiriman["departemen"];
  createdByRole?: Pengiriman["createdByRole"];
}

export default function StatusBadge({ status, rejectTarget = null, departemen = null, createdByRole = "ADMIN_DEPARTEMEN" }: Props) {
  const pseudoItem = { status, rejectTarget, departemen, createdByRole } as Pengiriman;
  const waitingLabel = getWaitingLabel(pseudoItem);
  const label = getStatusLabel(status, departemen);
  const cls = status.toLowerCase();
  if (waitingLabel) {
    return (
      <div className="badge-stack">
        <span className={`badge badge-${cls}`}>{label}</span>
        <span className="badge badge-waiting">{waitingLabel}</span>
      </div>
    );
  }
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
