"use client";

import Link from "next/link";
import { useState } from "react";

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Bagaimana cara mengajukan pengiriman, booking, atau permintaan baru?",
    answer:
      "Buka modul terkait dari sidebar, masuk ke halaman Overview atau Transaction, lalu klik tombol \"+ Tambah\". Isi form sampai lengkap dan klik Ajukan.",
  },
  {
    question: "Kenapa status pengajuan saya masih \"Diajukan\" / \"Menunggu Approval\"?",
    answer:
      "Pengajuan sedang menunggu persetujuan atasan/approver terkait. Buka detail pengajuan untuk melihat riwayat approval dan siapa yang sedang memprosesnya.",
  },
  {
    question: "Di mana saya bisa melihat riwayat pengajuan saya?",
    answer: "Masuk ke halaman Transaction pada modul terkait, lalu gunakan filter status atau tanggal untuk mencari pengajuan lama.",
  },
  {
    question: "Saya salah isi data, apakah bisa diedit?",
    answer:
      "Selama masih berstatus Draft, data bisa diedit atau dihapus bebas. Setelah diajukan, hubungi approver terkait untuk pembatalan sebelum mengajukan ulang.",
  },
  {
    question: "Ada kendala teknis atau butuh bantuan lain, harus hubungi siapa?",
    answer: "Buka halaman Contact Person untuk daftar PIC tiap modul, lengkap dengan nomor WhatsApp dan email yang bisa langsung dihubungi.",
  },
  {
    question: "Apa itu modul Expedition?",
    answer: "Modul untuk mengirim & melacak pengiriman barang kantor, lengkap dengan invoice.",
  },
  {
    question: "Apa itu modul Room Booking?",
    answer: "Modul untuk memesan ruang rapat dan mengecek ketersediaannya lewat kalender.",
  },
  {
    question: "Apa itu modul Vehicle Booking?",
    answer: "Modul untuk mengajukan & menjadwalkan pemakaian kendaraan dinas.",
  },
  {
    question: "Apa itu modul Office Supplies?",
    answer: "Modul untuk mengajukan permintaan alat tulis & keperluan kantor.",
  },
  {
    question: "Apa itu modul Maintenance?",
    answer: "Modul untuk melaporkan & memantau perbaikan sarana/fasilitas.",
  },
  {
    question: "Apa itu modul Archive?",
    answer: "Modul untuk mengunggah & mengelola dokumen arsip perusahaan.",
  },
];

export default function BantuanPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
          <p>PIC tiap modul siap dihubungi langsung lewat WhatsApp atau email.</p>
        </div>
        <Link className="bantuan-cta-btn" href="/contact-person">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          Contact Person
        </Link>
      </div>
    </>
  );
}
