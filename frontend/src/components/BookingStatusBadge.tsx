import { getBookingStatusLabel } from "@/lib/constants";
import type { BookingRuang, BookingStatus } from "@/lib/types";

interface Props {
  status: BookingStatus;
  rejectTarget?: BookingRuang["rejectTarget"];
  departemen?: BookingRuang["departemen"];
  createdByRole?: BookingRuang["createdByRole"];
}

// rejectTarget/createdByRole are accepted (callers still pass them) but no longer read - a
// rejected booking has nothing left "waiting" on anyone since it can't be revised by anyone,
// so there is no second "Waiting: X" badge to compute anymore.
export default function BookingStatusBadge({ status, departemen = null }: Props) {
  const label = getBookingStatusLabel(status, departemen);
  // Pengiriman's StatusBadge also renders an "approved_ga_approval" status, but that one isn't
  // final there (a KPU stage still follows) - it needs to stay orange, while Room Booking's own
  // APPROVED_GA_APPROVAL is the true final/green status. Same enum name, different meaning, so
  // this one status gets its own class instead of colliding with Pengiriman's.
  const cls = status === "APPROVED_GA_APPROVAL" ? "booking-approved_ga_approval" : status.toLowerCase();
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
