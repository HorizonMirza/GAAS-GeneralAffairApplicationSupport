namespace PengirimanApi.Models;

public enum RoleEnum
{
    ADMIN_DEPARTEMEN,
    APPROVAL_DEPARTEMEN,
    ADMIN_DIVISI,
    APPROVAL_DIVISI,
    ADMIN_GA,
    APPROVAL_GA,
    KPU,
    SUPER_ADMIN,
}

public enum AsuransiEnum
{
    Ya,
    Tidak,
}

public enum InvoiceStatusEnum
{
    DRAFT,
    PENDING,
    APPROVED,
    REJECTED,
}

public enum StatusEnum
{
    DRAFT,
    SUBMITTED,
    REJECTED_L1,
    APPROVED_L1,
    REJECTED_GA,
    APPROVED_GA,
    REJECTED_GA_APPROVAL,
    APPROVED_GA_APPROVAL,
    REJECTED_KPU,
    COMPLETED,
}

public enum RejectTargetEnum
{
    GA,
    ORIGIN,
}

// Office Supplies: channel Admin GA/Approval GA actually buys through - selected when they
// approve their own tier (see PermintaanAtkController.ApproveGa/Submit), then carried through to
// KPU's own final sign-off.
public enum SumberPembelianEnum
{
    KPU,
    PADI,
}

public enum BookingStatusEnum
{
    DRAFT,
    SUBMITTED,
    REJECTED_L1,
    APPROVED_L1,
    REJECTED_GA,
    APPROVED_GA,
    REJECTED_GA_APPROVAL,
    APPROVED_GA_APPROVAL,
    // Room/Vehicle Booking only (see BookingRuangController.Cancel/BookingKendaraanController.Cancel) -
    // the creator, Admin GA, or Approval GA can cancel an on-approval or already-approved booking up
    // until its own start time. A dead end like REJECTED_*, but distinct from it: the item was never
    // refused by anyone in the approval chain, its own origin/GA called it off.
    CANCELLED,
}

public enum TipeBookingEnum
{
    INTERNAL,
    EXTERNAL,
}

public enum RecurrenceFrequencyEnum
{
    DAILY,
    WEEKLY,
    MONTHLY,
}

// Maintenance: jenis kerusakan yang dilaporkan, dipakai untuk filter di halaman Transaction.
public enum KategoriKerusakanEnum
{
    AC,
    LISTRIK,
    AIR,
    FURNITUR,
    GEDUNG,
    IT,
    LAINNYA,
}

public enum UrgensiEnum
{
    RENDAH,
    SEDANG,
    TINGGI,
}

// Maintenance: tahap eksekusi fisik setelah laporan disetujui final (APPROVED_GA_APPROVAL) -
// Admin GA/Approval GA menandai progresnya berurutan (lihat PerbaikanSaranaController.CekLokasi/
// UploadGambar/Eksekusi), dicatat di PerbaikanSaranaLogs supaya riwayatnya terlihat jelas.
public enum ExecutionStageEnum
{
    MENUNGGU,
    LOKASI_DICEK,
    GAMBAR_DIBUAT,
    SELESAI,
}

// Archive: kategori bebas untuk dokumen umum perusahaan, dipakai sebagai "folder" saat filter.
public enum ArchiveKategoriEnum
{
    SOP,
    SURAT,
    KONTRAK,
    LAPORAN,
    PANDUAN,
    LAINNYA,
}
