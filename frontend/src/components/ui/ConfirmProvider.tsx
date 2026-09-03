"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import ModalOverlay from "../ModalOverlay";

interface ConfirmState {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface ConfirmContextValue {
  confirm: (message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: () => {} });

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string, onConfirm: () => void, confirmLabel?: string) => {
    setState({ message, onConfirm, confirmLabel });
  }, []);

  const close = () => setState(null);
  const confirmLabel = state?.confirmLabel ?? t("common.delete");
  const isApprove = confirmLabel.toLowerCase().includes("approve") || confirmLabel.toLowerCase().includes("setujui");

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ModalOverlay open={!!state} onClose={close} className={`modal-overlay modal-overlay-centered ${state ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: state?.message.includes("\n") ? 420 : 380 }}>
          <div className="modal-header">
            <h3>{t("common.confirmation")}</h3>
            <button type="button" className="modal-close" onClick={close}>&times;</button>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", whiteSpace: "pre-line" }}>{state?.message}</p>
          <div className="modal-actions">
            <button
              type="button"
              className={isApprove ? "btn btn-confirm-approve" : "btn btn-confirm-danger"}
              style={{ width: "auto" }}
              onClick={() => {
                const onConfirm = state?.onConfirm;
                close();
                onConfirm?.();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}
