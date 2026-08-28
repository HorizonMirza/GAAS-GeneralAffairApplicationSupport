"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ON_APPROVAL_STATUSES, REJECTED_STATUSES, cardStatusBorderClass, isEditableByOrigin } from "@/lib/constants";
import { currentYearMonth, formatCurrency, formatDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { CostTrendResponse, Pengiriman } from "@/lib/types";

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import StatusBadge from "@/components/StatusBadge";
import Stepper from "@/components/Stepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import ChatModal from "@/components/ChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface Stats {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  waitingKpu: number;
  completed: number;
}

export default function OverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<Pengiriman[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [costTrend, setCostTrend] = useState<CostTrendResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<Pengiriman | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string; createdByRole: string } | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role)
    : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    if (!me) return;
    setBusy(true);
    try {
      const bulan = currentYearMonth();
      // The queue shows latest-and-upcoming data, not just this month - so it uses sejakBulan
      // (from the 1st of this month onward, no upper bound) instead of the exact-match bulan
      // filter, keeping next month's items visible while still hiding past months. Stats stay
      // scoped to bulan (this month only) since those tiles report the current month's workload.
      const [queue, statsResp] = await Promise.all([
        api.listPengiriman({ limit: 10, page: 1, sejakBulan: bulan }).then((r) => r.items),
        api.getPengirimanStats(bulan),
      ]);
      const counts = statsResp.countsByStatus;
      setItems(queue);
      setStats({
        // Read directly from the backend's own actionability computation (GetStats) instead of
        // re-deriving "which statuses count for this stage" here - that re-derivation is exactly
        // what drifted out of sync with RejectTarget-gated statuses before (see
        // PengirimanController.IsGaActionable).
        waitingL1: statsResp.waitingL1,
        waitingGa: statsResp.waitingGa,
        waitingGaApproval: statsResp.waitingGaApproval,
        waitingKpu: statsResp.waitingKpu,
        completed: counts.COMPLETED ?? 0,
      });
    } finally {
      setBusy(false);
    }
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Some roles can't see cost totals at all (see PengirimanController.TotalVisibleRoles) - the
    // endpoint 403s for them, so this section just doesn't render rather than showing an error.
    api.getCostTrend(6).then(setCostTrend).catch(() => setCostTrend(null));
  }, []);

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "DRAFT") return items.filter((i) => i.status === "DRAFT");
    if (statusFilter === "APPROVED") return items.filter((i) => i.status === "COMPLETED");
    if (statusFilter === "ON_APPROVAL") return items.filter((i) => ON_APPROVAL_STATUSES.includes(i.status));
    return items.filter((i) => REJECTED_STATUSES.includes(i.status));
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  const waitingL1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? "Approval Departemen"
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? "Approval Divisi"
      : "Approval Departemen/Divisi";

  function handleDelete(item: Pengiriman) {
    confirm("Hapus data pengiriman ini secara permanen?", async () => {
      try {
        await api.deletePengiriman(item.id);
        showToast("Data berhasil dihapus");
        load();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <WelcomeGreeting me={me} />
        {isOrigin && (
          <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
            + Input Data Barang
          </button>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile"><div className="value">{stats.waitingL1}</div><div className="label">{waitingL1Label}</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGa}</div><div className="label">Admin General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingKpu}</div><div className="label">KPU</div></div>
          <div className="stat-tile"><div className="value">{stats.completed}</div><div className="label">Approved</div></div>
        </div>
      )}

      {costTrend && costTrend.monthly.some((m) => m.total > 0) && (
        <div className="card" style={{ marginTop: 20 }}>
          <h4 style={{ margin: "0 0 14px" }}>Tren Biaya 6 Bulan Terakhir</h4>
          {(() => {
            const maxMonthly = Math.max(1, ...costTrend.monthly.map((m) => m.total));
            return (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130, marginBottom: 20 }}>
                {costTrend.monthly.map((m) => (
                  <div key={m.bulan} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
                    <span className="text-secondary" style={{ fontSize: "0.62rem", marginBottom: 3 }}>
                      {m.total > 0 ? formatCurrency(m.total) : ""}
                    </span>
                    <div
                      title={`${m.bulan}: ${formatCurrency(m.total)}`}
                      style={{
                        width: "100%",
                        minHeight: 2,
                        height: `${(m.total / maxMonthly) * 90}px`,
                        background: m.total === 0 ? "var(--border-subtle)" : "var(--gradient-primary)",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <span className="text-secondary" style={{ fontSize: "0.68rem", marginTop: 6 }}>
                      {new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(`${m.bulan}-01T00:00:00`))}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {costTrend.byDivisi.length > 0 && (
            <>
              <h4 style={{ margin: "0 0 10px" }}>Per Divisi (6 Bulan Terakhir)</h4>
              {(() => {
                const maxDivisi = Math.max(1, ...costTrend.byDivisi.map((d) => d.total));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {costTrend.byDivisi.map((d) => (
                      <div key={d.divisi} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem" }}>
                        <span style={{ width: 180, flexShrink: 0 }}>{d.divisi}</span>
                        <div style={{ flex: 1, background: "var(--border-subtle)", borderRadius: 999, height: 8, overflow: "hidden" }}>
                          <div style={{ width: `${(d.total / maxDivisi) * 100}%`, height: "100%", background: "var(--gradient-primary)" }} />
                        </div>
                        <span className="text-secondary" style={{ width: 120, textAlign: "right", flexShrink: 0 }}>{formatCurrency(d.total)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Transaksi Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: "auto" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ON_APPROVAL">On-Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : filteredItems.length === 0 ? (
        <div className="card table-empty">Tidak ada data.</div>
      ) : (
        filteredItems.map((item) => {
          const borderClass = cardStatusBorderClass(item.status);
          return (
            <div className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`} style={{ marginBottom: 14 }} key={item.id}>
              <div className="card-header">
                <div className="card-header-title">
                  <strong>{item.tujuanPenerimaan} - {item.nomorTransmittal}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                  <button
                    type="button"
                    className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                    aria-label="Chat"
                    onClick={() => setChatItem(item)}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    {item.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <Stepper status={item.status} departemen={item.departemen} rejectTarget={item.rejectTarget} createdByRole={item.createdByRole} />
              {item.rejectReason && (
                <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                  <strong>Catatan Penolakan:</strong> {item.rejectReason}
                </div>
              )}
            </div>
          );
        })
      )}

      <RowMenuDropdown
        position={rowMenu.position}
        canEditDelete={!!rowMenu.menuItem && isOrigin && isEditableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "edit" });
        }}
        onStatus={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setStatusItemId(item.id);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
      />

      {me && (
        <PengirimanFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={load} />
      )}

      {me && (
        <PengirimanDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={load}
          onRequestReject={(id, type, originLabel, createdByRole) => setRejectTarget({ id, type, originLabel, createdByRole })}
        />
      )}

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        createdByRole={rejectTarget?.createdByRole ?? null}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          load();
        }}
      />

      <StatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <ChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.tujuanPenerimaan} - ${chatItem.nomorTransmittal}` : ""}
          departemen={chatItem?.departemen ?? null}
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={load}
        />
      )}
    </>
  );
}
