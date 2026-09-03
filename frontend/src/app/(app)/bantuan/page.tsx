"use client";

import Link from "next/link";
import { useState } from "react";

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Bagaimana cara mengajukan pengiriman, booking, atau permintaan baru?",
    answer:
      "Buka modul yang sesuai dari sidebar (Expedition, Room Booking, Vehicle Booking, Office Supplies, Maintenance, atau Archive), lalu masuk ke halaman Overview atau Transaction dan klik tombol \"+ Tambah\". Isi form sampai lengkap. Data bisa disimpan dulu sebagai Draft kalau belum yakin, atau langsung klik Ajukan untuk masuk ke antrean approval.",
  },
  {
    question: "Bagaimana alur dan tingkatan approval untuk setiap pengajuan?",
    answer:
      "Setiap pengajuan yang sudah diajukan (bukan Draft) berjalan berurutan lewat beberapa tingkat: Approval Departemen/Divisi (atasan langsung pemohon), lalu Admin General Affair, lalu Approval GA. Untuk modul yang melibatkan vendor seperti Expedition dan Office Supplies, ada tahap tambahan persetujuan Mitra setelah Approval GA sebelum pengajuan resmi selesai. Kalau salah satu tingkat menolak, pengajuan langsung berhenti berstatus Rejected di tingkat itu dan tidak lanjut ke tingkat berikutnya.",
  },
  {
    question: "Apa arti setiap status pengajuan yang saya lihat?",
    answer:
      "Draft berarti data belum diajukan dan masih bebas diedit atau dihapus. On-Approval (dengan keterangan tingkat yang sedang memproses, misalnya \"On-Approval: Admin General Affair\") berarti sedang menunggu persetujuan di tingkat tersebut. Rejected berarti ditolak pada tingkat yang tertulis di statusnya dan pengajuan itu dianggap selesai/gagal. Approved berarti pengajuan sudah lolos semua tingkat approval dan resmi disetujui.",
  },
  {
    question: "Di mana saya bisa melihat riwayat pengajuan saya?",
    answer:
      "Masuk ke halaman Transaction pada modul terkait, lalu gunakan filter status atau tanggal untuk mencari pengajuan lama. Klik salah satu baris untuk membuka detail lengkapnya, termasuk riwayat approval dan siapa saja yang sudah memprosesnya.",
  },
  {
    question: "Saya salah isi data, apakah bisa diedit atau dibatalkan?",
    answer:
      "Selama masih berstatus Draft, data bisa diedit atau dihapus bebas tanpa perlu izin siapa pun. Setelah diajukan dan berstatus On-Approval, Anda tidak bisa mengedit langsung. Hubungi approver terkait lewat fitur chat pada detail pengajuan untuk minta dibatalkan atau ditolak dulu, baru ajukan ulang dengan data yang benar.",
  },
  {
    question: "Bagaimana cara mengganti username, email, nomor telepon, atau password akun saya?",
    answer:
      "Buka halaman Profile dari menu akun di pojok kanan atas, lalu pada baris Username, Phone Number, Email, atau Password klik tombol \"Change\". Untuk mengganti username, email, atau nomor telepon, Anda perlu memasukkan password saat ini sebagai konfirmasi sebelum perubahannya disimpan.",
  },
  {
    question: "Bagaimana cara berkomunikasi dengan approver terkait pengajuan saya?",
    answer:
      "Buka detail pengajuan yang ingin didiskusikan, lalu klik ikon chat di dalamnya. Semua pihak yang terlibat di alur approval pengajuan tersebut (Admin/Approval Departemen atau Divisi, Admin General Affair, Approval GA, dan Mitra kalau ada) bisa membaca dan membalas di percakapan yang sama, jadi tidak perlu koordinasi terpisah lewat WhatsApp atau email untuk hal-hal teknis pengajuan.",
  },
  {
    question: "Apa saja modul yang tersedia di aplikasi ini dan fungsinya masing-masing?",
    answer:
      "Ada 6 modul utama: Expedition untuk mengirim & melacak pengiriman barang kantor lengkap invoice, Room Booking untuk memesan ruang rapat dan mengecek ketersediaannya lewat kalender, Vehicle Booking untuk mengajukan & menjadwalkan pemakaian kendaraan dinas, Office Supplies untuk mengajukan permintaan alat tulis & keperluan kantor, Maintenance untuk melaporkan & memantau perbaikan sarana/fasilitas, dan Archive untuk mengunggah & mengelola dokumen arsip perusahaan.",
  },
  {
    question: "Bagaimana cara memesan ruang rapat atau kendaraan dan mengecek ketersediaannya?",
    answer:
      "Buka modul Room Booking atau Vehicle Booking, lalu masuk ke halaman Calendar untuk melihat jadwal yang sudah terisi sebelum mengajukan. Saat mengisi form pengajuan, sistem otomatis menandai kalau jadwal yang dipilih bentrok dengan pengajuan lain yang masih diproses, jadi tidak perlu cek manual satu per satu.",
  },
  {
    question: "Ada kendala teknis atau butuh bantuan lain, harus hubungi siapa?",
    answer: "Buka halaman Contact Person untuk daftar PIC tiap modul, lengkap dengan nomor WhatsApp dan email yang bisa langsung dihubungi.",
  },
];

export default function BantuanPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <div className="bantuan-section">
        <div className="bantuan-faq-header">
          <p className="bantuan-faq-eyebrow">FAQ</p>
          <h2 className="bantuan-faq-title">Pertanyaan Yang Sering Diajukan</h2>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, index) => {
            const open = openFaq === index;
            return (
              <div key={item.question} className={`faq-item${open ? " faq-item-open" : ""}`}>
                <button
                  type="button"
                  className="faq-item-trigger"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : index)}
                >
                  <span>{item.question}</span>
                  <svg className="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div className="faq-item-answer">
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bantuan-cta">
        <div>
          <h4>Belum ketemu jawabannya?</h4>
          <p>Hubungi PIC langsung lewat WhatsApp atau Email.</p>
        </div>
        <Link className="bantuan-cta-btn" href="/contact-person">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          Contact Person
        </Link>
      </div>
    </>
  );
}
