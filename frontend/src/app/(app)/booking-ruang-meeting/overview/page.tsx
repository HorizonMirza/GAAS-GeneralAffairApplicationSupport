"use client";

import { MessageSquare } from "lucide-react";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  bookingRoomsLabel,
  bookingStatusBorderClass,
  buildRoomBookingDuplicateInitial,
  canGaRescheduleBooking,
  isBookingCancellableByOrigin,
  isBookingDeletableByOrigin,
  isBookingEditableByOrigin,
  isBookingOriginRole,
  isBookingPdfAvailable,
} from "@/lib/constants";
import { currentYearMonth, formatDate, nowWib, todayLocalDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import { isWeekend } from "@/components/RoomCalendarView";
import CancelBookingModal from "@/components/CancelBookingModal";

// Ruang Meeting buka 07:00-18:00 (lihat ClosedNotice di RoomCalendarView). "Penuh" hanya berarti
// benar-benar penuh sepanjang hari - dihitung dari booking yang statusnya sudah APPROVED_GA_APPROVAL
// (final, bukan draft/masih-di-approval milik siapa pun) memakai menit asli (bukan dibulatkan ke
// blok jam), supaya dua meeting pendek yang menyisakan celah kosong di antaranya tidak salah
// dianggap menutup seluruh jam itu.
const OPEN_MIN = 7 * 60;
const CLOSE_MIN = 18 * 60;

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function nowMinutesLocal(): number {
  const now = nowWib();
  return now.getHours() * 60 + now.getMinutes();
}

// How much of today's operating hours are still ahead of "now" - the yardstick for "fully open"
// has to shrink over the day too, since an already-elapsed hour was excluded from freeSlotsToday
// and can no longer count toward a room being open the *whole* remaining day.
function remainingHourSlotsToday(): { count: number; start: number } {
  const now = nowMinutesLocal();
  let count = 0;
  let start = CLOSE_MIN;
  for (let h = OPEN_MIN; h < CLOSE_MIN; h += 60) {
    if (h < now) continue;
    if (count === 0) start = h;
    count++;
  }
  return { count, start };
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

function getRealRoomCurrentSlot(
  roomName: string,
  todayEntries: BookingRuang[],
  closed: boolean
): { jam: string; status: "free" | "booked"; judul: string } {
  if (closed) {
    return { jam: "Tutup", status: "booked", judul: "Tutup" };
  }

  const now = nowMinutesLocal();
  if (now >= CLOSE_MIN) {
    return { jam: "18:00", status: "booked", judul: "Tutup" };
  }

  // Filter actual real bookings for this room today
  const roomBookings = todayEntries
    .filter(
      (e) =>
        e.status !== "DRAFT" &&
        e.status !== "CANCELLED" &&
        !e.status.startsWith("REJECTED") &&
        (e.namaRuang === roomName || e.additionalRooms?.includes(roomName))
    )
    .map((e) => {
      const start = e.isWholeDay ? OPEN_MIN : toMinutes(e.jamMulai || "07:00");
      const end = e.isWholeDay ? CLOSE_MIN : toMinutes(e.jamSelesai || "18:00");
      return { ...e, startMin: start, endMin: end };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Determine current starting hour rounded down (e.g. 13:28 -> 13:00)
  const currentHour = now < OPEN_MIN ? Math.floor(OPEN_MIN / 60) : Math.floor(now / 60);
  const startHhmm = `${String(currentHour).padStart(2, "0")}:00`;

  // Check if there is an ongoing booking right now
  const ongoing = roomBookings.find((b) => b.startMin <= now && b.endMin > now);
  if (ongoing) {
    const jam = ongoing.isWholeDay
      ? "07:00 - 18:00"
      : `${ongoing.jamMulai?.slice(0, 5) || "07:00"} - ${ongoing.jamSelesai?.slice(0, 5) || "18:00"}`;
    return {
      jam,
      status: "booked",
      judul: ongoing.namaKegiatan || "Terisi",
    };
  }

  // No ongoing booking right now -> room is free right now, but headlining "now until the very
  // next booking" is misleading the moment that gap is trivial (e.g. a booking starting in 5
  // minutes) while a much bigger free block sits right after it - so scan every gap between
  // today's remaining bookings and headline the LARGEST one, not just the first one.
  // Gap lengths are measured from the real "now" (not the rounded-down display hour) - rounding
  // down here would inflate the very first gap by up to 59 minutes and could make it falsely win
  // against a genuinely bigger block later today (e.g. "free" reading 09:00-10:00 when actually
  // only 5 minutes are left before the next booking, hiding a real 6-hour opening right after it).
  // Also floored at OPEN_MIN - viewing the page before 07:00 must not let the pre-opening minutes
  // pad out the first gap's length either, or the same kind of false win can happen against a
  // booking that starts shortly after opening.
  const upcomingBookings = roomBookings.filter((b) => b.startMin > now);
  const effectiveNow = Math.max(now, OPEN_MIN);
  let cursor = effectiveNow;
  let bestStart = effectiveNow;
  let bestEnd = CLOSE_MIN;
  let bestLen = -1;
  for (const b of upcomingBookings) {
    if (b.startMin > cursor) {
      const len = b.startMin - cursor;
      if (len > bestLen) {
        bestLen = len;
        bestStart = cursor;
        bestEnd = b.startMin;
      }
    }
    cursor = Math.max(cursor, b.endMin);
  }
  if (CLOSE_MIN > cursor) {
    const len = CLOSE_MIN - cursor;
    if (len > bestLen) {
      bestLen = len;
      bestStart = cursor;
      bestEnd = CLOSE_MIN;
    }
  }

  if (bestLen <= 0) {
    // Booked solid from now through closing (back-to-back bookings with no real gap) - the room
    // isn't meaningfully "Available" even though "now" itself technically isn't inside a booking.
    const next = upcomingBookings[0];
    const jam = next.isWholeDay
      ? "07:00 - 18:00"
      : `${next.jamMulai?.slice(0, 5) || "07:00"} - ${next.jamSelesai?.slice(0, 5) || "18:00"}`;
    return { jam, status: "booked", judul: next.namaKegiatan || "Terisi" };
  }

  return {
    jam: `${bestStart === effectiveNow ? startHhmm : minutesToHHMM(bestStart)} - ${minutesToHHMM(bestEnd)}`,
    status: "free",
    judul: "Available",
  };
}

// Free (bookable) hours left today, one entry per whole hour within operating hours (e.g.
// 07:00-08:00, 08:00-09:00, ...) - bookings are only ever made on the hour, so there's no reason
// to offer a half-hour slot, and listing every open hour individually (instead of collapsing
// contiguous ones into one big range) is what actually lets someone see "which hours" at a glance.
// Any entry still in flight (SUBMITTED/APPROVED_L1/APPROVED_GA/APPROVED_GA_APPROVAL) blocks the
// slot, matching RoomCalendarView's own busy/pending/confirmed rule - only a DRAFT (not yet
// submitted) leaves the hour still free. An hour that has already started today is excluded too -
// "available" has to mean actually bookable right now, not just unbooked at some point earlier
// today that's already gone.
function roomFreeSlotsToday(roomName: string, todayEntries: BookingRuang[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status === "DRAFT") continue;
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
  const now = nowMinutesLocal();
  const free: [number, number][] = [];
  for (let h = OPEN_MIN; h < CLOSE_MIN; h += 60) {
    if (h < now) continue;
    const slotEnd = h + 60;
    const isBooked = booked.some(([bs, be]) => bs < slotEnd && be > h);
    if (!isBooked) free.push([h, slotEnd]);
  }
  return free;
}

function isRoomFullyBookedToday(roomName: string, todayEntries: BookingRuang[]): boolean {
  return roomFreeSlotsToday(roomName, todayEntries).length === 0;
}

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import SearchableSelect from "@/components/SearchableSelect";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomInfoModal from "@/components/RoomInfoModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RoomBookingRescheduleModal from "@/components/RoomBookingRescheduleModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
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
  // Forces a re-render every minute so the room cards' Available/Full/Close badge and "jam saat
  // ini terisi" text keep advancing with real time (e.g. flipping to Close right at 18:00)
  // instead of only updating whenever some unrelated state change happens to re-render the page.
  const [, setClockTick] = useState(0);

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
      // Also re-drives the available/penuh strip on each room card below - it was previously
      // fetched only once on mount, so cancelling/creating/approving a booking updated "Pesanan
      // Terbaru Saya" but left the room availability cards showing stale data until a manual
      // page reload.
      const today = await api.getBookingSchedule(todayLocalDate()).catch(() => []);
      setTodayEntries(today);
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
    const id = setInterval(() => setClockTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "DRAFT") return items.filter((i) => i.status === "DRAFT");
    if (statusFilter === "APPROVED") return items.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (statusFilter === "ON_APPROVAL") return items.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return items.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status) || i.status === "CANCELLED");
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  // Weekend, or today's operating hours (07:00-18:00) are already over - either way nothing is
  // actually bookable right now, so this should read "Close" rather than "Full" (which implies
  // every hour was genuinely taken by a booking).
  const isWeekendToday = isWeekend(todayLocalDate());
  const isPastClosingToday = nowMinutesLocal() >= CLOSE_MIN;
  const closedToday = isWeekendToday || isPastClosingToday;

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
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 12 }}>
        <WelcomeGreeting me={me} />
        {isOrigin && (
          <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
            + Booking Ruang Meeting
          </button>
        )}
      </div>

      {rooms.length > 0 && (
        <div className="room-grid" style={{ "--grid-cols": Math.ceil(rooms.length / 2) } as CSSProperties}>
          {rooms.map((r) => {
            const availability: "available" | "full" | "closed" = closedToday
              ? "closed"
              : isRoomFullyBookedToday(r.nama, todayEntries)
              ? "full"
              : "available";
            const availLabel = availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available";
            const availTitle =
              availability === "closed"
                ? isWeekendToday
                  ? "Close (akhir pekan)"
                  : "Close (di luar jam operasional)"
                : availability === "full"
                ? "Full hari ini"
                : "Available hari ini";

            const isAvail = availability === "available";
            const slot = getRealRoomCurrentSlot(r.nama, todayEntries, closedToday);

            return (
              <div
                key={r.nama}
                onClick={() => setInfoRoom(r)}
                className="room-card"
                title={availTitle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setInfoRoom(r);
                  }
                }}
              >
                <div className="room-card-photo-banner">
                  <img src={roomPhotoUrl(r.nama)} alt={r.nama} />
                  <div className="room-card-photo-overlay" />
                  <div className="room-card-photo-footer">
                    <span className="room-title">{r.nama}</span>
                    <span className={`room-badge ${availability === "closed" ? "badge-closed" : availability === "full" ? "badge-full" : "badge-available"}`}>
                      {availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available"}
                    </span>
                  </div>
                </div>
                <div className="room-card-body-exact">
                  {availability !== "closed" ? (
                    <div className="room-card-slots-exact">
                      <div
                        className={`room-card-slot-row-exact ${
                          slot.status === "free" ? "slot-free" : "slot-booked"
                        }`}
                      >
                        <span className="slot-time">{slot.jam}</span>
                        <span className="slot-status">{slot.status === "free" ? "Available" : slot.judul || "Terisi"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="room-card-slots-exact" style={{ minHeight: 22 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 10px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Pesanan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
          <SearchableSelect
            id="overview-status-filter"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
            getLabel={(v) => ({
              ALL: "Semua Status",
              DRAFT: "Draft",
              ON_APPROVAL: "On-Approval",
              APPROVED: "Approved",
              REJECTED: "Rejected",
            } as Record<string, string>)[v] || v}
            placeholder="Semua Status"
            searchable={false}
          />
        </div>
      </div>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : filteredItems.length === 0 ? (
        <div className="card table-empty">Tidak Ada Data</div>
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
                  {(() => {
                    const orgUnit = item.departemen || item.divisi;
                    const subtitle = `${formatDate(item.tanggal)}${orgUnit ? ` · ${orgUnit}` : ""} · ${bookingRoomsLabel(item)}`;
                    return (
                      <div className="text-secondary" style={{ fontSize: "0.82rem" }} title={subtitle}>
                        {subtitle}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span className="badge-stack">
                    <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} cancelledByRole={item.cancelledByRole} isRoom />
                    {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                  </span>
                  <button
                    type="button"
                    className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                    aria-label="Chat"
                    onClick={(e) => { e.stopPropagation(); setChatItem(item); }}
                  >
                    <MessageSquare width="17" height="17" />
                    {item.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); rowMenu.toggle(e, item.id, 180); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <RoomBookingStepper
                status={item.status}
                departemen={item.departemen}
                rejectTarget={item.rejectTarget}
                createdByRole={item.createdByRole}
                cancelledByRole={item.cancelledByRole}
                approvedByL1={item.approvedByL1}
                approvedByGa={item.approvedByGa}
                approvedByApprovalGa={item.approvedByApprovalGa}
              />
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
        onDuplicate={
          isOrigin
            ? () => {
                const item = rowMenu.menuItem;
                rowMenu.close();
                if (!item) return;
                setFormInitial(buildRoomBookingDuplicateInitial(item));
                setFormOpen(true);
              }
            : undefined
        }
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
        extraDetails={infoRoom ? [{ label: "Lantai", value: infoRoom.lantai ?? "-" }] : []}
        facilities={infoRoom ? infoRoom.fasilitas ?? [] : []}
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
        closedLabel={closedToday ? (isWeekendToday ? "Tutup (akhir pekan)" : "Tutup (di luar jam operasional)") : undefined}
        fullyOpenLabel={
          infoRoom && !closedToday
            ? getRealRoomCurrentSlot(infoRoom.nama, todayEntries, closedToday).jam
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

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <RoomBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.namaKegiatan} - ${bookingRoomsLabel(chatItem)} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={() => load({ silent: true })}
        />
      )}
    </>
  );
}
