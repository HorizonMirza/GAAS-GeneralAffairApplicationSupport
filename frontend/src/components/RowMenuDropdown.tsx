"use client";

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
  onUpdates: () => void;
  onStatus: () => void;
  onDelete: () => void;
  pdfUrl?: string;
  onPdfClick?: () => void;
  icsUrl?: string;
  onIcsClick?: () => void;
}

export default function RowMenuDropdown({
  position,
  canEditDelete,
  canDelete,
  onDetail,
  onChat,
  onUpdates,
  onStatus,
  onDelete,
  pdfUrl,
  onPdfClick,
  icsUrl,
  onIcsClick,
}: Props) {
  if (!position) return null;
  return (
    <div
      className="row-menu-dropdown"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="row-menu-item" onClick={onDetail}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>
        Detail
      </button>
      {canEditDelete && (
        <button type="button" className="row-menu-item" onClick={onUpdates}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"></path></svg>
          Updates
        </button>
      )}
      <button type="button" className="row-menu-item" onClick={onStatus}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        History
      </button>
      {pdfUrl && (
        <a className="row-menu-item" href={pdfUrl} target="_blank" rel="noopener noreferrer" onClick={onPdfClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download PDF
        </a>
      )}
      {icsUrl && (
        <a className="row-menu-item" href={icsUrl} onClick={onIcsClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="16" y1="2" x2="16" y2="6"></line></svg>
          Export Calendar
        </a>
      )}
      {onChat && (
        <button type="button" className="row-menu-item" onClick={onChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Chat
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
