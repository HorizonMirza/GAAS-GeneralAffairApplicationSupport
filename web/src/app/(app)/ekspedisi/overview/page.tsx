"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { effectiveStatus, greetingName, isEditableByOrigin } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { Pengiriman } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Stepper from "@/components/Stepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
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
  const [busy, setBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType } | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me?.role === "ADMIN_DEPARTEMEN" || me?.role === "ADMIN_DIVISI";

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    if (!me) return;
    setBusy(true);
    try {
      const [queue, submitted, rejectedGa, approvedL1, rejectedGaApproval, approvedGa, rejectedKpu, approvedGaApproval, completed] =
        await Promise.all([
          api.listPengiriman({ limit: 10, page: 1 }).then((r) => r.items),
          api.listPengiriman({ limit: 5, page: 1, status: "SUBMITTED" }),
          api.listPengiriman({ limit: 5, page: 1, status: "REJECTED_GA" }),
          api.listPengiriman({ limit: 5, page: 1, status: "APPROVED_L1" }),
          api.listPengiriman({ limit: 5, page: 1, status: "REJECTED_GA_APPROVAL" }),
          api.listPengiriman({ limit: 5, page: 1, status: "APPROVED_GA" }),
          api.listPengiriman({ limit: 5, page: 1, status: "REJECTED_KPU" }),
          api.listPengiriman({ limit: 5, page: 1, status: "APPROVED_GA_APPROVAL" }),
          api.listPengiriman({ limit: 5, page: 1, status: "COMPLETED" }),
        ]);
      setItems(queue);
      setStats({
        waitingL1: submitted.total + rejectedGa.total,
        waitingGa: approvedL1.total + rejectedGaApproval.total,
        waitingGaApproval: approvedGa.total + rejectedKpu.total,
        waitingKpu: approvedGaApproval.total,
        completed: completed.total,
      });
    } finally {
      setBusy(false);
    }
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  const waitingL1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? "Menunggu Approve Departemen"
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? "Menunggu Approve Divisi"
      : "Menunggu Approve Departemen/Divisi";

  function handleDelete(item: Pengiriman) {
    confirm("Yakin ingin menghapus data pengiriman ini?", async () => {
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
        <h3 className="welcome-heading">Halo, <span className="welcome-name">{greetingName(me)}</span></h3>
        {isOrigin && (
          <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
            + Input Data Barang
          </button>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile"><div className="value">{stats.waitingL1}</div><div className="label">{waitingL1Label}</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGa}</div><div className="label">Menunggu Approve Admin GA</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGaApproval}</div><div className="label">Menunggu Approve Approval GA</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingKpu}</div><div className="label">Menunggu Approve KPU</div></div>
          <div className="stat-tile"><div className="value">{stats.completed}</div><div className="label">Approved</div></div>
        </div>
      )}

      <h3 style={{ margin: "24px 0 12px" }}>Dokumen Terbaru Saya</h3>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : items.length === 0 ? (
        <div className="card table-empty">Tidak ada data.</div>
      ) : (
        items.map((item) => {
          const status = effectiveStatus(item);
          return (
            <div className="card item-row-card" style={{ marginBottom: 14 }} key={item.id}>
              <div className="card-header">
                <div>
                  <strong>{item.tujuanPenerimaan}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi} · {item.jumlahItem} item
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge status={status} rejectTarget={item.rejectTarget} departemen={item.departemen} />
                  <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <Stepper status={status} departemen={item.departemen} />
              {item.rejectReason && (
                <div className="text-secondary item-row-reject-note" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                  <strong>Alasan ditolak:</strong> {item.rejectReason}
                </div>
              )}
              <div className="item-row-footer" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                  Penerima: {item.namaPenerima} · {item.noTeleponPenerima}
                  {item.total ? ` · Total: ${formatCurrency(item.total)}` : ""}
                </div>
              </div>
            </div>
          );
        })
      )}

      <RowMenuDropdown
        position={rowMenu.position}
        canEditDelete={!!rowMenu.menuItem && isOrigin && isEditableByOrigin(rowMenu.menuItem)}
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
          onRequestReject={(id, type) => setRejectTarget({ id, type })}
        />
      )}

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          load();
        }}
      />

      <StatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />
    </>
  );
}
