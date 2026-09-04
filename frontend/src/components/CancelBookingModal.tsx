"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAutofocusFirstField } from "@/lib/formNav";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

export type CancelBookingType = "room" | "kendaraan";

interface Props {
  open: boolean;
  targetId: number | null;
  targetType: CancelBookingType | null;
  onClose: () => void;
  onDone: () => void;
}

// Shared by Room Booking and Vehicle Booking's row menus - a separate small modal instead of
// reusing RejectModal, since "Reject" is a different action from a different actor (the approval
// chain refusing a request) with its own fixed wording; Cancel is the origin/GA calling off a
// request that was never refused by anyone.
export default function CancelBookingModal({ open, targetId, targetType, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  useAutofocusFirstField(containerRef, `${open}-${targetId}-${targetType}`);

  if (!open) return null;

  function reset() {
    setReason("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (targetId == null || !targetType) return;
    const reasonValue = reason.trim() || null;
    try {
      if (targetType === "room") await api.cancelBooking(targetId, reasonValue);
      else await api.cancelKendaraanBooking(targetId, reasonValue);
      showToast("Booking dibatalkan");
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
          <h3>Cancel Booking</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="field">
          <label htmlFor="cancel-reason-input">Alasan (opsional)</label>
          <textarea
            id="cancel-reason-input"
            placeholder="Contoh: Acara ditunda"
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
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
