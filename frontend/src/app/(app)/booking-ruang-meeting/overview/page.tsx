"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { bookingStatusBorderClass, greetingName, isBookingEditableByOrigin } from "@/lib/constants";
import { formatDate, formatTimeRange } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingRuang } from "@/lib/types";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RoomBookingStepper from "@/components/RoomBookingStepper";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface Stats {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  confirmed: number;
}

export default function BookingOverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<BookingRuang[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
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
      const [queue, submitted, rejectedGa, approvedL1, rejectedGaApproval, approvedGa, approvedGaApproval] =
        await Promise.all([
          api.listBooking({ limit: 10, page: 1 }).then((r) => r.items),
          api.listBooking({ limit: 5, page: 1, status: "SUBMITTED" }),
          api.listBooking({ limit: 5, page: 1, status: "REJECTED_GA" }),
          api.listBooking({ limit: 5, page: 1, status: "APPROVED_L1" }),
          api.listBooking({ limit: 5, page: 1, status: "REJECTED_GA_APPROVAL" }),
          api.listBooking({ limit: 5, page: 1, status: "APPROVED_GA" }),
          api.listBooking({ limit: 5, page: 1, status: "APPROVED_GA_APPROVAL" }),
        ]);
      setItems(queue);
      setStats({
        waitingL1: submitted.total + rejectedGa.total,
        waitingGa: approvedL1.total + rejectedGaApproval.total,
        waitingGaApproval: approvedGa.total,
        confirmed: approvedGaApproval.total,
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

  function handleDelete(item: BookingRuang) {
    confirm("Hapus booking ini?", async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
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
            + Booking Ruang Meeting
          </button>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile"><div className="value">{stats.waitingL1}</div><div className="label">{waitingL1Label}</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGa}</div><div className="label">Menunggu Approve Admin GA</div></div>
          <div className="stat-tile"><div className="value">{stats.waitingGaApproval}</div><div className="label">Menunggu Approve Approval GA</div></div>
          <div className="stat-tile"><div className="value">{stats.confirmed}</div><div className="label">Terkonfirmasi</div></div>
        </div>
      )}

      <h3 style={{ margin: "24px 0 12px" }}>Booking Terbaru Saya</h3>

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : items.length === 0 ? (
        <div className="card table-empty">Tidak ada data.</div>
      ) : (
        items.map((item) => {
          const borderClass = bookingStatusBorderClass(item.status);
          return (
            <div className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`} style={{ marginBottom: 14 }} key={item.id}>
              <div className="card-header">
                <div>
                  <strong>{item.namaKegiatan} - {item.namaRuang}</strong>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    {formatDate(item.tanggal)} · {formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)} · {item.departemen || item.divisi} · {item.jumlahPeserta} peserta
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
              <RoomBookingStepper status={item.status} departemen={item.departemen} rejectTarget={item.rejectTarget} createdByRole={item.createdByRole} />
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
        canEditDelete={!!rowMenu.menuItem && isOrigin && isBookingEditableByOrigin(rowMenu.menuItem, me)}
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
        <RoomBookingFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={load} />
      )}

      {me && (
        <RoomBookingDetailModal
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

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />
    </>
  );
}
