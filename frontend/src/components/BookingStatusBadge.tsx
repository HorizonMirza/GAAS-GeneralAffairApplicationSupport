import { getBookingStatusLabel, getSimpleWaitingLabel } from "@/lib/constants";
import type { BookingRuang, BookingStatus } from "@/lib/types";

interface Props {
  status: BookingStatus;
  rejectTarget?: BookingRuang["rejectTarget"];
  departemen?: BookingRuang["departemen"];
  createdByRole?: BookingRuang["createdByRole"];
  cancelledByName?: BookingRuang["cancelledByName"];
  // Room/Vehicle Booking's reject is a genuine dead end (nothing is "waiting" on anyone once
  // rejected - see their IsEditableByOrigin), so this defaults to false and they never pass it.
  // Maintenance/Archive pass true - their reject always routes back to the same origin creator to
  // revise and resubmit, so it gets the same "Waiting: X" second badge as Pengiriman's own
  // StatusBadge, just without a RejectTarget branch (there's only ever one destination).
  revisable?: boolean;
  isRoom?: boolean;
  isKendaraan?: boolean;
}

export default function BookingStatusBadge({ status, departemen = null, createdByRole = "ADMIN_DEPARTEMEN", cancelledByName = null, revisable = false, isRoom = false, isKendaraan = false }: Props) {
  const label =
    status === "CANCELLED" && cancelledByName
      ? `Cancel: ${cancelledByName}`
      : status === "CANCELLED"
      ? "Cancelled"
      : getBookingStatusLabel(status, departemen);
  const waitingLabel = revisable ? getSimpleWaitingLabel(status, { createdByRole, departemen }) : undefined;
  // Pengiriman's StatusBadge also renders an "approved_ga_approval" status, but that one isn't
  // final there (a KPU stage still follows) - it needs to stay orange, while Room Booking's own
  // APPROVED_GA_APPROVAL is the true final/green status. Same enum name, different meaning, so
  // this one status gets its own class instead of colliding with Pengiriman's.
  const cls =
    status === "CANCELLED"
      ? "cancelled"
      : status === "APPROVED_GA_APPROVAL"
      ? "booking-approved_ga_approval"
      : status.toLowerCase();
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
