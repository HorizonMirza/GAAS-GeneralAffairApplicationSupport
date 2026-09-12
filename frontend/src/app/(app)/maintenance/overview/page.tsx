"use client";

import { MessageSquare } from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_ON_APPROVAL_STATUSES,
  BOOKING_REJECTED_STATUSES,
  EXECUTION_STAGE_LABEL,
  KATEGORI_KERUSAKAN_LABEL,
  bookingStatusBorderClass,
  canGaKoreksiSarana,
  isBookingOriginRole,
  isSaranaDeletableByOrigin,
  isSaranaEditableByOrigin,
  isSaranaPdfAvailable,
} from "@/lib/constants";
import { currentYear, currentYearMonth, formatDate, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingStatus, PerbaikanSarana } from "@/lib/types";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import SaranaFormModal from "@/components/SaranaFormModal";
import SaranaDetailModal from "@/components/SaranaDetailModal";
import SaranaKoreksiModal from "@/components/SaranaKoreksiModal";
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
  // Breakdown eksekusi fisik yang masih berjalan (di antara yang sudah Approved) - SELESAI tidak
  // disertakan karena sudah terwakili oleh tile "Approved" di atas.
  execMenunggu: number;
  execLokasiDicek: number;
  execGambarDibuat: number;
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
  const [koreksiTarget, setKoreksiTarget] = useState<PerbaikanSarana | null>(null);

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
      // The stat tiles use the wider current-year window instead (no count cap, just a yearly
      // reset) so they don't zero out every time the month rolls over like the list above.
      // A report's approval can land in one bulan but its physical execution (Cek Lokasi -> Buat
      // Gambar -> Selesai) can still be running weeks later once the month rolls over - without
      // this second fetch, such a report would silently vanish from this screen the moment the
      // calendar month changes even though GA still has work to do on it. Merged by id (a report
      // can legitimately appear in both queries) and re-sorted newest-first.
      const [queue, activeExecuting, statsResp] = await Promise.all([
        api.listSarana({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.listSarana({ limit: 1000, page: 1, status: "APPROVED_GA_APPROVAL" }).then((r) => r.items.filter((i) => i.executionStage !== "SELESAI")),
        api.getSaranaStats(currentYear()),
      ]);
      const merged = new Map<number, PerbaikanSarana>();
      for (const item of queue) merged.set(item.id, item);
      for (const item of activeExecuting) merged.set(item.id, item);
      const combined = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const counts = statsResp.countsByStatus;
      const count = (status: BookingStatus) => counts[status] ?? 0;
      const execCounts = statsResp.executionStageCounts;
      setItems(combined);
      setStats({
        waitingL1: count("SUBMITTED"),
        waitingGa: count("APPROVED_L1"),
        waitingGaApproval: count("APPROVED_GA"),
        approved: count("APPROVED_GA_APPROVAL"),
        execMenunggu: execCounts.MENUNGGU ?? 0,
        execLokasiDicek: execCounts.LOKASI_DICEK ?? 0,
        execGambarDibuat: execCounts.GAMBAR_DIBUAT ?? 0,
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
    confirm("Hapus pengajuan perbaikan ini secara permanen?", async () => {
      try {
        await api.deleteSarana(item.id);
        showToast("Pengajuan berhasil dihapus");
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
            + Ajukan Perbaikan
          </button>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile"><div className="value">{stats.waitingL1}</div><div className="label">{waitingL1Label}</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGa}</div><div className="label">Admin General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
          <div className="stat-tile"><div className="value">{stats.approved}</div><div className="label">Approved</div></div>
        </div>
      )}

      {stats && (stats.execMenunggu > 0 || stats.execLokasiDicek > 0 || stats.execGambarDibuat > 0) && (
        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
          <strong>Eksekusi Fisik Berjalan:</strong>{" "}
          {[
            stats.execMenunggu > 0 ? `${stats.execMenunggu} Menunggu Mulai` : null,
            stats.execLokasiDicek > 0 ? `${stats.execLokasiDicek} Lokasi Dicek` : null,
            stats.execGambarDibuat > 0 ? `${stats.execGambarDibuat} Gambar Dibuat` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Pengajuan Terbaru Saya</h3>
        <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
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
        <div className="card table-empty">Tidak Ada Data</div>
      ) : (
        filteredItems.map((item) => {
          const isDraft = item.status === "DRAFT";
          const borderClass = bookingStatusBorderClass(item.status);
          return (
            <div
              className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
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
                  <BookingStatusBadge status={item.status} departemen={item.departemen} />
                  {item.status === "APPROVED_GA_APPROVAL" && item.executionStage !== "MENUNGGU" && (
                    <span className="badge badge-pending">{EXECUTION_STAGE_LABEL[item.executionStage]}</span>
                  )}
                  <button
                    type="button"
                    className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                    aria-label="Chat"
                    onClick={(e) => { e.stopPropagation(); setChatItem(item); }}
                  >
                    <MessageSquare width="17" height="17" />
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
        canEditDelete={
          !!rowMenu.menuItem &&
          ((isOrigin && isSaranaEditableByOrigin(rowMenu.menuItem, me)) || canGaKoreksiSarana(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isSaranaDeletableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          if (isOrigin && isSaranaEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaKoreksiSarana(item, me)) setKoreksiTarget(item);
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
        pdfUrl={rowMenu.menuItem && isSaranaPdfAvailable(rowMenu.menuItem) ? api.saranaPdfUrl(rowMenu.menuItem.id) : undefined}
        onPdfClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.saranaPdfUrl(item.id), `Bukti-Pengajuan-Perbaikan-${item.nomorPerbaikan || item.id}.pdf`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
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

      <SaranaKoreksiModal
        open={!!koreksiTarget}
        item={koreksiTarget}
        onClose={() => setKoreksiTarget(null)}
        onSaved={load}
      />

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
