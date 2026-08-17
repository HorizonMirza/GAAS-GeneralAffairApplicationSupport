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

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  const datePart = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

// Chat-bubble timestamp: just the time on a message from today, otherwise date + time so
// older messages in the same thread still carry enough context at a glance.
export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const timePart = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return timePart;
  const datePart = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  return `${datePart}, ${timePart}`;
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function truncateText(str: string | null | undefined, maxLen: number): string {
  if (!str) return "-";
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
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
  if (isWholeDay) return "Sehari Penuh";
  if (!jamMulai || !jamSelesai) return "-";
  return `${jamMulai.slice(0, 5)} - ${jamSelesai.slice(0, 5)}`;
}
