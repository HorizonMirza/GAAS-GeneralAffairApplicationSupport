import { nowWib, todayLocalDate } from "./format";

export const OPERATING_START_HOUR = 7;
export const OPERATING_END_HOUR = 18;

/**
 * Returns available start hours for a given date.
 * If date is today, start hours must be strictly after current WIB hour (or empty if >= 17).
 * If date is in the future, start hours are 07:00 through 17:00.
 */
export function getAvailableStartHours(tanggal: string): string[] {
  if (!tanggal) return [];
  const today = todayLocalDate();
  if (tanggal < today) return [];

  let minH = OPERATING_START_HOUR;
  if (tanggal === today) {
    const currentHour = nowWib().getHours();
    minH = Math.max(OPERATING_START_HOUR, currentHour + 1);
  }

  if (minH >= OPERATING_END_HOUR) return [];

  const hours: string[] = [];
  for (let h = minH; h < OPERATING_END_HOUR; h++) {
    hours.push(`${String(h).padStart(2, "0")}:00`);
  }
  return hours;
}

/**
 * Returns available end hours given a selected start hour.
 * End hours must be strictly greater than start hour, up to 18:00.
 */
export function getAvailableEndHours(jamMulai?: string | null): string[] {
  if (!jamMulai) return [];
  const startH = parseInt(jamMulai.slice(0, 2), 10);
  if (isNaN(startH)) return [];
  const minEnd = Math.max(OPERATING_START_HOUR + 1, startH + 1);

  const hours: string[] = [];
  for (let h = minEnd; h <= OPERATING_END_HOUR; h++) {
    hours.push(`${String(h).padStart(2, "0")}:00`);
  }
  return hours;
}

/**
 * Checks if "Sepanjang Hari" (07:00 - 18:00) can be booked for the given date.
 * For today, it is only allowed before operating hours begin (< 07:00).
 */
export function isWholeDayAllowed(tanggal: string): boolean {
  if (!tanggal) return true;
  const today = todayLocalDate();
  if (tanggal < today) return false;
  if (tanggal === today) {
    return nowWib().getHours() < OPERATING_START_HOUR;
  }
  return true;
}

/**
 * Checks if a specific date and hour slot is in the past.
 */
export function isPastSlot(tanggal: string, hour: number): boolean {
  const today = todayLocalDate();
  if (tanggal < today) return true;
  if (tanggal === today) {
    return hour <= nowWib().getHours();
  }
  return false;
}

/**
 * Computes default date and time slots for initial form load.
 * E.g., at 14:35 WIB, default is today, 15:00 - 17:00.
 * If today has no slots left (after 17:00 WIB), it suggests tomorrow.
 */
export function getDefaultBookingSlot(initialDate?: string): {
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
} {
  const today = todayLocalDate();
  const currentH = nowWib().getHours();

  let date = initialDate || today;
  if (!initialDate && currentH >= OPERATING_END_HOUR - 1) {
    // Today has no slots left, advance to tomorrow
    const d = nowWib();
    d.setDate(d.getDate() + 1);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const availableStarts = getAvailableStartHours(date);
  if (availableStarts.length === 0) {
    return {
      tanggal: date,
      jamMulai: "",
      jamSelesai: "",
    };
  }

  const jamMulai = availableStarts[0];
  const startNum = parseInt(jamMulai.slice(0, 2), 10);
  const endNum = Math.min(OPERATING_END_HOUR, startNum + 2);
  const jamSelesai = `${String(endNum).padStart(2, "0")}:00`;

  return {
    tanggal: date,
    jamMulai,
    jamSelesai,
  };
}
