"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { RoomUtilizationItem } from "@/lib/types";

const REPORT_ROLES = new Set(["ADMIN_GA", "APPROVAL_GA", "SUPER_ADMIN"]);

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toIso(d);
}

function defaultDateTo(): string {
  return toIso(new Date());
}

function formatPercent(rate: number | null): string {
  return rate == null ? "-" : `${Math.round(rate * 100)}%`;
}

export default function LaporanUtilisasiPage() {
  const { me, loading } = useAuth();
  const router = useRouter();

  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());
  const [rooms, setRooms] = useState<RoomUtilizationItem[] | null>(null);
  const [busyHours, setBusyHours] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && me && !REPORT_ROLES.has(me.role)) router.replace("/dashboard");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me || !REPORT_ROLES.has(me.role)) return;
    setBusy(true);
    setError(null);
    api.getRoomUtilization(dateFrom, dateTo)
      .then((res) => {
        setRooms(res.rooms);
        setBusyHours(res.busyHours);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
  }, [me, dateFrom, dateTo]);

  if (!me || !REPORT_ROLES.has(me.role)) return null;

  const maxBookedHours = Math.max(1, ...(rooms ?? []).map((r) => r.bookedHours));
  const hourEntries = Array.from({ length: 11 }, (_, i) => 7 + i).map((h) => ({
    hour: h,
    count: busyHours[String(h)] ?? 0,
  }));
  const maxBusyCount = Math.max(1, ...hourEntries.map((h) => h.count));

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <h3 className="welcome-heading">Laporan Utilisasi Ruangan</h3>
      </div>

      <div className="filter-dropdown-panel" style={{ position: "static", display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="laporan-dari">Dari Tanggal</label>
          <input type="date" id="laporan-dari" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="laporan-sampai">Sampai Tanggal</label>
          <input type="date" id="laporan-sampai" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-secondary" style={{ color: "var(--badge-rejected-fg)" }}>{error}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: "0 0 14px" }}>Jam Sibuk (Approved, semua ruangan)</h4>
        {busy ? (
          <p className="text-secondary">Memuat...</p>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
            {hourEntries.map(({ hour, count }) => (
              <div key={hour} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
                <div
                  title={`${String(hour).padStart(2, "0")}:00 - ${count} booking`}
                  style={{
                    width: "100%",
                    minHeight: 2,
                    height: `${(count / maxBusyCount) * 88}px`,
                    background: count === 0 ? "var(--border-subtle)" : "var(--gradient-primary)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginTop: 4 }}>{hour}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h4 style={{ margin: "0 0 14px" }}>Per Ruangan</h4>
        {busy ? (
          <p className="text-secondary">Memuat...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ruangan</th>
                  <th>Jam Terpakai</th>
                  <th style={{ width: "30%" }}></th>
                  <th>Approved</th>
                  <th>Rejected</th>
                  <th>Tingkat Penolakan</th>
                </tr>
              </thead>
              <tbody>
                {(rooms ?? []).map((r) => (
                  <tr key={r.namaRuang}>
                    <td>{r.namaRuang}</td>
                    <td>{r.bookedHours} jam</td>
                    <td>
                      <div style={{ background: "var(--border-subtle)", borderRadius: 999, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(r.bookedHours / maxBookedHours) * 100}%`, height: "100%", background: "var(--gradient-primary)" }} />
                      </div>
                    </td>
                    <td>{r.approvedCount}</td>
                    <td>{r.rejectedCount}</td>
                    <td>{formatPercent(r.rejectionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
