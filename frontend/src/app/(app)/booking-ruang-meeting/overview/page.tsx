"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  bookingRoomsLabel,
  bookingStatusBorderClass,
  canGaRescheduleBooking,
  isBookingCancellableByOrigin,
  isBookingDeletableByOrigin,
  isBookingEditableByOrigin,
  isBookingOriginRole,
  isBookingPdfAvailable,
} from "@/lib/constants";
import { currentYearMonth, formatDate, todayLocalDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import { isWeekend } from "@/components/RoomCalendarView";

// Ruang Meeting buka 07:00-18:00 (lihat ClosedNotice di RoomCalendarView). "Penuh" hanya berarti
// benar-benar penuh sepanjang hari - dihitung dari booking yang statusnya sudah APPROVED_GA_APPROVAL
// (final, bukan draft/masih-di-approval milik siapa pun) memakai menit asli (bukan dibulatkan ke
// blok jam), supaya dua meeting pendek yang menyisakan celah kosong di antaranya tidak salah
// dianggap menutup seluruh jam itu.
const OPEN_MIN = 7 * 60;
const CLOSE_MIN = 18 * 60;
const TOTAL_HOUR_SLOTS = (CLOSE_MIN - OPEN_MIN) / 60;

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Placeholder room photos - filenames are the room name slugified, so replacing the look of a
// room later is just overwriting /public/assets/rooms/<slug>.png with a real photo (same name,
// no code change needed).
function roomPhotoUrl(roomName: string): string {
  const slug = roomName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/assets/rooms/${slug}.png`;
}

// Every room only has the one placeholder photo above so far - pads the info modal's slideshow
// out to a handful of slides by borrowing a few other rooms' placeholders, until real per-room
// photos exist (see roomPhotoUrl's comment on how those get swapped in later).
const DEMO_ROOM_PHOTOS = [
  "/assets/rooms/ruang-eksternal-receptionist.png",
  "/assets/rooms/ruang-eksternal-besar.png",
  "/assets/rooms/ruang-eksternal-kecil.png",
  "/assets/rooms/ruang-golf.png",
  "/assets/rooms/ruang-open-space.png",
];
function roomPhotoUrls(roomName: string): string[] {
  const own = roomPhotoUrl(roomName);
  return [own, ...DEMO_ROOM_PHOTOS.filter((u) => u !== own)].slice(0, 5);
}

// Demo facility list, shown in the info modal until real per-room facility data exists.
const ROOM_DEMO_FACILITIES = ["TV", "AC", "Proyektor", "WiFi", "Whiteboard"];

// Free (bookable) hours left today, one entry per whole hour within operating hours (e.g.
// 07:00-08:00, 08:00-09:00, ...) - bookings are only ever made on the hour, so there's no reason
// to offer a half-hour slot, and listing every open hour individually (instead of collapsing
// contiguous ones into one big range) is what actually lets someone see "which hours" at a glance.
function roomFreeSlotsToday(roomName: string, todayEntries: BookingRuang[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status !== "APPROVED_GA_APPROVAL") continue;
    if (entry.namaRuang !== roomName && !entry.additionalRooms.includes(roomName)) continue;
    if (entry.isWholeDay) {
      booked.push([OPEN_MIN, CLOSE_MIN]);
      continue;
    }
    if (!entry.jamMulai || !entry.jamSelesai) continue;
    const start = Math.max(OPEN_MIN, toMinutes(entry.jamMulai));
    const end = Math.min(CLOSE_MIN, toMinutes(entry.jamSelesai));
    if (end > start) booked.push([start, end]);
  }
  const free: [number, number][] = [];
  for (let h = OPEN_MIN; h < CLOSE_MIN; h += 60) {
    const slotEnd = h + 60;
    const isBooked = booked.some(([bs, be]) => bs < slotEnd && be > h);
    if (!isBooked) free.push([h, slotEnd]);
  }
  return free;
}

function isRoomFullyBookedToday(roomName: string, todayEntries: BookingRuang[]): boolean {
  return roomFreeSlotsToday(roomName, todayEntries).length === 0;
}

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomInfoModal from "@/components/RoomInfoModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RoomBookingRescheduleModal from "@/components/RoomBookingRescheduleModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import CancelBookingModal from "@/components/CancelBookingModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import RoomBookingChatModal from "@/components/RoomBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

export default function BookingOverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<BookingRuang[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [todayEntries, setTodayEntries] = useState<BookingRuang[]>([]);
  const [busy, setBusy] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [infoRoom, setInfoRoom] = useState<RoomOption | null>(null);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRuang | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingRuang | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    // KPU only deals with Expedition (see AppShell's KPU_HIDDEN_CATEGORIES) - Room Booking isn't
    // part of their workflow, so a direct link/URL shouldn't land them here either.
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  // `silent` skips the busy-flag toggle - used by the chat modal's onRead, which fires on every
  // incoming message while the modal is open and would otherwise unmount the card grid to
  // "Memuat data..." and back on every message, flickering the page visible behind the modal's
  // blurred backdrop for no visible benefit.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!me) return;
    if (!opts?.silent) setBusy(true);
    try {
      // sejakBulan (not bulan) so this list covers the current month AND every future month -
      // an upcoming booking shouldn't vanish the moment the calendar rolls past it. Still drops
      // off past months on its own once they're behind "today". Not capped to a small page size
      // otherwise - shows every booking from this point on.
      const queue = await api.listBooking({ limit: 1000, page: 1, sejakBulan: currentYearMonth() }).then((r) => r.items);
      setItems(queue);
    } finally {
      setBusy(false);
    }
  }, [me]);

  useEffect(() => {
    // Fetches from the API on mount/whenever `me` changes - genuinely synchronizing with an
    // external system, not state derived from a prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    // Drives the available/penuh strip on each room card below - fetched once on mount, same as
    // rooms above, since "today" doesn't change without a page reload.
    api.getBookingSchedule(todayLocalDate()).then(setTodayEntries).catch(() => setTodayEntries([]));
  }, []);

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "DRAFT") return items.filter((i) => i.status === "DRAFT");
    if (statusFilter === "APPROVED") return items.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (statusFilter === "ON_APPROVAL") return items.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    if (statusFilter === "CANCELLED") return items.filter((i) => i.status === "CANCELLED");
    return items.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  const closedToday = isWeekend(todayLocalDate());

  function handleDelete(item: BookingRuang) {
    const message = item.seriesId
      ? "Booking ini bagian dari jadwal berulang\nmenghapusnya akan menghapus seluruh jadwal"
      : "Hapus booking ruangan ini secara permanen?";
    confirm(message, async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
        load();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <WelcomeGreeting me={me} />
        {isOrigin && (
          <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
            + Booking Ruang Meeting
          </button>
        )}
      </div>

      {rooms.length > 0 && (
        <div className="room-grid">
          {rooms.map((r) => {
            const availability: "available" | "full" | "closed" = closedToday
              ? "closed"
              : isRoomFullyBookedToday(r.nama, todayEntries)
              ? "full"
              : "available";
            const availLabel = availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available";
            const availTitle =
              availability === "closed" ? "Close (akhir pekan)" : availability === "full" ? "Full hari ini" : "Available hari ini";
            return (
              <button
                type="button"
                key={r.nama}
                onClick={() => setInfoRoom(r)}
                className={`room-card room-card-${availability}`}
                title={availTitle}
              >
                <span className="room-card-avail-badge">{availLabel}</span>
                <div className="room-card-icon" style={{ backgroundImage: `url(${roomPhotoUrl(r.nama)})` }} />
                <div className="room-card-body">
                  <h4>{r.nama}</h4>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Pesanan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: "auto" }}>
          <select id="overview-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ON_APPROVAL">On-Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : filteredItems.length === 0 ? (
        <div className="card table-empty">Tidak ada data.</div>
      ) : (
        filteredItems.map((item) => {
          const borderClass = bookingStatusBorderClass(item.status);
          const isDraft = item.status === "DRAFT";
          return (
            <div
              className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
              style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
              onClick={isDraft ? () => setDetail({ item, mode: "view" }) : undefined}
              key={item.id}
            >
              <div className="card-header">
                <div className="card-header-title">
                  <strong>{item.namaKegiatan} - {item.nomorPemesanan || "-"}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge-stack">
                    <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} />
                    {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                  </span>
                  <button
                    type="button"
                    className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                    aria-label="Chat"
                    onClick={(e) => { e.stopPropagation(); setChatItem(item); }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    {item.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); rowMenu.toggle(e, item.id, 180); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <RoomBookingStepper status={item.status} departemen={item.departemen} rejectTarget={item.rejectTarget} createdByRole={item.createdByRole} />
              {item.rejectReason && (
                <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                  <strong>Catatan Penolakan:</strong> {item.rejectReason}
                </div>
              )}
            </div>
          );
        })
      )}

      <RowMenuDropdown
        position={rowMenu.position}
        canEditDelete={
          !!rowMenu.menuItem &&
          ((isOrigin && isBookingEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleBooking(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isBookingDeletableByOrigin(rowMenu.menuItem, me)}
        canCancel={!!rowMenu.menuItem && isBookingCancellableByOrigin(rowMenu.menuItem, me)}
        onCancel={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setCancelTargetId(item.id);
        }}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          if (isOrigin && isBookingEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleBooking(item, me)) setRescheduleTarget(item);
        }}
        onStatus={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setStatusItemId(item.id);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
        pdfUrl={rowMenu.menuItem && isBookingPdfAvailable(rowMenu.menuItem) ? api.bookingPdfUrl(rowMenu.menuItem.id) : undefined}
        onPdfClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
        icsUrl={rowMenu.menuItem && isBookingPdfAvailable(rowMenu.menuItem) ? api.bookingIcsUrl(rowMenu.menuItem.id) : undefined}
        onIcsClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
      />

      {me && (
        <RoomBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => { setFormOpen(false); setFormInitial(undefined); }}
          onCreated={load}
        />
      )}

      <RoomInfoModal
        open={!!infoRoom}
        nama={infoRoom?.nama ?? null}
        kapasitas={infoRoom?.kapasitas ?? null}
        facilities={infoRoom ? ROOM_DEMO_FACILITIES : []}
        photoUrls={infoRoom ? roomPhotoUrls(infoRoom.nama) : []}
        availability={infoRoom ? (closedToday ? "closed" : isRoomFullyBookedToday(infoRoom.nama, todayEntries) ? "full" : "available") : "available"}
        availLabel={
          infoRoom
            ? closedToday
              ? "Close"
              : isRoomFullyBookedToday(infoRoom.nama, todayEntries)
              ? "Full"
              : "Available"
            : ""
        }
        freeSlotsToday={infoRoom && !closedToday ? roomFreeSlotsToday(infoRoom.nama, todayEntries).map(([s, e]) => `${minutesToHHMM(s)}–${minutesToHHMM(e)}`) : []}
        closedLabel={closedToday ? "Tutup (akhir pekan)" : undefined}
        fullyOpenLabel={
          infoRoom && !closedToday && roomFreeSlotsToday(infoRoom.nama, todayEntries).length === TOTAL_HOUR_SLOTS
            ? `Tersedia sepanjang hari (${minutesToHHMM(OPEN_MIN)}–${minutesToHHMM(CLOSE_MIN)})`
            : undefined
        }
        bookLabel={isOrigin ? "Booking" : "Lihat Kalender"}
        onClose={() => setInfoRoom(null)}
        onBook={() => {
          if (!infoRoom) return;
          const nama = infoRoom.nama;
          setInfoRoom(null);
          router.push(`/booking-ruang-meeting/calendar?ruang=${encodeURIComponent(nama)}`);
        }}
      />

      {me && (
        <RoomBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={load}
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <RoomBookingRescheduleModal
        open={!!rescheduleTarget}
        item={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={load}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          load();
        }}
      />

      <CancelBookingModal
        open={cancelTargetId != null}
        targetId={cancelTargetId}
        targetType="room"
        onClose={() => setCancelTargetId(null)}
        onDone={() => {
          setCancelTargetId(null);
          load();
        }}
      />

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <RoomBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.namaKegiatan} - ${bookingRoomsLabel(chatItem)} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={() => load({ silent: true })}
        />
      )}
    </>
  );
}
