"use client";

import { MessageSquare } from "lucide-react";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  getExecutionStageLabelMap,
  getKategoriKerusakanLabelMap,
  getUrgensiLabelMap,
  URGENSI_BADGE_CLASS,
  isBookingOriginRole,
  isSaranaDeletableByOrigin,
  isSaranaEditableByOrigin,
} from "@/lib/constants";
import { formatDate, formatDateTime, truncateText } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-context";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { BookingStatus, KategoriKerusakan, PerbaikanSarana, Urgensi } from "@/lib/types";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import SaranaFormModal from "@/components/SaranaFormModal";
import SaranaDetailModal from "@/components/SaranaDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import SaranaStatusHistoryModal from "@/components/SaranaStatusHistoryModal";
import SaranaChatModal from "@/components/SaranaChatModal";
import SearchableSelect from "@/components/SearchableSelect";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface FilterState {
  page: number;
  limit: number;
  bulan: string;
  status: BookingStatus | "REJECTED" | "";
  kategori: KategoriKerusakan | "";
  urgensi: Urgensi | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  search: string;
}

function defaultFilters(): FilterState {
  return { page: 1, limit: 10, bulan: "", status: "", kategori: "", urgensi: "", divisi: "", departemen: "", direktorat: "", search: "" };
}

const KATEGORI_OPTIONS: KategoriKerusakan[] = ["AC", "LISTRIK", "AIR", "FURNITUR", "GEDUNG", "IT", "LAINNYA"];
const URGENSI_OPTIONS: Urgensi[] = ["RENDAH", "SEDANG", "TINGGI"];

function MaintenanceTransaksiPageInner() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { language, t } = useLanguage();

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<PerbaikanSarana[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: PerbaikanSarana; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<PerbaikanSarana | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(items);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const tableReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  // An activity notification banner's click lands here with ?chat=<itemId> - fetched directly
  // (not found-in-loaded-items, since the item may not be on whatever page/filter is currently
  // shown) so the thread opens regardless of pagination. The param is stripped right after so a
  // later refresh of this same URL doesn't keep reopening it.
  useEffect(() => {
    const chatId = searchParams.get("chat");
    if (!chatId) return;
    api.getSarana(Number(chatId)).then(setChatItem).catch(() => {});
    router.replace("/maintenance/transaksi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadTable = useCallback(async () => {
    const reqId = ++tableReqIdRef.current;
    setTableBusy(true);
    setTableError("");
    try {
      const result = await api.listSarana({
        page: filters.page,
        limit: filters.limit,
        bulan: filters.bulan,
        status: filters.status,
        kategori: filters.kategori,
        urgensi: filters.urgensi,
        divisi: filters.divisi,
        departemen: filters.departemen,
        direktorat: filters.direktorat,
        search: filters.search,
      });
      if (reqId !== tableReqIdRef.current) return;
      const resultItems = result?.items ?? [];
      const resultTotal = result?.total ?? 0;
      if (resultItems.length === 0 && resultTotal > 0 && filters.page > 1) {
        setFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setItems(resultItems);
      setTotal(resultTotal);
    } catch (err) {
      if (reqId !== tableReqIdRef.current) return;
      setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current) setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTable();
  }, [loadTable]);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      updateFilter({ search: value.trim() });
    }, 350);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters(defaultFilters());
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: PerbaikanSarana) {
    confirm(t("mnt.confirmDeleteLaporan"), async () => {
      try {
        await api.deleteSarana(item.id);
        showToast(t("mnt.toastLaporanDeleted"));
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const PAGE_WINDOW = 2;
  let pageStart = Math.max(1, filters.page - 1);
  const pageEnd = Math.min(totalPages, pageStart + PAGE_WINDOW - 1);
  pageStart = Math.max(1, pageEnd - PAGE_WINDOW + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const showOrgFilters = isBookingOriginRole(me.role);

  const selectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === filters.direktorat) || null;
  const divisiOptions = selectedDirektoratNode
    ? selectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const selectedDivisiNode = filters.divisi
    ? (selectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === filters.divisi
      )
    : null;
  const departemenOptions = selectedDivisiNode
    ? selectedDivisiNode.departemen
    : selectedDirektoratNode
      ? selectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  return (
    <>
      <div className="card">
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-sarana-search">{t("mnt.searchLaporan")}</label>
            <input type="text" id="filter-sarana-search" placeholder={t("mnt.noLaporanLokasiPlaceholder")} value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-sarana-bulan">{t("common.filterMonth")}</label>
            <input type="month" id="filter-sarana-bulan" autoComplete="off" value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value })} />
          </div>

          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">{t("common.filter")}</label>
            <button type="button" className="btn btn-secondary" id="filter-sarana-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              {t("common.allFilters")}
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="filter-sarana-status">{t("common.status")}</label>
                  <SearchableSelect
                    id="filter-sarana-status"
                    value={filters.status}
                    onChange={(v) => updateFilter({ status: v as BookingStatus | "REJECTED" | "" })}
                    options={["DRAFT", "SUBMITTED", "APPROVED_L1", "APPROVED_GA", "REJECTED", "APPROVED_GA_APPROVAL"]}
                    getLabel={(v) => ({
                      DRAFT: t("word.draft"),
                      SUBMITTED: `${t("word.onApproval")}: ${t("word.approval")} ${t("word.department")}/${t("word.division")}`,
                      APPROVED_L1: `${t("word.onApproval")}: ${t("word.admin")} ${t("word.generalAffair")}`,
                      APPROVED_GA: `${t("word.onApproval")}: ${t("word.approval")} GA`,
                      REJECTED: t("word.rejected"),
                      APPROVED_GA_APPROVAL: t("word.approved"),
                    } as Record<string, string>)[v] || v}
                    clearLabel={t("common.allStatus")}
                    placeholder={t("common.allStatus")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-sarana-kategori">{t("mnt.kategoriKerusakan")}</label>
                  <SearchableSelect
                    id="filter-sarana-kategori"
                    value={filters.kategori}
                    onChange={(v) => updateFilter({ kategori: v as KategoriKerusakan | "" })}
                    options={KATEGORI_OPTIONS}
                    getLabel={(v) => getKategoriKerusakanLabelMap(language)[v as KategoriKerusakan] || v}
                    clearLabel={t("mnt.semuaKategori")}
                    placeholder={t("mnt.semuaKategori")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-sarana-urgensi">{t("mnt.tingkatUrgensi")}</label>
                  <SearchableSelect
                    id="filter-sarana-urgensi"
                    value={filters.urgensi}
                    onChange={(v) => updateFilter({ urgensi: v as Urgensi | "" })}
                    options={URGENSI_OPTIONS}
                    getLabel={(v) => getUrgensiLabelMap(language)[v as Urgensi] || v}
                    clearLabel={t("mnt.semuaUrgensi")}
                    placeholder={t("mnt.semuaUrgensi")}
                  />
                </div>
                {showOrgFilters && (
                  <>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-direktorat">{t("word.directorate")}</label>
                      <SearchableSelect
                        id="filter-sarana-direktorat"
                        value={filters.direktorat}
                        onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                        options={orgStructure?.direktorat || []}
                        clearLabel={t("common.allDirectorate")}
                        placeholder={t("common.allDirectorate")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-divisi">{t("word.division")}</label>
                      <SearchableSelect
                        id="filter-sarana-divisi"
                        value={filters.divisi}
                        onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                        options={divisiOptions}
                        clearLabel={t("common.allDivision")}
                        placeholder={t("common.allDivision")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-departemen">{t("word.department")}</label>
                      <SearchableSelect
                        id="filter-sarana-departemen"
                        value={filters.departemen}
                        onChange={(v) => updateFilter({ departemen: v })}
                        options={departemenOptions}
                        clearLabel={t("common.allDepartment")}
                        placeholder={t("common.allDepartment")}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>{t("mnt.semuaLaporan")}</button>

          <div className="toolbar-actions">
            {isOrigin && (
              <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
                {t("mnt.tambahLaporan")}
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.rowNo")}</th><th>{t("mnt.thNomorLaporan")}</th><th>{t("mnt.dilaporkanHeader")}</th><th>{t("mnt.thLokasi")}</th><th>{t("mnt.thKategori")}</th><th>{t("mnt.thUrgensi")}</th><th>{t("mnt.deskripsiKerusakan")}</th>
                <th>{t("word.division")}</th><th>{t("word.department")}</th><th>{t("mnt.tanggalLaporan")}</th><th>{t("common.notes")}</th><th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={12} className="table-empty">{t("common.loadingData")}</td></tr>
              ) : tableError ? (
                <tr><td colSpan={12} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={12} className="table-empty">{t("eks.noDataForFilter")}</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPerbaikan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td title={item.lokasi}>{truncateText(item.lokasi, 25)}</td>
                      <td>{getKategoriKerusakanLabelMap(language)[item.kategori]}</td>
                      <td>
                        <span className={`badge ${URGENSI_BADGE_CLASS[item.urgensi]}`}>{getUrgensiLabelMap(language)[item.urgensi]}</span>
                      </td>
                      <td title={item.deskripsiKerusakan}>{truncateText(item.deskripsiKerusakan, 35)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} departemen={item.departemen} />
                            {item.status === "APPROVED_GA_APPROVAL" && item.executionStage !== "MENUNGGU" && (
                              <span className="badge badge-pending">{getExecutionStageLabelMap(language)[item.executionStage]}</span>
                            )}
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label={t("common.chat")}
                            onClick={() => setChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label={t("common.aksi")} onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="filter-sarana-limit">{t("common.show")}</label>
              <SearchableSelect
                id="filter-sarana-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("mnt.unitLaporan")}`}
                placeholder={`${filters.limit} ${t("mnt.unitLaporan")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {total} {t("mnt.unitLaporan")} · {t("common.page")} {filters.page} {t("common.ofTotal")} {totalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)}>‹</button>
              {pageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === filters.page ? "active" : ""}`} onClick={() => goToPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

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
        <SaranaFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />
      )}

      <SaranaDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          loadTable();
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
          onRead={loadTable}
        />
      )}
    </>
  );
}

export default function MaintenanceTransaksiPage() {
  return (
    <Suspense fallback={null}>
      <MaintenanceTransaksiPageInner />
    </Suspense>
  );
}
