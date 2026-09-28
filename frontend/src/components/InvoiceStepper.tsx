import type { InvoiceStatus } from "@/lib/types";

const FLOW_DURATION = 1.8;

const STEPS = [{ label: "Mitra" }, { label: "Admin GA" }, { label: "Approved" }];

// Same idea as Stepper.tsx's PROGRESS map, collapsed to Invoice's own 3-tier chain (no L1/GA-
// Approval/Mitra-receipt tiers here - Admin GA is Invoice's only approver, and "Approved" is the
// terminal state itself rather than a separate participant).
const PROGRESS: Record<InvoiceStatus, number> = {
  DRAFT: -1,
  PENDING: 0,
  APPROVED: 2,
  REJECTED: 1,
};

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18"></line>
      <line x1="18" y1="6" x2="6" y2="18"></line>
    </svg>
  );
}

// Mirrors Stepper.tsx's visual treatment exactly (same .stepper/.step/.dot/.connector CSS) so
// Invoice's own 3-tier chain reads the same way as every other module's approval stepper -
// only the step count and status mapping differ, since Invoice has no L1/GA-Approval/Mitra-
// receipt tiers of its own (Admin GA is its only approver).
export default function InvoiceStepper({ status }: { status: InvoiceStatus }) {
  const currentIdx = PROGRESS[status] ?? -1;
  const rejectAt = status === "REJECTED" ? 1 : null;
  const rejectFrom = rejectAt != null ? 0 : null;

  return (
    <div className="stepper">
      {STEPS.map((step, idx) => {
        const isRejected = rejectAt === idx;
        const isMootAfterReject = rejectFrom != null && rejectAt != null && idx > rejectFrom && idx < rejectAt;
        const done = !isRejected && !isMootAfterReject && idx <= currentIdx;
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
            {idx < STEPS.length - 1 && (
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
