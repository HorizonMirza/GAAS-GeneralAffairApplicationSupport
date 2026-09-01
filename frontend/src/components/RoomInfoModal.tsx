"use client";

import ModalOverlay from "./ModalOverlay";

export type RoomInfoAvailability = "available" | "full" | "closed";

interface Props {
  open: boolean;
  nama: string | null;
  kapasitas: number | null;
  photoUrl: string;
  availability: RoomInfoAvailability;
  availLabel: string;
  onClose: () => void;
  onBook: () => void;
  // Only the origin roles that can actually submit a booking get routed to the form on click -
  // everyone else lands on Calendar instead (read-only, same as before this modal existed), so
  // the button's own label says which one is about to happen.
  bookLabel?: string;
}

// A lightweight stop between the Overview grid and the booking form - shows what the room/
// vehicle actually is (photo, capacity, today's availability) before committing to "Booking",
// instead of the card linking straight into Calendar with no preview.
export default function RoomInfoModal({ open, nama, kapasitas, photoUrl, availability, availLabel, onClose, onBook, bookLabel = "Booking" }: Props) {
  if (!open || nama == null) return null;
  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal room-info-modal">
        <div className="modal-header">
          <h3>{nama}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className={`room-card room-card-${availability} room-info-photo`}>
          <span className="room-card-avail-badge">{availLabel}</span>
          <div className="room-card-icon room-info-photo-icon" style={{ backgroundImage: `url(${photoUrl})` }} />
        </div>
        {kapasitas != null && (
          <div className="room-info-row">
            <span className="text-secondary">Kapasitas</span>
            <span>{kapasitas} orang</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Tutup</button>
          <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={onBook}>{bookLabel}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
