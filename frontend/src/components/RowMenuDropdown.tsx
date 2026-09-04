"use client";

import { Download, FileText, ListChecks, MessageSquare } from "lucide-react";

interface Props {
  position: { top: number; left: number } | null;
  // Gates the Updates item. The name is a holdover from when one flag covered both Updates and
  // Delete - Room Booking now computes it more broadly (origin's own DRAFT, OR Admin/Approval GA's
  // separate reschedule right) and points onUpdates at whichever flow actually applies.
  canEditDelete: boolean;
  // Delete can have a wider allowance than Updates (e.g. Room Booking also lets Admin/Approval GA
  // delete a rejected item they didn't create, which they still can't edit/reschedule) - defaults
  // to canEditDelete when omitted, so every other caller keeps its previous single-flag behavior.
  canDelete?: boolean;
  onDetail: () => void;
  onChat?: () => void;
  // Room/Vehicle Booking Calendar is the one place Chat lives inside this dropdown instead of its
  // own card icon button (see Overview/Transaksi's separate chat button + .chat-count-badge) - so
  // the same unread signal needs its own rendering here instead.
  unreadChatCount?: number;
  // A red-surrounded state stronger than Delete/Cancel's (see .row-menu-item-mentioned) - shown
  // at rest, not just on hover, so it reads the same whether or not the mouse is over it.
  hasUnreadMention?: boolean;
  onUpdates: () => void;
  onStatus: () => void;
  onDelete: () => void;
  // Presence alone gates whether the item renders; the actual download (and any access-denied
  // toast) is driven entirely by onPdfClick/onIcsClick - see downloadFile in lib/api.ts.
  pdfUrl?: string;
  onPdfClick?: () => void;
  icsUrl?: string;
  onIcsClick?: () => void;
  // Room/Vehicle Booking only - renders only when both are present, since every other caller of
  // this shared dropdown has no Cancel concept at all (see isBookingCancellableByOrigin/
  // isKendaraanCancellableByOrigin for what canCancel is actually computed from).
  onCancel?: () => void;
  canCancel?: boolean;
}

export default function RowMenuDropdown({
  position,
  canEditDelete,
  canDelete,
  onDetail,
  onChat,
  unreadChatCount,
  hasUnreadMention,
  onUpdates,
  onStatus,
  onDelete,
  pdfUrl,
  onPdfClick,
  icsUrl,
  onIcsClick,
  onCancel,
  canCancel,
}: Props) {
  if (!position) return null;
  return (
    <div
      className="row-menu-dropdown"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {onChat && (
        <button type="button" className={`row-menu-item${hasUnreadMention ? " row-menu-item-mentioned" : ""}`} onClick={onChat}>
          <MessageSquare width="16" height="16" />
          Chat
          {!!unreadChatCount && (
            <span className="row-menu-item-badge">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>
          )}
        </button>
      )}
      <button type="button" className="row-menu-item" onClick={onDetail}>
        <ListChecks width={16} height={16} />
        Detail
      </button>
      {canEditDelete && (
        <button type="button" className="row-menu-item" onClick={onUpdates}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"></path></svg>
          Updates
        </button>
      )}
      <button type="button" className="row-menu-item" onClick={onStatus}>
        <FileText width={16} height={16} />
        History
      </button>
      {pdfUrl && (
        <button type="button" className="row-menu-item" onClick={onPdfClick}>
          <Download width={16} height={16} />
          Download PDF
        </button>
      )}
      {icsUrl && (
        <button type="button" className="row-menu-item" onClick={onIcsClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="16" y1="2" x2="16" y2="6"></line></svg>
          Export Calendar
        </button>
      )}
      {onCancel && canCancel && (
        <button type="button" className="row-menu-item row-menu-item-danger" onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          Cancel
        </button>
      )}
      {(canDelete ?? canEditDelete) && (
        <button type="button" className="row-menu-item row-menu-item-danger" onClick={onDelete}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Delete
        </button>
      )}
    </div>
  );
}
