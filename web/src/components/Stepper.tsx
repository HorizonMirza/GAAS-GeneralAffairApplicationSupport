import { trackWord } from "@/lib/constants";
import type { Pengiriman, RejectTarget, Role, Status } from "@/lib/types";

const FLOW_DURATION = 1.8;

function buildSteps(departemen: Pengiriman["departemen"]) {
  const track = trackWord(departemen);
  return [
    { label: `Admin ${track}` },
    { label: `Approval ${track}` },
    { label: "Admin GA" },
    { label: "Approval GA" },
    { label: "KPU" },
  ];
}

const PROGRESS: Record<Status, number> = {
  DRAFT: -1,
  SUBMITTED: 0,
  REJECTED_L1: 0,
  APPROVED_L1: 1,
  REJECTED_GA: 1,
  APPROVED_GA: 2,
  REJECTED_GA_APPROVAL: 2,
  APPROVED_GA_APPROVAL: 3,
  REJECTED_KPU: 3,
  COMPLETED: 4,
};

const REJECTED_IDX: Partial<Record<Status, number>> = {
  REJECTED_L1: 1,
  REJECTED_GA: 2,
  REJECTED_GA_APPROVAL: 3,
  REJECTED_KPU: 4,
};

function isApprovalRole(role: Role): boolean {
  return role === "APPROVAL_DEPARTEMEN" || role === "APPROVAL_DIVISI";
}

// Which step the data actually bounces back to when rejected. GA target always lands on Admin
// GA (idx 2). Origin always lands on whoever actually created the item - Admin Departemen/Divisi
// (idx 0), or on Approval Departemen/Divisi (idx 1) if they created it directly, since in that
// case Admin was never involved in this item's journey at all.
function rejectStartIdx(status: Status, rejectTarget: RejectTarget | null, originIdx: number): number {
  const isGaTarget = (status === "REJECTED_GA_APPROVAL" || status === "REJECTED_KPU") && rejectTarget === "GA";
  return isGaTarget ? 2 : originIdx;
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18"></line>
      <line x1="18" y1="6" x2="6" y2="18"></line>
    </svg>
  );
}

export default function Stepper({
  status,
  departemen = null,
  rejectTarget = null,
  createdByRole = "ADMIN_DEPARTEMEN",
}: {
  status: Status;
  departemen?: Pengiriman["departemen"];
  rejectTarget?: Pengiriman["rejectTarget"];
  createdByRole?: Role;
}) {
  const currentIdx = PROGRESS[status] ?? 0;
  const rejectAt = REJECTED_IDX[status];
  // Approval Departemen/Divisi creating data directly skips the Admin stage entirely (see
  // Submit()), so their journey visually starts at idx 1 - the Admin dot/connector never lights
  // up for them since that step never really happened.
  const originIdx = isApprovalRole(createdByRole) ? 1 : 0;
  const rejectFrom = rejectAt != null ? rejectStartIdx(status, rejectTarget, originIdx) : null;
  const steps = buildSteps(departemen);

  return (
    <div className="stepper">
      {steps.map((step, idx) => {
        const isRejected = rejectAt === idx;
        const isMootAfterReject = rejectFrom != null && rejectAt != null && idx > rejectFrom && idx < rejectAt;
        const done = !isRejected && !isMootAfterReject && idx >= originIdx && idx <= currentIdx;
        const dotDelay = idx * FLOW_DURATION;
        const connectorRejected = rejectFrom != null && rejectAt != null && idx >= rejectFrom && idx < rejectAt;
        const connectorDone = idx >= originIdx && idx <= currentIdx && !connectorRejected;
        const connectorDelay = idx * FLOW_DURATION;
        return (
          <div key={step.label} style={{ display: "contents" }}>
            <div className={`step ${done ? "done" : ""} ${isRejected ? "rejected" : ""}`}>
              <div className="dot" style={{ animationDelay: `${dotDelay}s` }}>
                {isRejected ? <XIcon /> : idx + 1}
              </div>
              <div className="step-label">{step.label}</div>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`connector ${connectorDone ? "done" : ""} ${connectorRejected ? "rejected" : ""}`}
                style={{ animationDelay: `${connectorDelay}s` }}
              ></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
