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
  // No good single step to blame a cancellation on - it can happen from any on-approval or
  // already-Approved stage (see BookingRuangController.Cancel), and unlike a reject the status
  // name itself doesn't encode which one. Rendered neutral (nothing done, no X) same as DRAFT;
  // BookingStatusBadge is what actually tells the viewer "Cancelled".
  CANCELLED: -1,
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

// How far a booking actually got before an Admin/Approval GA cancel called it off - inferred from
// which approval fields are set (Cancel() never clears them, unlike a real reject), since the
// CANCELLED status name alone doesn't say which stage it was at. Mirrors the PROGRESS index each
// approval field's own tier would land on.
function reachedIdxFromApprovals(approvedByL1: number | null, approvedByGa: number | null, approvedByApprovalGa: number | null): number {
  if (approvedByApprovalGa != null) return 3;
  if (approvedByGa != null) return 2;
  if (approvedByL1 != null) return 1;
  return 0;
}

// rejectTarget is accepted (callers still pass it) but no longer read - it no longer routes a
// reject anywhere different, see BookingRuangController.RejectGaApproval.
export default function RoomBookingStepper({
  status,
  departemen = null,
  createdByRole = "ADMIN_DEPARTEMEN",
  cancelledByRole = null,
  approvedByL1 = null,
  approvedByGa = null,
  approvedByApprovalGa = null,
}: {
  status: BookingStatus;
  departemen?: BookingRuang["departemen"];
  rejectTarget?: BookingRuang["rejectTarget"];
  createdByRole?: Role;
  // Room Booking only - when set to Admin/Approval GA, a CANCELLED booking renders with the same
  // animated red step/connector a real reject gets (see BookingStatusBadge's matching "Rejected:
  // <nama>" badge for the same GA-cancel-reads-as-reject treatment), instead of staying neutral.
  cancelledByRole?: BookingRuang["cancelledByRole"];
  approvedByL1?: BookingRuang["approvedByL1"];
  approvedByGa?: BookingRuang["approvedByGa"];
  approvedByApprovalGa?: BookingRuang["approvedByApprovalGa"];
}) {
  const isGaCancelled = status === "CANCELLED" && (cancelledByRole === "ADMIN_GA" || cancelledByRole === "APPROVAL_GA");
  const originIdx = originIdxForRole(createdByRole);
  let currentIdx = PROGRESS[status] ?? 0;
  let rejectAt: number | undefined = REJECTED_IDX[status];
  if (isGaCancelled) {
    // approvedByL1/Ga/ApprovalGa stay null when the creator's own role IS that tier's approver -
    // Submit()'s self-skip jumps the status straight to APPROVED_L1/GA/GA_APPROVAL without ever
    // recording an explicit approval event (see BookingRuangController.Submit). Without this
    // floor, a booking created by e.g. Approval Departemen (originIdx 1) and cancelled while
    // still waiting on Admin GA would read reached=0 and misplace the X on Approval Departemen
    // itself instead of Admin GA.
    const reached = Math.max(reachedIdxFromApprovals(approvedByL1, approvedByGa, approvedByApprovalGa), originIdx);
    // Capped at 3 (there's no step past Approval GA) - a booking cancelled after already reaching
    // full approval retroactively shows its last step as the X instead of leaving it "done".
    rejectAt = Math.min(reached + 1, 3);
    currentIdx = rejectAt - 1;
  }
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
