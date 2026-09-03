"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { RejectTarget } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

export type RejectType =
  | "l1"
  | "ga"
  | "ga-approval"
  | "kpu"
  | "booking-l1"
  | "booking-ga"
  | "booking-ga-approval"
  | "kendaraan-l1"
  | "kendaraan-ga"
  | "kendaraan-ga-approval"
  | "atk-l1"
  | "atk-ga"
  | "atk-ga-approval"
  | "atk-kpu"
  | "sarana-l1"
  | "sarana-ga"
  | "sarana-ga-approval"
  | "arsip-l1"
  | "arsip-ga"
  | "arsip-ga-approval";

interface Props {
  open: boolean;
  targetId: number | null;
  targetType: RejectType | null;
  originLabel: string;
  createdByRole?: string | null;
  onClose: () => void;
  onDone: () => void;
}

const NEEDS_TARGET_CHOICE: RejectType[] = ["ga-approval", "kpu"];

// For these two reject types, "send to GA" and "send to origin" collapse into the same person
// whenever the item was input by Admin/Approval GA themselves (they are the origin) - showing
// a choice between two identically-worded options for the same destination is just confusing,
// so skip it and always resolve straight to ORIGIN.
const GA_ORIGIN_COLLAPSIBLE: RejectType[] = ["ga-approval", "kpu"];

export default function RejectModal({ open, targetId, targetType, originLabel, createdByRole, onClose, onDone }: Props) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<RejectTarget | "">("");
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  useAutofocusFirstField(containerRef, `${open}-${targetId}-${targetType}`);

  if (!open) return null;

  const isGaOriginCreator = createdByRole === "ADMIN_GA" || createdByRole === "APPROVAL_GA";
  const skipChoice = !!targetType && GA_ORIGIN_COLLAPSIBLE.includes(targetType) && isGaOriginCreator;
  const needsTarget = targetType ? NEEDS_TARGET_CHOICE.includes(targetType) && !skipChoice : false;

  function reset() {
    setReason("");
    setTarget("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (targetId == null || !targetType) return;
    const reasonValue = reason.trim() || null;
    if (needsTarget && !target) {
      setError(t("reject.errChooseTarget"));
      return;
    }
    const effectiveTarget: RejectTarget | "" = skipChoice ? "ORIGIN" : target;
    const adminGaLabel = `${t("word.admin")} ${t("word.generalAffair")}`;
    try {
      let message = `${t("reject.dataReturnedTo")} ${originLabel}`;
      if (targetType === "l1") {
        await api.rejectL1(targetId, reasonValue);
      } else if (targetType === "ga") {
        await api.rejectGa(targetId, reasonValue);
      } else if (targetType === "ga-approval") {
        await api.rejectGaApproval(targetId, reasonValue, effectiveTarget as RejectTarget);
        message = effectiveTarget === "GA" ? `${t("reject.dataReturnedTo")} ${adminGaLabel}` : `${t("reject.dataReturnedTo")} ${originLabel}`;
      } else if (targetType === "kpu") {
        await api.rejectKpu(targetId, reasonValue, effectiveTarget as RejectTarget);
        message = effectiveTarget === "GA" ? `${t("reject.dataReturnedTo")} ${adminGaLabel}` : `${t("reject.dataReturnedTo")} ${originLabel}`;
      } else if (targetType === "booking-l1") {
        await api.rejectBookingL1(targetId, reasonValue);
      } else if (targetType === "booking-ga") {
        await api.rejectBookingGa(targetId, reasonValue);
      } else if (targetType === "booking-ga-approval") {
        await api.rejectBookingGaApproval(targetId, reasonValue);
        message = t("reject.bookingRejected");
      } else if (targetType === "kendaraan-l1") {
        await api.rejectKendaraanL1(targetId, reasonValue);
      } else if (targetType === "kendaraan-ga") {
        await api.rejectKendaraanGa(targetId, reasonValue);
      } else if (targetType === "kendaraan-ga-approval") {
        await api.rejectKendaraanGaApproval(targetId, reasonValue);
        message = t("reject.bookingRejected");
      } else if (targetType === "atk-l1") {
        await api.rejectAtkL1(targetId, reasonValue);
      } else if (targetType === "atk-ga") {
        await api.rejectAtkGa(targetId, reasonValue);
      } else if (targetType === "atk-ga-approval") {
        await api.rejectAtkGaApproval(targetId, reasonValue);
        message = t("reject.requestRejected");
      } else if (targetType === "atk-kpu") {
        await api.rejectAtkKpu(targetId, reasonValue);
        message = t("reject.requestRejected");
      } else if (targetType === "sarana-l1") {
        await api.rejectSaranaL1(targetId, reasonValue);
      } else if (targetType === "sarana-ga") {
        await api.rejectSaranaGa(targetId, reasonValue);
      } else if (targetType === "sarana-ga-approval") {
        await api.rejectSaranaGaApproval(targetId, reasonValue);
        message = t("reject.reportRejected");
      } else if (targetType === "arsip-l1") {
        await api.rejectArsipL1(targetId, reasonValue);
      } else if (targetType === "arsip-ga") {
        await api.rejectArsipGa(targetId, reasonValue);
      } else {
        await api.rejectArsipGaApproval(targetId, reasonValue);
        message = t("reject.archiveRequestRejected");
      }
      showToast(message);
      reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }} ref={containerRef}>
        <div className="modal-header">
          <h3>{t("reject.title")}</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        {needsTarget && (
          <div className="field">
            <label>{t("reject.returnTo")}</label>
            <div className="reject-target-options">
              <label className={`reject-target-option ${target === "GA" ? "selected" : ""}`}>
                <input type="radio" name="reject-target" value="GA" checked={target === "GA"} onChange={() => setTarget("GA")} />
                <span>{t("word.admin")} {t("word.generalAffair")}</span>
              </label>
              <label className={`reject-target-option ${target === "ORIGIN" ? "selected" : ""}`}>
                <input type="radio" name="reject-target" value="ORIGIN" checked={target === "ORIGIN"} onChange={() => setTarget("ORIGIN")} />
                <span>{originLabel} {t("reject.creatorSuffix")}</span>
              </label>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="reject-reason-input">{t("reject.reasonLabel")}</label>
          <textarea
            id="reject-reason-input"
            placeholder={t("reject.reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.stopPropagation();
            }}
          />
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: "auto", background: "#d64545", color: "#fff", border: "none" }}
            onClick={handleConfirm}
          >
            {t("common.reject")}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
