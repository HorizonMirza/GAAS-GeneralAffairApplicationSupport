"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i); // 07..17, each row = "HH:00 - (HH+1):00"

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isWeekend(iso: string): boolean {
  const dow = new Date(iso + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

function parseHour(t: string): number {
  return Number(t.slice(0, 2));
}

function parseMinute(t: string): number {
  return Number(t.slice(3, 5));
}

function statusClass(status: BookingRuang["status"]): string {
  if (status === "DRAFT") return "avail-cell-draft";
  if (status === "APPROVED_GA_APPROVAL") return "avail-cell-approved";
  return "avail-cell-pending";
}

interface TimedEntry {
  entry: BookingRuang;
  startHour: number;
  endHour: number;
}

type RoomCellPlan =
  | { type: "empty" }
  | { type: "skip" }
  | { type: "busy"; rangeStart: number; rowSpan: number; entries: BookingRuang[] };

// Same overlap-merging sweep as RoomCalendarView's buildDayPlan, but for one room's own entries -
// this view only needs to know "busy or not" per room+hour, not lay competing entries side by
// side, so overlapping entries are folded into one block (see the "+N" label below) instead.
function buildRoomPlan(roomEntries: BookingRuang[]): Map<number, RoomCellPlan> {
  const plan = new Map<number, RoomCellPlan>();
  for (const hour of HOURS) plan.set(hour, { type: "empty" });

  const timed: TimedEntry[] = roomEntries
    .map((entry) => {
      if (entry.isWholeDay) return { entry, startHour: HOURS[0], endHour: HOURS[HOURS.length - 1] + 1 };
      if (!entry.jamMulai || !entry.jamSelesai) return null;
      const startHour = Math.max(HOURS[0], parseHour(entry.jamMulai));
      let endHour = parseHour(entry.jamSelesai);
      if (parseMinute(entry.jamSelesai) > 0) endHour += 1;
      endHour = Math.min(HOURS[HOURS.length - 1] + 1, Math.max(endHour, startHour + 1));
      return { entry, startHour, endHour };
    })
    .filter((e): e is TimedEntry => e !== null)
    .sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

  let cluster: TimedEntry[] = [];
  let clusterEnd = -1;
  const clusters: TimedEntry[][] = [];
  for (const item of timed) {
    if (cluster.length > 0 && item.startHour < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endHour);
    } else {
      if (cluster.length > 0) clusters.push(cluster);
      cluster = [item];
      clusterEnd = item.endHour;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);

  for (const group of clusters) {
    const rangeStart = Math.min(...group.map((g) => g.startHour));
    const rangeEnd = Math.max(...group.map((g) => g.endHour));
    const rowSpan = rangeEnd - rangeStart;
    plan.set(rangeStart, { type: "busy", rangeStart, rowSpan, entries: group.map((g) => g.entry) });
    for (let h = rangeStart + 1; h < rangeStart + rowSpan; h++) plan.set(h, { type: "skip" });
  }
  return plan;
}

export default function RoomAvailabilityPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [date, setDate] = useState(todayLocalDate());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [entries, setEntries] = useState<BookingRuang[]>([]);
  const [busy, setBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role)
    : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.getBookingSchedule(date);
      setEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const plans = useMemo(
    () => rooms.map((r) => buildRoomPlan(entries.filter((e) => e.namaRuang === r.nama || e.additionalRooms.includes(r.nama)))),
    [rooms, entries]
  );

  if (!me || me.role === "SUPER_ADMIN") return null;

  function openCreateForm(namaRuang: string, hour: number) {
    if (!isOrigin) return;
    setFormInitial({ namaRuang, tanggal: date, jamMulai: `${pad(hour)}:00`, jamSelesai: `${pad(hour + 1)}:00` });
    setFormOpen(true);
  }

  const weekend = isWeekend(date);

  return (
    <>
      <div className="card">
        <div className="calendar-topbar avail-topbar">
          <div className="calendar-topbar-left">
            <button type="button" className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={() => setDate(todayLocalDate())}>Hari Ini</button>
            <div className="calendar-nav-arrows" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                className="page-btn"
                onClick={() => setDate((d) => addDays(d, -1))}
                aria-label="Sebelumnya"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                className="page-btn"
                onClick={() => setDate((d) => addDays(d, 1))}
                aria-label="Berikutnya"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="avail-date-input" />
          </div>
          <div className="avail-legend">
            <span><span className="avail-dot avail-cell-draft" />Draft</span>
            <span><span className="avail-dot avail-cell-pending" />On-Approval</span>
            <span><span className="avail-dot avail-cell-approved" />Approved</span>
            <span><span className="avail-dot avail-dot-empty" />Kosong</span>
          </div>
        </div>

        {weekend ? (
          <div className="schedule-closed-notice">
            Ruang Meeting tutup pada hari sabtu dan minggu. Ruang Meeting tersedia pada hari Senin - Jumat, 07:00 - 18:00.
          </div>
        ) : busy || rooms.length === 0 ? (
          <p className="text-secondary">Memuat ketersediaan...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table schedule-table avail-table">
              <thead>
                <tr>
                  <th className="schedule-time-col schedule-th-center">Jam</th>
                  {rooms.map((r) => (
                    <th key={r.nama} className="schedule-th-center" title={r.nama}>{r.nama}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="schedule-time-col">{pad(hour)}:00</td>
                    {rooms.map((r, idx) => {
                      const cell = plans[idx]?.get(hour);
                      if (!cell || cell.type === "skip") return null;
                      if (cell.type === "empty") {
                        return (
                          <td
                            key={r.nama}
                            className={`avail-cell-empty-wrap${isOrigin ? " avail-cell-clickable" : ""}`}
                            onClick={() => openCreateForm(r.nama, hour)}
                          />
                        );
                      }
                      const primary = cell.entries[0];
                      const extra = cell.entries.length - 1;
                      const timeLabel = primary.isWholeDay
                        ? "Sepanjang Hari"
                        : `${primary.jamMulai?.slice(0, 5)}-${primary.jamSelesai?.slice(0, 5)}`;
                      return (
                        <td key={r.nama} rowSpan={cell.rowSpan} className="avail-cell-busy-wrap">
                          <div
                            className={`avail-cell-busy ${statusClass(primary.status)}`}
                            onClick={() => setDetail({ item: primary, mode: "view" })}
                          >
                            <div className="avail-cell-title">{primary.namaKegiatan}{extra > 0 ? ` +${extra}` : ""}</div>
                            <div className="avail-cell-time">{timeLabel}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {me && (
        <RoomBookingFormModal open={formOpen} me={me} initial={formInitial} onClose={() => setFormOpen(false)} onCreated={load} />
      )}

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
    </>
  );
}
