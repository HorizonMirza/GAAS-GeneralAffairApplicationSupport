import { getBookingStatusLabel, getBookingWaitingLabel } from "@/lib/constants";
import type { BookingRuang, BookingStatus } from "@/lib/types";

interface Props {
  status: BookingStatus;
  rejectTarget?: BookingRuang["rejectTarget"];
  departemen?: BookingRuang["departemen"];
  createdByRole?: BookingRuang["createdByRole"];
}

export default function BookingStatusBadge({ status, rejectTarget = null, departemen = null, createdByRole = "ADMIN_DEPARTEMEN" }: Props) {
  const pseudoItem = { status, rejectTarget, departemen, createdByRole } as BookingRuang;
  const waitingLabel = getBookingWaitingLabel(pseudoItem);
  const label = getBookingStatusLabel(status, departemen);
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
