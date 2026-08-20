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
  // Pengiriman's StatusBadge also renders an "approved_ga_approval" status, but that one isn't
  // final there (a KPU stage still follows) - it needs to stay orange, while Room Booking's own
  // APPROVED_GA_APPROVAL is the true final/green status. Same enum name, different meaning, so
  // this one status gets its own class instead of colliding with Pengiriman's.
  const cls = status === "APPROVED_GA_APPROVAL" ? "booking-approved_ga_approval" : status.toLowerCase();
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
