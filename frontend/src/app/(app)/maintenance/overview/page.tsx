"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  KATEGORI_KERUSAKAN_LABEL,
  URGENSI_BADGE_CLASS,
  URGENSI_LABEL,
  isBookingOriginRole,
  isSaranaDeletableByOrigin,
  isSaranaEditableByOrigin,
} from "@/lib/constants";
import { currentYearMonth, formatDate, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingStatus, PerbaikanSarana } from "@/lib/types";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import SaranaFormModal from "@/components/SaranaFormModal";
import SaranaDetailModal from "@/components/SaranaDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import SaranaStatusHistoryModal from "@/components/SaranaStatusHistoryModal";
import SaranaChatModal from "@/components/SaranaChatModal";
import SearchableSelect from "@/components/SearchableSelect";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

type StatusFilter = "ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED";

interface Stats {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  approved: number;
  urgensiTinggiAktif: number;
}

export default function MaintenanceOverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<PerbaikanSarana[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: PerbaikanSarana; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<PerbaikanSarana | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(items);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    if (!me) return;
    setBusy(true);
    try {
      const bulan = currentYearMonth();
      // Not capped to a small page size - shows every report for the current bulan, which resets
      // the list on its own once the month rolls over.
      const [queue, statsResp] = await Promise.all([
        api.listSarana({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.getSaranaStats(bulan),
      ]);
      const counts = statsResp.countsByStatus;
      const count = (status: BookingStatus) => counts[status] ?? 0;
      setItems(queue);
      setStats({
        waitingL1: count("SUBMITTED"),
        waitingGa: count("APPROVED_L1"),
        waitingGaApproval: count("APPROVED_GA"),
        approved: count("APPROVED_GA_APPROVAL"),
        urgensiTinggiAktif: statsResp.urgensiTinggiAktif,
      });
    } finally {
      setBusy(false);
    }
  }, [me]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "DRAFT") return items.filter((i) => i.status === "DRAFT");
    if (statusFilter === "APPROVED") return items.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (statusFilter === "ON_APPROVAL") return items.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return items.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  }, [items, statusFilter]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  const waitingL1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? "Approval Departemen"
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? "Approval Divisi"
      : "Approval Departemen/Divisi";

  function handleDelete(item: PerbaikanSarana) {
    confirm("Hapus laporan perbaikan ini secara permanen?", async () => {
      try {
        await api.deleteSarana(item.id);
        showToast("Laporan berhasil dihapus");
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
            + Laporan Perbaikan
          </button>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile"><div className="value">{stats.waitingL1}</div><div className="label">{waitingL1Label}</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGa}</div><div className="label">Admin General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.approved}</div><div className="label">Approved</div></div>
          <div className="stat-tile"><div className="value">{stats.urgensiTinggiAktif}</div><div className="label">Urgensi Tinggi Berjalan</div></div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Laporan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: "auto" }}>
          <SearchableSelect
            id="overview-sarana-status-filter"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
            getLabel={(v) => ({
              ALL: "Semua Status",
              DRAFT: "Draft",
              ON_APPROVAL: "On-Approval",
              APPROVED: "Approved",
              REJECTED: "Rejected",
            } as Record<string, string>)[v] || v}
            placeholder="Semua Status"
          />
        </div>
      </div>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : filteredItems.length === 0 ? (
        <div className="card table-empty">Tidak ada data.</div>
      ) : (
        filteredItems.map((item) => {
          const isDraft = item.status === "DRAFT";
          return (
            <div
              className="card item-row-card"
              style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
              onClick={isDraft ? () => setDetail({ item, mode: "view" }) : undefined}
              key={item.id}
            >
              <div className="card-header">
                <div className="card-header-title">
                  <strong>{item.lokasi} - {item.nomorPerbaikan || "-"}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {item.departemen || item.divisi} · {KATEGORI_KERUSAKAN_LABEL[item.kategori]} · {truncateText(item.deskripsiKerusakan, 50)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${URGENSI_BADGE_CLASS[item.urgensi]}`}>{URGENSI_LABEL[item.urgensi]}</span>
                  <BookingStatusBadge status={item.status} departemen={item.departemen} />
                  <button
                    type="button"
                    className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                    aria-label="Chat"
                    onClick={(e) => { e.stopPropagation(); setChatItem(item); }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    {item.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); rowMenu.toggle(e, item.id, 180); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <RoomBookingStepper status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
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
        canEditDelete={!!rowMenu.menuItem && isOrigin && isSaranaEditableByOrigin(rowMenu.menuItem, me)}
        canDelete={!!rowMenu.menuItem && isOrigin && isSaranaDeletableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item && isOrigin && isSaranaEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
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
        <SaranaFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={load} />
      )}

      {me && (
        <SaranaDetailModal
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

      <SaranaStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <SaranaChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.lokasi} - ${chatItem.nomorPerbaikan || "-"}` : ""}
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
