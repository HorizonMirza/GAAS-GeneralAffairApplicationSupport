"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cardStatusBorderClass, greetingName, isEditableByOrigin } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { Pengiriman } from "@/lib/types";
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
  const [busy, setBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<Pengiriman | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role)
    : false;

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
          const borderClass = cardStatusBorderClass(item.status);
          return (
            <div className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`} style={{ marginBottom: 14 }} key={item.id}>
              <div className="card-header">
                <div>
                  <strong>{item.tujuanPenerimaan} - {item.nomorTransmittal}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi} · {item.kodeProgram} · {item.jumlahItem} item
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                  <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <Stepper status={item.status} departemen={item.departemen} rejectTarget={item.rejectTarget} createdByRole={item.createdByRole} />
              <button
                type="button"
                className={`card-chat-btn${item.hasUnreadChat ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                onClick={() => setChatItem(item)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                Chat
              </button>
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
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
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
          me={me}
          onClose={() => setChatItem(null)}
          onRead={load}
        />
      )}
    </>
  );
}
