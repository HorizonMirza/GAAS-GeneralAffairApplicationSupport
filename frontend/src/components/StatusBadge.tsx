import { getStatusLabel } from "@/lib/constants";
import type { Pengiriman, Status } from "@/lib/types";

interface Props {
  status: Status;
  rejectTarget?: Pengiriman["rejectTarget"];
  departemen?: Pengiriman["departemen"];
  createdByRole?: Pengiriman["createdByRole"];
}

export default function StatusBadge({ status, departemen = null }: Props) {
  const label = getStatusLabel(status, departemen);
  const cls = status.toLowerCase();
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
