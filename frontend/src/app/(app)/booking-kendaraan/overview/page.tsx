"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  isBookingOriginRole,
  isKendaraanCancellableByOrigin,
  isKendaraanDeletableByOrigin,
  isKendaraanEditableByOrigin,
  canGaRescheduleKendaraan,
} from "@/lib/constants";
import { currentYearMonth, formatDate, todayLocalDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingKendaraan, BookingKendaraanCreatePayload, VehicleOption } from "@/lib/types";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import VehicleBookingFormModal from "@/components/VehicleBookingFormModal";
import RoomInfoModal from "@/components/RoomInfoModal";
import VehicleBookingDetailModal from "@/components/VehicleBookingDetailModal";
import VehicleBookingRescheduleModal from "@/components/VehicleBookingRescheduleModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import CancelBookingModal from "@/components/CancelBookingModal";
import VehicleBookingStatusHistoryModal from "@/components/VehicleBookingStatusHistoryModal";
import VehicleBookingChatModal from "@/components/VehicleBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";

// Vehicle Booking buka 07:00-18:00 (lihat OperatingStart/OperatingEnd di
// BookingKendaraanController). "Penuh" hanya berarti benar-benar penuh sepanjang jam operasional -
// dihitung dari booking yang statusnya sudah APPROVED_GA_APPROVAL (final) memakai menit asli
// (bukan dibulatkan ke blok jam), sama seperti Room Booking's isRoomFullyBookedToday.
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

// Demo facility list, shown in the info modal until real per-vehicle facility data exists.
const VEHICLE_DEMO_FACILITIES = ["AC", "Radio/Tape", "Sabuk Pengaman", "Kotak P3K"];

// Free (bookable) hours left today, one entry per whole hour within operating hours - same rule
// as Room Booking's roomFreeSlotsToday.
function vehicleFreeSlotsToday(vehicleName: string, todayEntries: BookingKendaraan[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status !== "APPROVED_GA_APPROVAL") continue;
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
  const free: [number, number][] = [];
  for (let h = OPEN_MIN; h < CLOSE_MIN; h += 60) {
    const slotEnd = h + 60;
    const isBooked = booked.some(([bs, be]) => bs < slotEnd && be > h);
    if (!isBooked) free.push([h, slotEnd]);
  }
  return free;
}

function isVehicleFullyBookedToday(vehicleName: string, todayEntries: BookingKendaraan[]): boolean {
  return vehicleFreeSlotsToday(vehicleName, todayEntries).length === 0;
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
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingKendaraan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

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
    if (statusFilter === "CANCELLED") return items.filter((i) => i.status === "CANCELLED");
    return items.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

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
        <div className="room-grid">
          {vehicles.map((v) => {
            const availability: "available" | "full" = isVehicleFullyBookedToday(v.nama, todayEntries) ? "full" : "available";
            const availLabel = availability === "full" ? "Full" : "Available";
            const availTitle = availability === "full" ? "Full hari ini" : "Available hari ini";
            return (
              <button
                type="button"
                key={v.nama}
                onClick={() => setInfoVehicle(v)}
                className={`room-card room-card-${availability}`}
                title={availTitle}
              >
                <span className="room-card-avail-badge">{availLabel}</span>
                <div className="room-card-icon" style={{ backgroundImage: `url(${vehiclePhotoUrl(v.nama)})` }} />
                <div className="room-card-body">
                  <h4>{v.nama}</h4>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Pesanan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: "auto" }}>
          <select id="overview-kendaraan-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
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
          const isDraft = item.status === "DRAFT";
          return (
            <div
              className="card item-row-card"
              style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
              onClick={isDraft ? () => setDetail({ item, mode: "view" }) : undefined}
              key={item.id}
            >
              <div className="card-header">
                <div className="card-header-title">
                  <strong>{item.keperluan} - {item.nomorPemesanan || "-"}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BookingStatusBadge status={item.status} departemen={item.departemen} cancelledByName={item.cancelledByName} />
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
        canCancel={!!rowMenu.menuItem && isKendaraanCancellableByOrigin(rowMenu.menuItem, me)}
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
          if (isOrigin && isKendaraanEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleKendaraan(item, me)) setRescheduleTarget(item);
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
        kapasitas={infoVehicle?.kapasitas ?? null}
        facilities={infoVehicle ? VEHICLE_DEMO_FACILITIES : []}
        photoUrls={infoVehicle ? vehiclePhotoUrls(infoVehicle.nama) : []}
        availability={infoVehicle && isVehicleFullyBookedToday(infoVehicle.nama, todayEntries) ? "full" : "available"}
        availLabel={infoVehicle && isVehicleFullyBookedToday(infoVehicle.nama, todayEntries) ? "Full" : "Available"}
        freeSlotsToday={infoVehicle ? vehicleFreeSlotsToday(infoVehicle.nama, todayEntries).map(([s, e]) => `${minutesToHHMM(s)}–${minutesToHHMM(e)}`) : []}
        fullyOpenLabel={
          infoVehicle && vehicleFreeSlotsToday(infoVehicle.nama, todayEntries).length === TOTAL_HOUR_SLOTS
            ? `Tersedia sepanjang hari (${minutesToHHMM(OPEN_MIN)}–${minutesToHHMM(CLOSE_MIN)})`
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
        targetType="kendaraan"
        onClose={() => setCancelTargetId(null)}
        onDone={() => {
          setCancelTargetId(null);
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
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={() => load({ silent: true })}
        />
      )}
    </>
  );
}
