"use client";

import type { BookingRuang, RoomOption } from "@/lib/types";

const HOURS = Array.from({ length: 13 }, (_, i) => 7 + i); // 07..19, each row = "HH:00 - (HH+1):00"

function parseHour(time: string): number {
  return Number(time.slice(0, 2));
}

function parseMinute(time: string): number {
  return Number(time.slice(3, 5));
}

function entryStatusClass(status: BookingRuang["status"]): string {
  return status === "APPROVED_GA_APPROVAL" ? "schedule-cell-confirmed" : "schedule-cell-pending";
}

interface Props {
  rooms: RoomOption[];
  entries: BookingRuang[];
  onSlotClick: (namaRuang: string, jam: number) => void;
  onEntryClick: (entry: BookingRuang) => void;
}

type CellPlan =
  | { type: "empty" }
  | { type: "skip" }
  | { type: "wholeday"; entry: BookingRuang }
  | { type: "start"; entry: BookingRuang; rowSpan: number };

// Precomputes, per room, which hour-rows are empty/clickable vs. covered by a booking's
// rowSpan - snapping arbitrary start/end times to whole-hour cells for display only (the
// stored booking keeps its exact time; only how it's drawn on this grid is rounded).
function buildPlan(rooms: RoomOption[], entries: BookingRuang[]): Map<string, Map<number, CellPlan>> {
  const plan = new Map<string, Map<number, CellPlan>>();

  for (const room of rooms) {
    const roomEntries = entries.filter((e) => e.namaRuang === room.nama);
    const wholeDay = roomEntries.find((e) => e.isWholeDay);
    const hourMap = new Map<number, CellPlan>();

    if (wholeDay) {
      for (const hour of HOURS) hourMap.set(hour, { type: "wholeday", entry: wholeDay });
    } else {
      for (const hour of HOURS) hourMap.set(hour, { type: "empty" });
      const sorted = roomEntries
        .filter((e): e is BookingRuang & { jamMulai: string; jamSelesai: string } => !!e.jamMulai && !!e.jamSelesai)
        .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
      for (const entry of sorted) {
        const startHour = Math.max(HOURS[0], parseHour(entry.jamMulai));
        let endHour = parseHour(entry.jamSelesai);
        if (parseMinute(entry.jamSelesai) > 0) endHour += 1;
        endHour = Math.min(HOURS[HOURS.length - 1] + 1, endHour);
        const rowSpan = Math.max(1, endHour - startHour);
        hourMap.set(startHour, { type: "start", entry, rowSpan });
        for (let h = startHour + 1; h < startHour + rowSpan; h++) hourMap.set(h, { type: "skip" });
      }
    }
    plan.set(room.nama, hourMap);
  }

  return plan;
}

export default function RoomScheduleGrid({ rooms, entries, onSlotClick, onEntryClick }: Props) {
  const plan = buildPlan(rooms, entries);

  return (
    <div className="table-wrap">
      <table className="data-table schedule-table">
        <thead>
          <tr>
            <th className="schedule-time-col">Jam</th>
            {rooms.map((r) => (
              <th key={r.nama}>
                {r.nama} <span className="text-secondary">({r.kapasitas} orang)</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <td className="schedule-time-col">{String(hour).padStart(2, "0")}:00</td>
              {rooms.map((room) => {
                const cell = plan.get(room.nama)?.get(hour);
                if (!cell || cell.type === "skip") return null;

                if (cell.type === "empty") {
                  return (
                    <td key={room.nama} className="schedule-cell-empty" onClick={() => onSlotClick(room.nama, hour)}>
                      + Tersedia
                    </td>
                  );
                }

                if (cell.type === "wholeday") {
                  if (hour !== HOURS[0]) return null;
                  return (
                    <td
                      key={room.nama}
                      rowSpan={HOURS.length}
                      className={`schedule-cell-booked ${entryStatusClass(cell.entry.status)}`}
                      onClick={() => onEntryClick(cell.entry)}
                    >
                      <div className="schedule-cell-title">Sehari Penuh</div>
                      <div className="schedule-cell-meta">{cell.entry.namaKegiatan}</div>
                    </td>
                  );
                }

                return (
                  <td
                    key={room.nama}
                    rowSpan={cell.rowSpan}
                    className={`schedule-cell-booked ${entryStatusClass(cell.entry.status)}`}
                    onClick={() => onEntryClick(cell.entry)}
                  >
                    <div className="schedule-cell-title">{cell.entry.namaKegiatan}</div>
                    <div className="schedule-cell-meta">{cell.entry.departemen || cell.entry.divisi}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
