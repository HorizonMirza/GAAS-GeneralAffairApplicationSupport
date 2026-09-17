import { getStatusLabel } from "@/lib/constants";
import type { PermintaanAtk, Status } from "@/lib/types";

interface Props {
  status: Status;
  departemen?: PermintaanAtk["departemen"];
  createdByRole?: PermintaanAtk["createdByRole"];
}

export default function AtkStatusBadge({ status, departemen = null }: Props) {
  const label = getStatusLabel(status, departemen);
  const cls = status.toLowerCase();
  return <span className={`badge badge-${cls}`}>{label}</span>;
}
