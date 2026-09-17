import { getStatusLabel, getRejectedByLabel } from "@/lib/constants";
import type { Pengiriman, Status } from "@/lib/types";

interface Props {
  status: Status;
  rejectTarget?: Pengiriman["rejectTarget"];
  departemen?: Pengiriman["departemen"];
  createdByRole?: Pengiriman["createdByRole"];
}

export default function StatusBadge({ status, rejectTarget = null, departemen = null, createdByRole = "ADMIN_DEPARTEMEN" }: Props) {
  const pseudoItem = { status, rejectTarget, departemen, createdByRole } as Pengiriman;
  const rejectedByLabel = getRejectedByLabel(pseudoItem);
  const label = getStatusLabel(status, departemen);
  const cls = status.toLowerCase();
  if (rejectedByLabel) {
    return (
      <div className="badge-stack">
        <span className={`badge badge-${cls}`}>{label}</span>
        <span className="badge badge-waiting">{rejectedByLabel}</span>
      </div>
    );
  }
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
