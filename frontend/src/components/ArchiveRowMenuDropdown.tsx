"use client";

interface Props {
  position: { top: number; left: number } | null;
  showEdit: boolean;
  showDelete: boolean;
  fileViewUrl: string;
  fileDownloadUrl: string;
  onEdit: () => void;
  onDelete: () => void;
  onLinkClick: () => void;
}

export default function ArchiveRowMenuDropdown({
  position,
  showEdit,
  showDelete,
  fileViewUrl,
  fileDownloadUrl,
  onEdit,
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
      <a className="row-menu-item" href={fileViewUrl} target="_blank" rel="noopener noreferrer" onClick={onLinkClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        Lihat File
      </a>
      <a className="row-menu-item" href={fileDownloadUrl} onClick={onLinkClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download File
      </a>
      {showEdit && (
        <button type="button" className="row-menu-item" onClick={onEdit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"></path></svg>
          Edit
        </button>
      )}
      {showDelete && (
        <button type="button" className="row-menu-item row-menu-item-danger" onClick={onDelete}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Delete
        </button>
      )}
    </div>
  );
}
