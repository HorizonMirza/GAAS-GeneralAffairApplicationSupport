import { getSimpleWaitingLabel, getStatusLabel } from "@/lib/constants";
import type { PermintaanAtk, Status } from "@/lib/types";

interface Props {
  status: Status;
  departemen?: PermintaanAtk["departemen"];
  createdByRole?: PermintaanAtk["createdByRole"];
}

// A rejected request isn't a dead end here (see PermintaanAtkController.IsEditableByOrigin) - it
// always routes back to the same origin creator to revise and resubmit, so it gets the same
// "Waiting: X" second badge as Pengiriman's own StatusBadge, just without a RejectTarget branch
// (there's only ever one destination).
export default function AtkStatusBadge({ status, departemen = null, createdByRole = "ADMIN_DEPARTEMEN" }: Props) {
  const label = getStatusLabel(status, departemen);
  const waitingLabel = getSimpleWaitingLabel(status, { createdByRole, departemen });
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
