import { getStatusLabel } from "@/lib/constants";
import type { PermintaanAtk, Status } from "@/lib/types";

interface Props {
  status: Status;
  departemen?: PermintaanAtk["departemen"];
}

// Same shape as BookingStatusBadge - reject is a dead end at every tier here too, so there is no
// "Waiting: X" second badge like Pengiriman's own StatusBadge (nothing is actually waiting on
// anyone once a request is rejected). getStatusLabel/its underlying STATUS_LABEL already handle
// the KPU tier (APPROVED_GA_APPROVAL = "On-Approval: KPU", COMPLETED = "Approved") correctly.
export default function AtkStatusBadge({ status, departemen = null }: Props) {
  const label = getStatusLabel(status, departemen);
  const cls = status.toLowerCase();
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
