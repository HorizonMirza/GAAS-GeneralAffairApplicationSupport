import { trackWord } from "@/lib/constants";
import type { Pengiriman, RejectTarget, Status } from "@/lib/types";

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

// Which step the data actually bounces back to. REJECTED_L1/REJECTED_GA always go back to
// origin (Admin Departemen/Divisi, idx 0). REJECTED_GA_APPROVAL/REJECTED_KPU depend on the
// chosen RejectTarget - GA sends it back only to Admin GA (idx 2), ORIGIN sends it all the way
// back to idx 0. The red connector trail spans this whole range, not just the last hop.
function rejectStartIdx(status: Status, rejectTarget: RejectTarget | null): number {
  if (status === "REJECTED_GA_APPROVAL" || status === "REJECTED_KPU") {
    return rejectTarget === "GA" ? 2 : 0;
  }
  return 0;
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
}: {
  status: Status;
  departemen?: Pengiriman["departemen"];
  rejectTarget?: Pengiriman["rejectTarget"];
}) {
  const currentIdx = PROGRESS[status] ?? 0;
  const rejectAt = REJECTED_IDX[status];
  const rejectFrom = rejectAt != null ? rejectStartIdx(status, rejectTarget) : null;
  const steps = buildSteps(departemen);

  return (
    <div className="stepper">
      {steps.map((step, idx) => {
        const isRejected = rejectAt === idx;
        const done = !isRejected && idx <= currentIdx;
        const dotDelay = idx * FLOW_DURATION;
        const connectorRejected = rejectFrom != null && rejectAt != null && idx >= rejectFrom && idx < rejectAt;
        const connectorDone = idx <= currentIdx && !connectorRejected;
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
