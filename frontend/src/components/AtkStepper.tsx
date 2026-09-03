import { trackWord } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Language } from "@/lib/i18n/language-context";
import type { PermintaanAtk, Role, Status } from "@/lib/types";

const FLOW_DURATION = 1.8;

function buildSteps(departemen: PermintaanAtk["departemen"], lang: Language, t: (key: string) => string) {
  const track = trackWord(departemen, lang);
  return [
    { label: `${t("word.admin")} ${track}` },
    { label: `${t("word.approval")} ${track}` },
    { label: `${t("word.admin")} ${t("word.generalAffair")}` },
    { label: `${t("word.approval")} GA` },
    { label: t("word.partner") },
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

// Same as RoomBookingStepper.originIdxForRole, extended with the KPU step - Admin/Approval GA
// skip straight past every earlier tier when submitting their own request.
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

// Same shape as RoomBookingStepper (5 steps instead of 4, for the KPU tier) - reject is always a
// dead end here too, so there is no rejectTarget-based routing like Pengiriman's own Stepper.
export default function AtkStepper({
  status,
  departemen = null,
  createdByRole = "ADMIN_DEPARTEMEN",
}: {
  status: Status;
  departemen?: PermintaanAtk["departemen"];
  createdByRole?: Role;
}) {
  const { language, t } = useLanguage();
  const currentIdx = PROGRESS[status] ?? 0;
  const rejectAt = REJECTED_IDX[status];
  const originIdx = originIdxForRole(createdByRole);
  const rejectFrom = rejectAt != null ? originIdx : null;
  const steps = buildSteps(departemen, language, t);

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
