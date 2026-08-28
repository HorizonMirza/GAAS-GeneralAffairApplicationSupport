"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL, canManageArchiveDocument, isBookingOriginRole } from "@/lib/constants";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { ArchiveDocument, ArchiveKategori } from "@/lib/types";
import ArchiveUploadModal from "@/components/ArchiveUploadModal";
import ArchiveUpdateModal from "@/components/ArchiveUpdateModal";
import ArchiveRowMenuDropdown from "@/components/ArchiveRowMenuDropdown";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

export default function ArchivePage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<ArchiveDocument[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterKategori, setFilterKategori] = useState<ArchiveKategori | "">("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDirektorat, setFilterDirektorat] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("");
  const [filterDepartemen, setFilterDepartemen] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<ArchiveDocument | null>(null);

  const rowMenu = useRowMenu(items ?? []);
  const bulanInputRef = useRef<HTMLInputElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (bulanInputRef.current) bulanInputRef.current.value = filterBulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    if (filterOpen) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [filterOpen]);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 350);
  }

  const loadItems = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    try {
      const result = await api.listArchive({
        page,
        limit,
        bulan: filterBulan,
        kategori: filterKategori,
        divisi: filterDivisi,
        departemen: filterDepartemen,
        direktorat: filterDirektorat,
        search,
      });
      if (reqId !== reqIdRef.current) return;
      const resultItems = result?.items ?? [];
      const resultTotal = result?.total ?? 0;
      if (resultItems.length === 0 && resultTotal > 0 && page > 1) {
        setPage((p) => p - 1);
        return;
      }
      setItems(resultItems);
      setTotal(resultTotal);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError((err as Error).message);
    }
  }, [page, limit, filterBulan, filterKategori, filterDivisi, filterDepartemen, filterDirektorat, search]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  const isOrigin = isBookingOriginRole(me.role);

  function handleDelete(item: ArchiveDocument) {
    confirm("Hapus dokumen ini secara permanen?", async () => {
      try {
        await api.deleteArchive(item.id);
        showToast("Dokumen berhasil dihapus");
        loadItems();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setFilterBulan("");
    setFilterKategori("");
    setFilterDirektorat("");
    setFilterDivisi("");
    setFilterDepartemen("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageStart = Math.max(1, page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const selectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === filterDirektorat) || null;
  const divisiOptions = selectedDirektoratNode
    ? selectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const selectedDivisiNode = filterDivisi
    ? (selectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === filterDivisi
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
        <div className="invoice-toolbar-slim invoices-page-toolbar">
          <div className="field invoice-search-field" style={{ marginBottom: 0 }}>
            <label htmlFor="archive-search">Cari Dokumen</label>
            <input type="text" id="archive-search" placeholder="Nama Dokumen / File" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="archive-filter-bulan">Filter Bulan</label>
            <input
              type="month"
              id="archive-filter-bulan"
              autoComplete="off"
              ref={bulanInputRef}
              value={filterBulan}
              onChange={(e) => { setFilterBulan(e.target.value); setPage(1); }}
            />
          </div>
          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">Filter</label>
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="archive-filter-kategori">Kategori</label>
                  <select id="archive-filter-kategori" value={filterKategori} onChange={(e) => { setFilterKategori(e.target.value as ArchiveKategori | ""); setPage(1); }}>
                    <option value="">Semua Kategori</option>
                    {KATEGORI_OPTIONS.map((k) => (
                      <option key={k} value={k}>{ARCHIVE_KATEGORI_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="archive-filter-direktorat">Direktorat</label>
                  <select
                    id="archive-filter-direktorat"
                    value={filterDirektorat}
                    onChange={(e) => { setFilterDirektorat(e.target.value); setFilterDivisi(""); setFilterDepartemen(""); setPage(1); }}
                  >
                    <option value="">Semua Direktorat</option>
                    {(orgStructure?.direktorat || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="archive-filter-divisi">Divisi</label>
                  <select id="archive-filter-divisi" value={filterDivisi} onChange={(e) => { setFilterDivisi(e.target.value); setFilterDepartemen(""); setPage(1); }}>
                    <option value="">Semua Divisi</option>
                    {divisiOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="archive-filter-departemen">Departemen</label>
                  <select id="archive-filter-departemen" value={filterDepartemen} onChange={(e) => { setFilterDepartemen(e.target.value); setPage(1); }}>
                    <option value="">Semua Departemen</option>
                    {departemenOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-label-spacer">Semua Dokumen</span>
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={resetFilters}>
              Semua Dokumen
            </button>
          </div>
          {isOrigin && (
            <button type="button" className="btn btn-primary invoice-input-btn" style={{ width: "auto" }} onClick={() => setUploadOpen(true)}>
              + Unggah Dokumen
            </button>
          )}
        </div>

        <div className="invoice-list">
          {error ? (
            <p className="text-secondary">{error}</p>
          ) : items == null ? (
            <p className="text-secondary">Memuat dokumen...</p>
          ) : items.length === 0 ? (
            <p className="text-secondary">Belum ada dokumen untuk filter ini.</p>
          ) : (
            items.map((doc) => (
              <div className="invoice-row" key={doc.id}>
                <div className="invoice-row-main">
                  <div className="invoice-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="invoice-row-info">
                    <div className="invoice-row-title">{doc.namaDokumen}</div>
                    <div className="invoice-row-meta">
                      {doc.originalFilename} · {formatFileSize(doc.fileSizeBytes)} · Diunggah {formatDateTime(doc.createdAt)}
                      {doc.uploaderNama ? ` oleh ${doc.uploaderNama}` : ""}
                    </div>
                    <div className="invoice-row-meta">{doc.departemen || doc.divisi}</div>
                    {doc.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {doc.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  <span className="badge badge-draft">{ARCHIVE_KATEGORI_LABEL[doc.kategori]}</span>
                  <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, doc.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="archive-limit">Tampilkan</label>
              <select id="archive-limit" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                <option value={5}>5 dokumen</option>
                <option value={10}>10 dokumen</option>
                <option value={20}>20 dokumen</option>
                <option value={50}>50 dokumen</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} dokumen · Halaman {page} dari {totalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              {pageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      <ArchiveRowMenuDropdown
        position={rowMenu.position}
        showEdit={!!rowMenu.menuItem && canManageArchiveDocument(rowMenu.menuItem, me)}
        showDelete={!!rowMenu.menuItem && canManageArchiveDocument(rowMenu.menuItem, me)}
        fileViewUrl={rowMenu.menuItem ? api.archiveFileUrl(rowMenu.menuItem.id) : "#"}
        fileDownloadUrl={rowMenu.menuItem ? api.archiveDownloadUrl(rowMenu.menuItem.id) : "#"}
        onEdit={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setUpdateTarget(item);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
        onLinkClick={() => rowMenu.close()}
      />

      <ArchiveUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          loadItems();
        }}
      />

      <ArchiveUpdateModal
        open={!!updateTarget}
        item={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onDone={() => {
          setUpdateTarget(null);
          loadItems();
        }}
      />
    </>
  );
}
