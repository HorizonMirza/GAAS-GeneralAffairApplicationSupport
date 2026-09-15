export function formatThousandSeparator(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseThousandSeparator(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/\./g, "");
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    value
  );
}

// A bare "YYYY-MM-DD" string (a DateOnly field like `tanggal`, no time component) is spec'd to
// parse as UTC midnight, which can render as the previous day in a timezone behind UTC. Every
// helper below therefore pins its own timezone explicitly and none of them is left to the
// browser's - see WIB and formatDateTime.
//
// GAAS is used from Indonesia and every PDF/Excel it prints is stamped WIB (backend:
// Services/WaktuWib.cs). Timestamps arrive from the API as UTC, so rendering them in whatever
// zone the viewer's machine happens to be set to makes the screen disagree with the document -
// silently, and worst on a laptop whose clock is simply set wrong. Pin the display to WIB so the
// two can never drift apart.
const WIB = "Asia/Jakarta";

// A bare "YYYY-MM-DD" (a DateOnly field like `tanggal`) is a wall-clock calendar day with no
// zone of its own: shifting it by any offset is what makes it render a day early or late. Build
// it at UTC midnight and read it back as UTC, so the day that comes out is always the day that
// went in, whatever zone the browser is in.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date | null {
  const m = DATE_ONLY.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const dateOnly = parseDateOnly(value);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" };
  if (dateOnly) return dateOnly.toLocaleDateString("id-ID", { ...opts, timeZone: "UTC" });
  return new Date(value).toLocaleDateString("id-ID", { ...opts, timeZone: WIB });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const dateOnly = parseDateOnly(value);
  const zone = dateOnly ? "UTC" : WIB;
  const d = dateOnly ?? new Date(value);
  const datePart = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: zone,
  });
  const timePart = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: zone });
  return `${datePart}, ${timePart}`;
}

// "Today" always means today in Jakarta, never today on the viewer's machine.
const WIB_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Chat-bubble timestamp: just the time on a message from today, otherwise date + time so
// older messages in the same thread still carry enough context at a glance.
export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  const timePart = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB });
  if (WIB_DAY.format(d) === WIB_DAY.format(new Date())) return timePart;
  const datePart = d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", timeZone: WIB });
  return `${datePart}, ${timePart}`;
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: WIB,
  }).format(date);
}

export function currentYearMonth(): string {
  return todayLocalDate().slice(0, 7);
}

export function currentYear(): string {
  return todayLocalDate().slice(0, 4);
}

// The calendar day it currently is in WIB, as "YYYY-MM-DD" - the default a form should open on,
// and the month/year the overview pages filter by. new Date().toISOString() would give the UTC
// day, which is still yesterday in Indonesia until 7am; the viewer's own local day would drift
// on a machine set to another zone. en-CA formats as YYYY-MM-DD, which is the shape we need.
export function todayLocalDate(): string {
  return WIB_DAY.format(new Date());
}

// "Now", as a Date whose LOCAL getters (getHours, getDate, getMonth, ...) read WIB values.
// The calendar views work in date components rather than formatted strings - which cell is
// today, where the red now-line sits - so they need this rather than todayLocalDate(). Indonesia
// has no DST, so the fixed +7h shift is exact year-round (the same fact WaktuWib.cs relies on).
export function nowWib(): Date {
  const now = new Date();
  return new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
}

export function truncateText(str: string | null | undefined, maxLen: number): string {
  if (!str) return "-";
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function invoiceBulanLabel(bulan: string | null | undefined): string {
  if (!bulan) return "-";
  const [year, month] = bulan.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
}

// Jam disimpan/dikirim sebagai string "HH:mm[:ss]" (bukan datetime penuh), jadi diformat apa
// adanya (cukup ambil 5 karakter pertama) daripada lewat Date() yang tidak menerima format ini.
export function formatTimeRange(
  jamMulai: string | null | undefined,
  jamSelesai: string | null | undefined,
  isWholeDay: boolean
): string {
  if (isWholeDay) return "Sepanjang Hari";
  if (!jamMulai || !jamSelesai) return "-";
  return `${jamMulai.slice(0, 5)} - ${jamSelesai.slice(0, 5)}`;
}
