import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notfound-page">
      <div className="notfound-content">
        <span className="notfound-code">404</span>
        <h1 className="notfound-title">Halaman Tidak Ditemukan</h1>
        <p className="notfound-message">
          Ups! Halaman yang Anda cari sepertinya tersesat di antara awan.
        </p>
        <Link href="/" className="btn btn-primary notfound-home-btn">
          Kembali ke Beranda
        </Link>
      </div>

      <svg
        className="notfound-clouds"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        role="img"
        aria-label="Ilustrasi awan"
      >
        <path
          fill="var(--blue-600)"
          opacity="0.25"
          d="M0,160 C240,220 480,100 720,150 C960,200 1200,110 1440,150 L1440,320 L0,320 Z"
        />
        <path
          fill="var(--blue-500)"
          opacity="0.4"
          d="M0,200 C240,140 480,240 720,190 C960,140 1200,230 1440,190 L1440,320 L0,320 Z"
        />
        <path
          fill="var(--blue-400)"
          opacity="0.9"
          d="M0,235 C240,195 480,265 720,225 C960,185 1200,255 1440,225 L1440,320 L0,320 Z"
        />
      </svg>
    </div>
  );
}
