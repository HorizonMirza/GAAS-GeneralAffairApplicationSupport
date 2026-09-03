import Link from "next/link";
import { Calendar, Car, Layers, PanelsLeftRight } from "lucide-react";

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
];

interface ModuleGuide {
  key: string;
  title: string;
  href: string;
  description: string;
  icon: React.ReactNode;
}

const MODULE_GUIDES: ModuleGuide[] = [
  {
    key: "ekspedisi",
    title: "Expedition",
    href: "/ekspedisi/overview",
    description: "Kirim & lacak pengiriman barang kantor, lengkap invoice.",
    icon: <Layers width={18} height={18} />,
  },
  {
    key: "bookingruangmeeting",
    title: "Room Booking",
    href: "/booking-ruang-meeting/overview",
    description: "Pesan ruang rapat, cek ketersediaan lewat kalender.",
    icon: <Calendar width={18} height={18} />,
  },
  {
    key: "bookingkendaraan",
    title: "Vehicle Booking",
    href: "/booking-kendaraan/overview",
    description: "Ajukan & jadwalkan pemakaian kendaraan dinas.",
    icon: <Car width={18} height={18} />,
  },
  {
    key: "rumahtangga",
    title: "Office Supplies",
    href: "/office-supplies/overview",
    description: "Ajukan permintaan alat tulis & keperluan kantor.",
    icon: <PanelsLeftRight width={18} height={18} />,
  },
  {
    key: "perbaikansarana",
    title: "Maintenance",
    href: "/maintenance/overview",
    description: "Laporkan & pantau perbaikan sarana/fasilitas.",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"></path></svg>,
  },
  {
    key: "arsip",
    title: "Archive",
    href: "/arsip/overview",
    description: "Unggah & kelola dokumen arsip perusahaan.",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>,
  },
];

export default function BantuanPage() {
  return (
    <>
      <div className="bantuan-intro">
        <p>Kumpulan pertanyaan yang sering ditanyakan dan panduan singkat tiap modul. Kalau jawabannya belum ketemu di sini, hubungi PIC lewat Contact Person.</p>
      </div>

      <div className="bantuan-section">
        <h3 className="bantuan-section-label">Pertanyaan Umum</h3>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                {item.question}
                <svg className="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="bantuan-section">
        <h3 className="bantuan-section-label">Panduan Modul</h3>
        <div className="bantuan-module-grid">
          {MODULE_GUIDES.map((mod) => (
            <Link key={mod.key} className="bantuan-module-card" href={mod.href}>
              <div className="bantuan-module-card-icon">{mod.icon}</div>
              <div>
                <h4>{mod.title}</h4>
                <p>{mod.description}</p>
              </div>
            </Link>
          ))}
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
