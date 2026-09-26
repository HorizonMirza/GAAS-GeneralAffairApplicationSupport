"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import CredentialsRevealModal, { type RevealedCredential } from "@/components/CredentialsRevealModal";
import type { OrgDirektoratNode, OrgDivisiNode } from "@/lib/types";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

const ROW_STYLE: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" };
const ICON_BTN_STYLE: React.CSSProperties = { width: "auto", padding: "3px 6px" };

// Inline "type to rename" control shared by all three node levels - a plain text input that swaps
// in for the node's label, Enter/blur saves, Escape cancels.
function InlineRename({ initial, disabled, onSave, onCancel }: { initial: string; disabled?: boolean; onSave: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      type="text"
      value={value}
      disabled={disabled}
      style={{ maxWidth: 320 }}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter") onSave(value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => { if (!disabled) onSave(value); }}
    />
  );
}

// Inline "+ Tambah ..." row - a text input (plus, for a Divisi, a Kode Satuan Kerja input) that
// appears under a node and submits on Enter, matching InlineRename's own interaction shape.
function InlineAdd({ placeholder, withKode, disabled, onSubmit, onCancel }: {
  placeholder: string;
  withKode?: boolean;
  disabled?: boolean;
  onSubmit: (nama: string, kode: string) => void;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  return (
    <div style={{ ...ROW_STYLE, gap: 6 }}>
      <Plus width={14} height={14} style={{ opacity: 0.6 }} />
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={nama}
        disabled={disabled}
        style={{ maxWidth: 280 }}
        onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && nama.trim() && (!withKode || kode.trim())) onSubmit(nama.trim(), kode.trim());
        }}
      />
      {withKode && (
        <input
          type="text"
          placeholder="Kode Satuan Kerja"
          value={kode}
          disabled={disabled}
          style={{ maxWidth: 160 }}
          onChange={(e) => setKode(e.target.value)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && nama.trim() && kode.trim()) onSubmit(nama.trim(), kode.trim());
          }}
        />
      )}
      <button
        type="button"
        className="btn btn-primary"
        style={ICON_BTN_STYLE}
        disabled={disabled || !nama.trim() || (withKode && !kode.trim())}
        onClick={() => onSubmit(nama.trim(), kode.trim())}
      >
        Tambah
      </button>
      <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} disabled={disabled} onClick={onCancel}>Batal</button>
    </div>
  );
}

// Super Admin's Direktorat -> Divisi -> Departemen editor - the UI for OrgAdminController, which
// OrgTree.cs's in-memory cache is loaded from. Extracted out of superadmin/page.tsx (already
// 2000+ lines) rather than added inline there.
export default function SuperAdminOrgTab() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [tree, setTree] = useState<OrgDirektoratNode[] | null>(null);
  const [error, setError] = useState("");
  // Shared busy flag across every add/rename/delete action below - this is a single-admin,
  // low-frequency editor (not a hot path), so one flag disabling everything while any one
  // mutation is in flight is simpler than threading a per-row submitting state through three
  // nested levels, and just as effective at blocking a double-click/double-Enter from firing the
  // same create/rename/delete twice before the first response comes back.
  const [saving, setSaving] = useState(false);
  const [expandedDirektorat, setExpandedDirektorat] = useState<Set<number>>(new Set());
  const [expandedDivisi, setExpandedDivisi] = useState<Set<number>>(new Set());

  const [addingDirektorat, setAddingDirektorat] = useState(false);
  const [addingDivisiUnder, setAddingDivisiUnder] = useState<number | null>(null);
  const [addingDepartemenUnder, setAddingDepartemenUnder] = useState<number | null>(null);

  const [renaming, setRenaming] = useState<{ level: "direktorat" | "divisi" | "departemen"; id: number } | null>(null);

  const [credentials, setCredentials] = useState<{ title: string; accounts: RevealedCredential[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getOrgTree();
      setTree(data.direktorat);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat struktur organisasi");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function errorMessage(err: unknown): string {
    return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
  }

  async function handleAddDirektorat(nama: string) {
    if (saving) return;
    setSaving(true);
    try {
      await api.createDirektorat(nama);
      setAddingDirektorat(false);
      showToast("Direktorat berhasil ditambahkan");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDirektorat(id: number, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.renameDirektorat(id, nama);
      showToast("Direktorat berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDirektorat(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Direktorat "${nama}"?`, async () => {
      setSaving(true);
      try {
        await api.deleteDirektorat(id);
        showToast("Direktorat berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleAddDivisi(direktoratId: number, nama: string, kode: string) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.createDivisi(direktoratId, nama, kode);
      setAddingDivisiUnder(null);
      showToast("Divisi berhasil ditambahkan");
      if (result.accounts.length > 0) {
        setCredentials({ title: `Akun Baru untuk Divisi "${nama}"`, accounts: result.accounts });
      }
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDivisi(divisi: OrgDivisiNode, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.updateDivisi(divisi.id, nama, divisi.kodeSatuanKerja);
      showToast("Divisi berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDivisi(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Divisi "${nama}"?`, async () => {
      setSaving(true);
      try {
        await api.deleteDivisi(id);
        showToast("Divisi berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleAddDepartemen(divisiId: number, nama: string) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.createDepartemen(divisiId, nama);
      setAddingDepartemenUnder(null);
      showToast("Departemen berhasil ditambahkan");
      if (result.accounts.length > 0) {
        setCredentials({ title: `Akun Baru untuk Departemen "${nama}"`, accounts: result.accounts });
      }
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDepartemen(id: number, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.renameDepartemen(id, nama);
      showToast("Departemen berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDepartemen(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Departemen "${nama}"?`, async () => {
      setSaving(true);
      try {
        await api.deleteDepartemen(id);
        showToast("Departemen berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Struktur Organisasi</h3>
      </div>
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Direktorat, Divisi, dan Departemen di sini menggantikan struktur yang dulu di-hardcode di
        kode program. Mengganti nama tidak mengubah data transaksi/akun yang sudah ada - hanya
        memengaruhi pilihan pada form baru ke depannya. Menambah Divisi/Departemen otomatis membuat
        akun Admin dan Approval standarnya.
      </p>

      {error ? (
        <p className="text-secondary">{error}</p>
      ) : !tree ? (
        <p className="text-secondary">Memuat...</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {tree.map((direktorat) => (
            <div key={direktorat.id} style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 6 }}>
              <div style={ROW_STYLE}>
                <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} onClick={() => toggle(expandedDirektorat, direktorat.id, setExpandedDirektorat)}>
                  {expandedDirektorat.has(direktorat.id) ? <ChevronDown width={14} height={14} /> : <ChevronRight width={14} height={14} />}
                </button>
                {renaming?.level === "direktorat" && renaming.id === direktorat.id ? (
                  <InlineRename initial={direktorat.nama} disabled={saving} onSave={(v) => handleRenameDirektorat(direktorat.id, v)} onCancel={() => setRenaming(null)} />
                ) : (
                  <strong style={{ flex: 1 }}>{direktorat.nama}</strong>
                )}
                <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Ubah nama" disabled={saving} onClick={() => setRenaming({ level: "direktorat", id: direktorat.id })}>
                  <Pencil width={14} height={14} />
                </button>
                <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Hapus" disabled={saving} onClick={() => handleDeleteDirektorat(direktorat.id, direktorat.nama)}>
                  <Trash2 width={14} height={14} />
                </button>
              </div>

              {expandedDirektorat.has(direktorat.id) && (
                <div style={{ paddingLeft: 30 }}>
                  {direktorat.divisi.map((divisi) => (
                    <div key={divisi.id} style={{ borderLeft: "2px solid var(--border-subtle)", paddingLeft: 12, marginBottom: 4 }}>
                      <div style={ROW_STYLE}>
                        <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} onClick={() => toggle(expandedDivisi, divisi.id, setExpandedDivisi)}>
                          {expandedDivisi.has(divisi.id) ? <ChevronDown width={14} height={14} /> : <ChevronRight width={14} height={14} />}
                        </button>
                        {renaming?.level === "divisi" && renaming.id === divisi.id ? (
                          <InlineRename initial={divisi.nama} disabled={saving} onSave={(v) => handleRenameDivisi(divisi, v)} onCancel={() => setRenaming(null)} />
                        ) : (
                          <span style={{ flex: 1 }}>{divisi.nama} <span className="text-secondary" style={{ fontSize: "0.8rem" }}>({divisi.kodeSatuanKerja})</span></span>
                        )}
                        <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Ubah nama" disabled={saving} onClick={() => setRenaming({ level: "divisi", id: divisi.id })}>
                          <Pencil width={14} height={14} />
                        </button>
                        <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Hapus" disabled={saving} onClick={() => handleDeleteDivisi(divisi.id, divisi.nama)}>
                          <Trash2 width={14} height={14} />
                        </button>
                      </div>

                      {expandedDivisi.has(divisi.id) && (
                        <div style={{ paddingLeft: 30 }}>
                          {divisi.departemen.map((departemen) => (
                            <div key={departemen.id} style={ROW_STYLE}>
                              {renaming?.level === "departemen" && renaming.id === departemen.id ? (
                                <InlineRename initial={departemen.nama} disabled={saving} onSave={(v) => handleRenameDepartemen(departemen.id, v)} onCancel={() => setRenaming(null)} />
                              ) : (
                                <span style={{ flex: 1 }}>{departemen.nama}</span>
                              )}
                              <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Ubah nama" disabled={saving} onClick={() => setRenaming({ level: "departemen", id: departemen.id })}>
                                <Pencil width={14} height={14} />
                              </button>
                              <button type="button" className="btn btn-secondary" style={ICON_BTN_STYLE} title="Hapus" disabled={saving} onClick={() => handleDeleteDepartemen(departemen.id, departemen.nama)}>
                                <Trash2 width={14} height={14} />
                              </button>
                            </div>
                          ))}
                          {addingDepartemenUnder === divisi.id ? (
                            <InlineAdd placeholder="Nama Departemen baru" disabled={saving} onSubmit={(nama) => handleAddDepartemen(divisi.id, nama)} onCancel={() => setAddingDepartemenUnder(null)} />
                          ) : (
                            <button type="button" className="btn btn-secondary" style={{ ...ICON_BTN_STYLE, marginTop: 4 }} disabled={saving} onClick={() => setAddingDepartemenUnder(divisi.id)}>
                              <Plus width={14} height={14} /> Tambah Departemen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {addingDivisiUnder === direktorat.id ? (
                    <InlineAdd placeholder="Nama Divisi baru" withKode disabled={saving} onSubmit={(nama, kode) => handleAddDivisi(direktorat.id, nama, kode)} onCancel={() => setAddingDivisiUnder(null)} />
                  ) : (
                    <button type="button" className="btn btn-secondary" style={{ ...ICON_BTN_STYLE, marginTop: 4 }} disabled={saving} onClick={() => setAddingDivisiUnder(direktorat.id)}>
                      <Plus width={14} height={14} /> Tambah Divisi
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {addingDirektorat ? (
            <InlineAdd placeholder="Nama Direktorat baru" disabled={saving} onSubmit={(nama) => handleAddDirektorat(nama)} onCancel={() => setAddingDirektorat(false)} />
          ) : (
            <button type="button" className="btn btn-primary" style={{ width: "auto", marginTop: 8 }} disabled={saving} onClick={() => setAddingDirektorat(true)}>
              <Plus width={14} height={14} /> Tambah Direktorat
            </button>
          )}
        </div>
      )}

      <CredentialsRevealModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title || ""}
        accounts={credentials?.accounts || []}
      />
    </div>
  );
}
