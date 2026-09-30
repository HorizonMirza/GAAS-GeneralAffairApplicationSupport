"use client";

import ModalOverlay from "./ModalOverlay";

export type RoomInfoAvailability = "available" | "full" | "closed";

interface Props {
  open: boolean;
  nama: string | null;
  kapasitas: number | null;
  // Demo facility chips shown below Kapasitas (e.g. "TV") - no real per-room facility data exists
  // yet, so callers pass a fixed placeholder list until that's tracked for real.
  facilities?: string[];
  // Real label/value rows shown below Kapasitas (e.g. Plat Nomor, Nama Supir for a vehicle) -
  // unlike facilities, this is actual data, not a placeholder.
  extraDetails?: { label: string; value: string }[];
  // Only the first URL is actually displayed (a single static photo, no slideshow) - callers may
  // still pass extra padding URLs, they're just ignored.
  photoUrls: string[];
  availability: RoomInfoAvailability;
  availLabel: string;
  // Pre-formatted "HH:mm–HH:mm" ranges still open today, in order - e.g. ["07:00–09:00",
  // "11:00–18:00"]. Empty means nothing is free (fully booked, not "closed" - see closedLabel).
  freeSlotsToday: string[];
  // Shown instead of the free-slots list when the room isn't open at all today (e.g. weekend) -
  // undefined when it is.
  closedLabel?: string;
  // Shown instead of the per-hour chip list when every operating hour today is still free -
  // undefined otherwise. A wall of 11 identical-looking chips says nothing a one-line summary
  // doesn't; the chips only earn their place once some hours are actually taken.
  fullyOpenLabel?: string;
  onClose: () => void;
  // Always routes to Calendar pre-filtered to this room/vehicle, never straight into the booking
  // form - the label still varies by role, since read-only roles get "Lihat Kalender" instead.
  onBook: () => void;
  bookLabel?: string;
}

function RoomPhoto({ photoUrls }: { photoUrls: string[] }) {
  const url = photoUrls[0];
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

// A lightweight stop between the Overview grid and the booking form - shows what the room/
// vehicle actually is (photo slideshow, capacity, today's open hours) before committing to
// "Booking", instead of the card linking straight into Calendar with no preview.
export default function RoomInfoModal({
  open,
  nama,
  kapasitas,
  facilities,
  extraDetails,
  photoUrls,
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
        <RoomPhoto photoUrls={photoUrls} />
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
