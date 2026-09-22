"use client";

import { MessageSquare } from "lucide-react";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  bookingStatusBorderClass,
  isBookingOriginRole,
  isKendaraanDeletableByOrigin,
  buildVehicleBookingDuplicateInitial,
  isKendaraanEditableByOrigin,
  isKendaraanPdfAvailable,
  canGaKoreksiKendaraan,
  canGaRescheduleKendaraan,
} from "@/lib/constants";
import { currentYearMonth, formatDate, nowWib, todayLocalDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingKendaraan, BookingKendaraanCreatePayload, VehicleOption } from "@/lib/types";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import SearchableSelect from "@/components/SearchableSelect";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import VehicleBookingFormModal from "@/components/VehicleBookingFormModal";
import RoomInfoModal from "@/components/RoomInfoModal";
import VehicleBookingDetailModal from "@/components/VehicleBookingDetailModal";
import VehicleBookingRescheduleModal from "@/components/VehicleBookingRescheduleModal";
import VehicleBookingKoreksiModal from "@/components/VehicleBookingKoreksiModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import VehicleBookingStatusHistoryModal from "@/components/VehicleBookingStatusHistoryModal";
import VehicleBookingChatModal from "@/components/VehicleBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED";

// Vehicle Booking buka 07:00-18:00 (lihat OperatingStart/OperatingEnd di
// BookingKendaraanController). "Penuh" hanya berarti benar-benar penuh sepanjang jam operasional -
// dihitung dari booking yang statusnya sudah APPROVED_GA_APPROVAL (final) memakai menit asli
// (bukan dibulatkan ke blok jam), sama seperti Room Booking's isRoomFullyBookedToday.
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

// How much of today's operating hours are still ahead of "now" - same reasoning as Room
// Booking's remainingHourSlotsToday.
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

// Placeholder vehicle photos - filenames are the vehicle name slugified, so replacing the look of
// a vehicle later is just overwriting /public/assets/vehicles/<slug>.png with a real photo (same
// name, no code change needed). Same convention as roomPhotoUrl in the Room Booking overview.
function vehiclePhotoUrl(vehicleName: string): string {
  const slug = vehicleName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/assets/vehicles/${slug}.png`;
}

// Every vehicle only has the one placeholder photo above so far - pads the info modal's
// slideshow out to a handful of slides by borrowing a few other vehicles' placeholders, until
// real per-vehicle photos exist. Same convention as roomPhotoUrls in the Room Booking overview.
const DEMO_VEHICLE_PHOTOS = [
  "/assets/vehicles/toyota-avanza-1.png",
  "/assets/vehicles/toyota-innova.png",
  "/assets/vehicles/honda-hr-v.png",
  "/assets/vehicles/mitsubishi-xpander.png",
  "/assets/vehicles/toyota-fortuner.png",
];
function vehiclePhotoUrls(vehicleName: string): string[] {
  const own = vehiclePhotoUrl(vehicleName);
  return [own, ...DEMO_VEHICLE_PHOTOS.filter((u) => u !== own)].slice(0, 5);
}


// Free (bookable) hours left today, one entry per whole hour within operating hours - same rule
// as Room Booking's roomFreeSlotsToday.
function vehicleFreeSlotsToday(vehicleName: string, todayEntries: BookingKendaraan[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status === "DRAFT") continue;
    if (entry.namaKendaraan !== vehicleName) continue;
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

function isVehicleFullyBookedToday(vehicleName: string, todayEntries: BookingKendaraan[]): boolean {
  return vehicleFreeSlotsToday(vehicleName, todayEntries).length === 0;
}

function getRealVehicleCurrentSlot(
  vehicleName: string,
  todayEntries: BookingKendaraan[],
  closed: boolean
): { jam: string; status: "free" | "booked"; judul: string } {
  if (closed) {
    return { jam: "Tutup", status: "booked", judul: "Tutup" };
  }

  const now = nowMinutesLocal();
  if (now >= CLOSE_MIN) {
    return { jam: "18:00", status: "booked", judul: "Tutup" };
  }

  // Filter actual real bookings for this vehicle today
  const vehicleBookings = todayEntries
    .filter(
      (e) =>
        e.status !== "DRAFT" &&
        e.status !== "CANCELLED" &&
        !e.status.startsWith("REJECTED") &&
        e.namaKendaraan === vehicleName
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
  const ongoing = vehicleBookings.find((b) => b.startMin <= now && b.endMin > now);
  if (ongoing) {
    const jam = ongoing.isWholeDay
      ? "07:00 - 18:00"
      : `${ongoing.jamMulai?.slice(0, 5) || "07:00"} - ${ongoing.jamSelesai?.slice(0, 5) || "18:00"}`;
    return {
      jam,
      status: "booked",
      judul: ongoing.keperluan || "Terisi",
    };
  }

  // No ongoing booking right now -> Vehicle is free right now!
  // Find the next upcoming booking starting after now
  const upcoming = vehicleBookings.find((b) => b.startMin > now && b.startMin < CLOSE_MIN);
  if (upcoming) {
    const untilHhmm = upcoming.jamMulai?.slice(0, 5) || "18:00";
    return {
      jam: `${startHhmm} - ${untilHhmm}`,
      status: "free",
      judul: "Available",
    };
  }

  // No more bookings today -> Available from current hour until 18:00
  return {
    jam: `${startHhmm} - 18:00`,
    status: "free",
    judul: "Available",
  };
}

export default function VehicleBookingOverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<BookingKendaraan[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [todayEntries, setTodayEntries] = useState<BookingKendaraan[]>([]);
  const [busy, setBusy] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingKendaraanCreatePayload> | undefined>(undefined);
  const [infoVehicle, setInfoVehicle] = useState<VehicleOption | null>(null);
  const [detail, setDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [koreksiTarget, setKoreksiTarget] = useState<BookingKendaraan | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingKendaraan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
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
      const queue = await api.listKendaraanBooking({ limit: 1000, page: 1, sejakBulan: currentYearMonth() }).then((r) => r.items);
      setItems(queue);
    } finally {
      setBusy(false);
    }
  }, [me]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    // Drives the available/penuh strip on each vehicle card below - fetched once on mount, same
    // as vehicles above, since "today" doesn't change without a page reload.
    api.getKendaraanSchedule(todayLocalDate()).then(setTodayEntries).catch(() => setTodayEntries([]));
  }, []);

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "DRAFT") return items.filter((i) => i.status === "DRAFT");
    if (statusFilter === "APPROVED") return items.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (statusFilter === "ON_APPROVAL") return items.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return items.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  const isPastClosingToday = nowMinutesLocal() >= CLOSE_MIN;

  function handleDelete(item: BookingKendaraan) {
    confirm("Hapus booking kendaraan ini secara permanen?", async () => {
      try {
        await api.deleteKendaraanBooking(item.id);
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
            + Booking Kendaraan
          </button>
        )}
      </div>

      {vehicles.length > 0 && (
        <div className="room-grid" style={{ "--grid-cols": Math.ceil(vehicles.length / 2) } as CSSProperties}>
          {vehicles.map((v) => {
            // Today's operating hours (07:00-18:00) are already over - "Close" rather than
            // "Full", which would otherwise wrongly imply every hour was genuinely booked out.
            const availability: "available" | "full" | "closed" = isPastClosingToday
              ? "closed"
              : isVehicleFullyBookedToday(v.nama, todayEntries)
              ? "full"
              : "available";
            const availLabel = availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available";
            const availTitle =
              availability === "closed" ? "Close (di luar jam operasional)" : availability === "full" ? "Full hari ini" : "Available hari ini";
            const slot = getRealVehicleCurrentSlot(v.nama, todayEntries, isPastClosingToday);
            return (
              <div
                key={v.nama}
                onClick={() => setInfoVehicle(v)}
                className="room-card"
                title={availTitle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setInfoVehicle(v);
                  }
                }}
              >
                <div className="room-card-photo-banner">
                  <img src={vehiclePhotoUrl(v.nama)} alt={v.nama} />
                  <div className="room-card-photo-overlay" />
                  <div className="room-card-photo-footer">
                    <span className="room-title">{v.nama}</span>
                    <span className={`room-badge ${availability === "closed" ? "badge-closed" : availability === "full" ? "badge-full" : "badge-available"}`}>
                      {availLabel}
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Pesanan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
          <SearchableSelect
            id="overview-kendaraan-status-filter"
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
          const isDraft = item.status === "DRAFT";
          const borderClass = bookingStatusBorderClass(item.status);
          return (
            <div
              className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
              style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
              onClick={isDraft ? () => setDetail({ item, mode: "view" }) : undefined}
              key={item.id}
            >
              <div className="card-header">
                <div className="card-header-title">
                  <strong>{item.keperluan} - {item.nomorPemesanan || "-"}</strong>
                  {(() => {
                    const orgUnit = item.departemen || item.divisi;
                    const subtitle = `${formatDate(item.tanggal)}${orgUnit ? ` · ${orgUnit}` : ""} · ${item.namaKendaraan}`;
                    return (
                      <div className="text-secondary" style={{ fontSize: "0.82rem" }} title={subtitle}>
                        {subtitle}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} isKendaraan />
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
              <RoomBookingStepper status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
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
          ((isOrigin && isKendaraanEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleKendaraan(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isKendaraanDeletableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          if (isOrigin && isKendaraanEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleKendaraan(item, me)) setRescheduleTarget(item);
        }}
        onDuplicate={
          isOrigin
            ? () => {
                const item = rowMenu.menuItem;
                rowMenu.close();
                if (!item) return;
                setFormInitial(buildVehicleBookingDuplicateInitial(item));
                setFormOpen(true);
              }
            : undefined
        }
        canKoreksi={!!rowMenu.menuItem && canGaKoreksiKendaraan(rowMenu.menuItem, me)}
        onKoreksi={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setKoreksiTarget(item);
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
        pdfUrl={rowMenu.menuItem && isKendaraanPdfAvailable(rowMenu.menuItem) ? api.kendaraanPdfUrl(rowMenu.menuItem.id) : undefined}
        onPdfClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.kendaraanPdfUrl(item.id), `Bukti-Booking-Kendaraan-${item.nomorPemesanan || item.id}.pdf`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
      />

      {me && (
        <VehicleBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => { setFormOpen(false); setFormInitial(undefined); }}
          onCreated={load}
        />
      )}

      <RoomInfoModal
        open={!!infoVehicle}
        nama={infoVehicle?.nama ?? null}
        kapasitas={null}
        extraDetails={
          infoVehicle
            ? [
                { label: "Merek", value: infoVehicle.merek || "-" },
                { label: "Warna", value: infoVehicle.warna || "-" },
                { label: "Tahun", value: infoVehicle.tahun ? String(infoVehicle.tahun) : "-" },
                { label: "Kapasitas", value: `${infoVehicle.kapasitas} orang` },
                { label: "Plat Nomor", value: infoVehicle.platNomor || "-" },
                { label: "Nama Pengemudi", value: infoVehicle.supir || "-" },
                { label: "No Telepon Pengemudi", value: infoVehicle.nomorTeleponSupir || "-" },
              ]
            : []
        }
        photoUrls={infoVehicle ? vehiclePhotoUrls(infoVehicle.nama) : []}
        availability={
          infoVehicle
            ? isPastClosingToday
              ? "closed"
              : isVehicleFullyBookedToday(infoVehicle.nama, todayEntries)
              ? "full"
              : "available"
            : "available"
        }
        availLabel={
          infoVehicle
            ? isPastClosingToday
              ? "Close"
              : isVehicleFullyBookedToday(infoVehicle.nama, todayEntries)
              ? "Full"
              : "Available"
            : ""
        }
        freeSlotsToday={infoVehicle && !isPastClosingToday ? vehicleFreeSlotsToday(infoVehicle.nama, todayEntries).map(([s, e]) => `${minutesToHHMM(s)}–${minutesToHHMM(e)}`) : []}
        closedLabel={isPastClosingToday ? "Tutup (di luar jam operasional)" : undefined}
        fullyOpenLabel={
          infoVehicle && !isPastClosingToday && vehicleFreeSlotsToday(infoVehicle.nama, todayEntries).length === remainingHourSlotsToday().count && remainingHourSlotsToday().count > 0
            ? "Tersedia"
            : undefined
        }
        bookLabel={isOrigin ? "Booking" : "Lihat Kalender"}
        onClose={() => setInfoVehicle(null)}
        onBook={() => {
          if (!infoVehicle) return;
          const nama = infoVehicle.nama;
          setInfoVehicle(null);
          router.push(`/booking-kendaraan/calendar?kendaraan=${encodeURIComponent(nama)}`);
        }}
      />

      {me && (
        <VehicleBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={load}
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <VehicleBookingRescheduleModal
        open={!!rescheduleTarget}
        item={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={load}
      />

      <VehicleBookingKoreksiModal
        open={!!koreksiTarget}
        item={koreksiTarget}
        onClose={() => setKoreksiTarget(null)}
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

      <VehicleBookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <VehicleBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.keperluan} - ${chatItem.namaKendaraan} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={() => load({ silent: true })}
        />
      )}
    </>
  );
}
