"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import RoomScheduleGrid from "@/components/RoomScheduleGrid";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingCalendarPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [scheduleDate, setScheduleDate] = useState<string>(todayIso());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [entries, setEntries] = useState<BookingRuang[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role)
    : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  const loadSchedule = useCallback(async () => {
    setScheduleBusy(true);
    try {
      const [roomList, scheduleEntries] = await Promise.all([
        api.listRooms(),
        api.getBookingSchedule(scheduleDate),
      ]);
      setRooms(roomList);
      setEntries(scheduleEntries);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setScheduleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Kalender Ruang Meeting</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="page-btn" onClick={() => setScheduleDate((d) => addDays(d, -1))}>‹</button>
          <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          <button className="page-btn" onClick={() => setScheduleDate((d) => addDays(d, 1))}>›</button>
          <button className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={() => setScheduleDate(todayIso())}>Hari Ini</button>
        </div>
      </div>

      {scheduleBusy ? (
        <p className="text-secondary">Memuat jadwal...</p>
      ) : (
        <RoomScheduleGrid
          rooms={rooms}
          entries={entries}
          onSlotClick={(namaRuang, jam) => {
            if (!isOrigin) return;
            setFormInitial({
              namaRuang,
              tanggal: scheduleDate,
              jamMulai: `${String(jam).padStart(2, "0")}:00`,
              jamSelesai: `${String(jam + 1).padStart(2, "0")}:00`,
            });
            setFormOpen(true);
          }}
          onEntryClick={(entry) => setDetail({ item: entry, mode: "view" })}
        />
      )}

      {me && (
        <RoomBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onCreated={loadSchedule}
        />
      )}

      {me && (
        <RoomBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={loadSchedule}
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
          loadSchedule();
        }}
      />
    </>
  );
}
