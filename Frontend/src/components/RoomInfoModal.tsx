"use client";

import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  nama: string | null;
  kapasitas: number | null;
  facilities?: string[];
  extraDetails?: { label: string; value: string }[];
  photoUrl: string | null;
  // Pre-formatted "HH:mm–HH:mm" ranges still open today, in order - e.g. ["07:00–09:00",
  // "11:00–18:00"]. Empty means nothing is free (fully booked, not "closed" - see closedLabel).
  freeSlotsToday: string[];
  // Shown instead of the free-slots list when the room isn't open at all today (e.g. weekend) -
  // undefined when it is.
  closedLabel?: string;
  // Summary shown instead of individual free time ranges when supplied.
  fullyOpenLabel?: string;
  onClose: () => void;
  // Always routes to Calendar pre-filtered to this room/vehicle, never straight into the booking
  // form - the label still varies by role, since read-only roles get "Lihat Kalender" instead.
  onBook: () => void;
  bookLabel?: string;
}

function RoomPhoto({ url }: { url: string | null }) {
  if (!url) return null;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div
        className="room-info-photo-icon"
        style={{ width: "100%", height: 220, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </div>
  );
}

// Shows room/vehicle details before opening its booking calendar.
export default function RoomInfoModal({
  open,
  nama,
  kapasitas,
  facilities,
  extraDetails,
  photoUrl,
  freeSlotsToday,
  closedLabel,
  fullyOpenLabel,
  onClose,
  onBook,
  bookLabel = "Booking",
}: Props) {
  if (!open || nama == null) return null;
  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal room-info-modal">
        <div className="modal-header">
          <h3>{nama}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <RoomPhoto url={photoUrl} />
        {kapasitas != null && (
          <div className="room-info-row">
            <span className="text-secondary">Kapasitas</span>
            <span>{kapasitas} orang</span>
          </div>
        )}
        {extraDetails && extraDetails.map(({ label, value }) => (
          <div key={label} className="room-info-row">
            <span className="text-secondary">{label}</span>
            <span>{value}</span>
          </div>
        ))}
        {facilities && facilities.length > 0 && (
          <div className="room-info-row">
            <span className="text-secondary">Fasilitas</span>
            <span>{facilities.join(", ")}</span>
          </div>
        )}
        <div className="room-info-row">
          <span className="text-secondary">Jam tersedia hari ini</span>
          {closedLabel ? (
            <span>{closedLabel}</span>
          ) : fullyOpenLabel ? (
            <span>{fullyOpenLabel}</span>
          ) : freeSlotsToday.length > 0 ? (
            <span>{freeSlotsToday.join(", ")}</span>
          ) : (
            <span>Penuh</span>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={onBook}>{bookLabel}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
