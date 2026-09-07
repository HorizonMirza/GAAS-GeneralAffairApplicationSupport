"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL, BOOKING_STATUS_LABEL, isBookingOriginRole } from "@/lib/constants";
import type { ArchiveKategori, BookingStatus, PermintaanArsipReportResponse } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";

const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));

export default function ArsipLaporanPage() {
  const { me, loading } = useAuth();
  const router = useRouter();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [report, setReport] = useState<PermintaanArsipReportResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.getArsipReport(year);
      setReport(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  const showDivisiBreakdown = isBookingOriginRole(me.role) && (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA");

  const kategoriRows = report
    ? (Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[])
        .map((k) => ({ kategori: k, jumlah: report.jumlahByKategori[k] ?? 0 }))
        .filter((r) => r.jumlah > 0)
        .sort((a, b) => b.jumlah - a.jumlah)
    : [];

  const statusRows = report
    ? (Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[])
        .map((s) => ({ status: s, jumlah: report.countByStatus[s] ?? 0 }))
        .filter((r) => r.jumlah > 0 && r.status !== "CANCELLED")
    : [];

  const divisiRows = report
    ? Object.entries(report.countByDivisi).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Laporan Arsip</h2>
        <div className="field" style={{ marginBottom: 0, width: 160 }}>
          <SearchableSelect
            id="laporan-arsip-year"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={YEAR_OPTIONS}
            placeholder={String(year)}
          />
        </div>
      </div>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : error ? (
        <div className="card table-empty">{error}</div>
      ) : report ? (
        <>
          <div className="stat-grid">
            <div className="stat-tile"><div className="value">{report.totalPermintaan}</div><div className="label">Total Permintaan</div></div>
            <div className="stat-tile"><div className="value">{report.totalArsipDipindahkan}</div><div className="label">Unit Arsip Dipindahkan (Approved)</div></div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Status Permintaan - Tahun {report.year}</h3>
            {statusRows.length === 0 ? (
              <p className="text-secondary">Belum ada permintaan pada tahun ini.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Status</th><th>Jumlah</th></tr></thead>
                  <tbody>
                    {statusRows.map((r) => (
                      <tr key={r.status}><td>{BOOKING_STATUS_LABEL[r.status]}</td><td>{r.jumlah}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Arsip Dipindahkan per Kategori (Approved)</h3>
            {kategoriRows.length === 0 ? (
              <p className="text-secondary">Belum ada arsip yang resmi dipindahkan pada tahun ini.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Kategori</th><th>Jumlah Unit</th></tr></thead>
                  <tbody>
                    {kategoriRows.map((r) => (
                      <tr key={r.kategori}><td>{ARCHIVE_KATEGORI_LABEL[r.kategori]}</td><td>{r.jumlah}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showDivisiBreakdown && (
            <div className="card" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>Permintaan per Divisi</h3>
              {divisiRows.length === 0 ? (
                <p className="text-secondary">Belum ada permintaan pada tahun ini.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Divisi</th><th>Jumlah Permintaan</th></tr></thead>
                    <tbody>
                      {divisiRows.map(([divisi, jumlah]) => (
                        <tr key={divisi}><td>{divisi}</td><td>{jumlah}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Tren Bulanan - Tahun {report.year}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Bulan</th><th>Jumlah Permintaan</th></tr></thead>
                <tbody>
                  {MONTH_LABELS.map((label, idx) => (
                    <tr key={label}><td>{label}</td><td>{report.countByMonth[idx] ?? 0}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
