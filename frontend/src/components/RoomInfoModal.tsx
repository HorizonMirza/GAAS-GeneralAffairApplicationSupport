"use client";

import { useEffect, useState } from "react";
import ModalOverlay from "./ModalOverlay";

export type RoomInfoAvailability = "available" | "full" | "closed";

interface Props {
  open: boolean;
  nama: string | null;
  kapasitas: number | null;
  // Demo facility chips shown below Kapasitas (e.g. "TV") - no real per-room facility data exists
  // yet, so callers pass a fixed placeholder list until that's tracked for real.
  facilities?: string[];
  // Up to 5 photos, shown as an auto-advancing slideshow (click also advances one slide).
  photoUrls: string[];
  availability: RoomInfoAvailability;
  availLabel: string;
  // Pre-formatted "HH:mm–HH:mm" ranges still open today, in order - e.g. ["07:00–09:00",
  // "11:00–18:00"]. Empty means nothing is free (fully booked, not "closed" - see closedLabel).
  freeSlotsToday: string[];
  // Shown instead of the free-slots list when the room isn't open at all today (e.g. weekend) -
  // undefined when it is.
  closedLabel?: string;
  onClose: () => void;
  // Always routes to Calendar pre-filtered to this room/vehicle, never straight into the booking
  // form - the label still varies by role, since read-only roles get "Lihat Kalender" instead.
  onBook: () => void;
  bookLabel?: string;
}

const SLIDE_INTERVAL_MS = 1600;

function PhotoSlideshow({ photoUrls, availability, availLabel }: { photoUrls: string[]; availability: RoomInfoAvailability; availLabel: string }) {
  const [index, setIndex] = useState(0);
  const count = photoUrls.length;

  // Auto-advance, paused/reset whenever the slide set changes (e.g. switching rooms) so a new
  // room's modal always starts on its first photo instead of wherever the timer left off.
  useEffect(() => {
    setIndex(0);
    if (count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [photoUrls, count]);

  if (count === 0) return null;

  return (
    <div className={`room-card room-card-${availability} room-info-photo`}>
      <span className="room-card-avail-badge">{availLabel}</span>
      <button
        type="button"
        className="room-info-slideshow"
        aria-label="Foto berikutnya"
        onClick={() => setIndex((i) => (i + 1) % count)}
      >
        <div
          className="room-info-slideshow-track"
          style={{ width: `${count * 100}%`, transform: `translateX(-${index * (100 / count)}%)` }}
        >
          {photoUrls.map((url, i) => (
            <div
              key={i}
              className="room-card-icon room-info-photo-icon"
              style={{ width: `${100 / count}%`, backgroundImage: `url(${url})` }}
            />
          ))}
        </div>
      </button>
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
  photoUrls,
  availability,
  availLabel,
  freeSlotsToday,
  closedLabel,
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
        <PhotoSlideshow photoUrls={photoUrls} availability={availability} availLabel={availLabel} />
        {kapasitas != null && (
          <div className="room-info-row">
            <span className="text-secondary">Kapasitas</span>
            <span>{kapasitas} orang</span>
          </div>
        )}
        {facilities && facilities.length > 0 && (
          <div className="room-info-row room-info-row-stack">
            <span className="text-secondary">Fasilitas</span>
            <div className="room-info-slots">
              {facilities.map((f) => (
                <span key={f} className="room-info-slot-chip">{f}</span>
              ))}
            </div>
          </div>
        )}
        <div className="room-info-row room-info-row-stack">
          <span className="text-secondary">Jam tersedia hari ini</span>
          {closedLabel ? (
            <span>{closedLabel}</span>
          ) : freeSlotsToday.length > 0 ? (
            <div className="room-info-slots">
              {freeSlotsToday.map((slot) => (
                <span key={slot} className="room-info-slot-chip">{slot}</span>
              ))}
            </div>
          ) : (
            <span>Penuh sepanjang hari</span>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Tutup</button>
          <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={onBook}>{bookLabel}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
