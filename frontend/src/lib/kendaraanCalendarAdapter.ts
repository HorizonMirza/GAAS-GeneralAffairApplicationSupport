import type { BookingKendaraan, BookingRuang } from "./types";

// RoomCalendarView's day/week/month rendering only ever reads a handful of generic fields
// (status, tanggal, jamMulai/jamSelesai, isWholeDay, namaKegiatan, hasConflict, id, createdAt) -
// none of them Room-specific (the actual room-name fields are only touched by its "avail" view,
// which Vehicle Booking doesn't use). Mapping a BookingKendaraan into that same shape lets the
// calendar page reuse RoomCalendarView as-is instead of duplicating its ~750 lines for a second
// resource type.
export function kendaraanAsBookingRuangShape(k: BookingKendaraan): BookingRuang {
  return {
    id: k.id,
    nomorPemesanan: k.nomorPemesanan,
    namaKegiatan: k.keperluan,
    pic: k.pic,
    namaRuang: k.namaKendaraan,
    additionalRooms: [],
    kapasitasRuang: k.kapasitasKendaraan,
    jumlahPeserta: k.jumlahPenumpang,
    tanggal: k.tanggal,
    isWholeDay: k.isWholeDay,
    jamMulai: k.jamMulai,
    jamSelesai: k.jamSelesai,
    catatan: k.catatan,
    divisi: k.divisi,
    departemen: k.departemen,
    tipe: "INTERNAL",
    seriesId: null,
    recurrenceFrequency: null,
    recurrenceEndDate: null,
    hasConflict: false,
    status: k.status,
    rejectReason: k.rejectReason,
    rejectTarget: null,
    createdBy: k.createdBy,
    createdByRole: k.createdByRole,
    approvedByL1: k.approvedByL1,
    approvedByGa: k.approvedByGa,
    approvedByApprovalGa: k.approvedByApprovalGa,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
    approvedL1At: k.approvedL1At,
    approvedGaAt: k.approvedGaAt,
    approvedApprovalGaAt: k.approvedApprovalGaAt,
    unreadChatCount: k.unreadChatCount,
    hasUnreadMention: k.hasUnreadMention,
  };
}
