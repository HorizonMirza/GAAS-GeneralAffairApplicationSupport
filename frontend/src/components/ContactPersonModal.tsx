"use client";

import { CONTACT_PERSONS } from "@/lib/constants";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
}

// wa.me needs digits only, already carrying the country code (62...) - the phone numbers in
// CONTACT_PERSONS are entered as "+62 812-1555-6739" for readability, so + / spaces / dashes are
// stripped rather than re-typing every number in wa.me's format.
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function ContactPersonModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>Contact Person</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="contact-list">
          {CONTACT_PERSONS.map((c) => (
            <a
              key={c.module}
              className="contact-item"
              href={waLink(c.phone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contact-avatar">{initials(c.name)}</span>
              <span className="contact-info">
                <span className="contact-module">{c.module}</span>
                <span className="contact-name">{c.name} &middot; {c.phone}</span>
              </span>
              <span className="contact-wa-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9C21.96 6.45 17.5 2 12.04 2Zm0 18.11h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.81c0 4.53-3.7 8.22-8.23 8.22Zm4.5-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01s-.43.06-.66.31c-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
                </svg>
              </span>
            </a>
          ))}
        </div>
        <p className="contact-hint">Klik salah satu untuk langsung chat WhatsApp.</p>
      </div>
    </ModalOverlay>
  );
}
