"use client";

interface Props {
  position: { top: number; left: number } | null;
  showUpdates: boolean;
  showDelete: boolean;
  pdfViewUrl: string;
  pdfDownloadUrl: string;
  onDetail: () => void;
  onUpdates: () => void;
  onRiwayat: () => void;
  onDelete: () => void;
  onLinkClick: () => void;
}

export default function InvoiceRowMenuDropdown({
  position,
  showUpdates,
  showDelete,
  pdfViewUrl,
  pdfDownloadUrl,
  onDetail,
  onUpdates,
  onRiwayat,
  onDelete,
  onLinkClick,
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
      {showUpdates && (
        <button type="button" className="row-menu-item" onClick={onUpdates}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"></path></svg>
          Updates
        </button>
      )}
      <a className="row-menu-item" href={pdfViewUrl} target="_blank" rel="noopener noreferrer" onClick={onLinkClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        Lihat PDF
      </a>
      <a className="row-menu-item" href={pdfDownloadUrl} onClick={onLinkClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download PDF
      </a>
      <button type="button" className="row-menu-item" onClick={onRiwayat}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        History
      </button>
      {showDelete && (
        <button type="button" className="row-menu-item row-menu-item-danger" onClick={onDelete}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Delete
        </button>
      )}
    </div>
  );
}
