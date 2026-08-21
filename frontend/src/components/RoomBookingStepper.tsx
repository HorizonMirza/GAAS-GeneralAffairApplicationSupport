import { trackWord } from "@/lib/constants";
import type { BookingRuang, BookingStatus, Role } from "@/lib/types";

const FLOW_DURATION = 1.8;

function buildSteps(departemen: BookingRuang["departemen"]) {
  const track = trackWord(departemen);
  return [
    { label: `Admin ${track}` },
    { label: `Approval ${track}` },
    { label: "Admin GA" },
    { label: "Approval GA" },
  ];
}

const PROGRESS: Record<BookingStatus, number> = {
  DRAFT: -1,
  SUBMITTED: 0,
  REJECTED_L1: 0,
  APPROVED_L1: 1,
  REJECTED_GA: 1,
  APPROVED_GA: 2,
  REJECTED_GA_APPROVAL: 2,
  APPROVED_GA_APPROVAL: 3,
};

const REJECTED_IDX: Partial<Record<BookingStatus, number>> = {
  REJECTED_L1: 1,
  REJECTED_GA: 2,
  REJECTED_GA_APPROVAL: 3,
};

// Maps the creator's role to the step index their journey actually starts at, so an
// Admin/Approval GA-input booking (which skips straight past the Departemen/Divisi tiers on
// submit) doesn't falsely render those earlier steps as "done".
function originIdxForRole(role: Role): number {
  if (role === "APPROVAL_GA") return 3;
  if (role === "ADMIN_GA") return 2;
  if (role === "APPROVAL_DEPARTEMEN" || role === "APPROVAL_DIVISI") return 1;
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

// rejectTarget is accepted (callers still pass it) but no longer read - it no longer routes a
// reject anywhere different, see BookingRuangController.RejectGaApproval.
export default function RoomBookingStepper({
  status,
  departemen = null,
  createdByRole = "ADMIN_DEPARTEMEN",
}: {
  status: BookingStatus;
  departemen?: BookingRuang["departemen"];
  rejectTarget?: BookingRuang["rejectTarget"];
  createdByRole?: Role;
}) {
  const currentIdx = PROGRESS[status] ?? 0;
  const rejectAt = REJECTED_IDX[status];
  const originIdx = originIdxForRole(createdByRole);
  const rejectFrom = rejectAt != null ? originIdx : null;
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
