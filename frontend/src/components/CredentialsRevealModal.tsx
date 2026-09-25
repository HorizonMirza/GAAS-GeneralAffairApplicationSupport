"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import ModalOverlay from "./ModalOverlay";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";

export interface RevealedCredential {
  username: string;
  nama: string;
  role: string;
  password: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  accounts: RevealedCredential[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ width: "auto", padding: "4px 10px" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable - the value is still visible to copy by hand */
        }
      }}
    >
      {copied ? <Check width={14} height={14} /> : <Copy width={14} height={14} />}
      {copied ? "Disalin" : "Salin"}
    </button>
  );
}

// Shown right after Super Admin creates an account (UsersAdminController.Create, or
// OrgAdminController's auto-provisioning on a new Divisi/Departemen) or resets one's password -
// the ONLY moment this app ever has the plaintext password in hand. Never re-openable: once this
// modal closes, the password is gone from the frontend too, same as the backend never storing or
// logging it anywhere past the response that carried it here.
export default function CredentialsRevealModal({ open, onClose, title, accounts }: Props) {
  return (
    <ModalOverlay open={open} onClose={onClose} className={`modal-overlay modal-overlay-centered ${open ? "" : "hidden"}`}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="bulk-delete-scope bulk-delete-scope-danger" style={{ marginBottom: 12 }}>
          <span className="bulk-delete-scope-title">Password ini hanya ditampilkan sekali</span>
          <p style={{ margin: "4px 0 0" }}>
            Catat atau salin sekarang dan sampaikan ke pemilik akun. Password ini tidak dapat
            ditampilkan lagi setelah jendela ini ditutup - gunakan &quot;Reset Password&quot; untuk
            membuat yang baru bila lupa.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
          {accounts.map((a) => (
            <div key={a.username} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{a.nama}</div>
              <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                {ROLE_LABEL[a.role as Role] || a.role}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.85rem" }}>Username</span>
                <code style={{ fontSize: "0.9rem" }}>{a.username}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "0.85rem" }}>Password</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code style={{ fontSize: "0.9rem" }}>{a.password}</code>
                  <CopyButton text={a.password} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={onClose}>
            Selesai, Sudah Disimpan
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
