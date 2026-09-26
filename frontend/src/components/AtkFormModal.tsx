"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ATK_CATALOG } from "@/lib/atkCatalog";
import { KATEGORI_ATK_LABEL, ROLE_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { AtkKategori, Me, PermintaanAtkCreatePayload, PermintaanAtkItemPayload, Role } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import TextAutocomplete from "./TextAutocomplete";
import { useToast } from "./ui/ToastProvider";

// Satuan is no longer a field the user fills in by hand - it's derived silently from the catalog
// the moment Nama Barang matches one of the 200 starter items, falling back to "pcs" (the most
// common unit in the catalog) for anything typed that isn't an exact match.
const ATK_CATALOG_BY_NAME = new Map(ATK_CATALOG.map((i) => [i.namaBarang, i.satuan]));
const ATK_CATALOG_NAMES = ATK_CATALOG.map((i) => i.namaBarang);
const DEFAULT_SATUAN = "pcs";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyItem(): PermintaanAtkItemPayload {
  return { namaBarang: "", jumlah: 1, satuan: DEFAULT_SATUAN };
}

// kategori starts unselected (unlike the payload's required AtkKategori) so the field shows the
// "Pilih Kategori" placeholder instead of defaulting to the first option.
type AtkFormState = Omit<PermintaanAtkCreatePayload, "kategori"> & { kategori?: AtkKategori };

function emptyForm(): AtkFormState {
  return {
    tanggal: todayLocalDate(),
    kategori: undefined,
    keperluan: "",
    namaPemohon: "",
    noTeleponPemohon: "",
    catatan: "",
    items: [emptyItem()],
  };
}

const KATEGORI_OPTIONS = Object.keys(KATEGORI_ATK_LABEL) as AtkKategori[];

const MAX_ITEM_ROWS = 10;

// The 6 roles a real actor can create an Office Supplies request as
// (PermintaanAtkController.OriginRoles minus KPU/SUPER_ADMIN, which never create their own) - what
// Super Admin picks from in "Bertindak Sebagai Role" to declare which origin identity a new request
// is created under.
const AS_ROLE_OPTIONS: Role[] = ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"];

export default function AtkFormModal({ open, me, onClose, onCreated }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<AtkFormState>(emptyForm());
  const [asRole, setAsRole] = useState<Role | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nomorPermintaan, setNomorPermintaan] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  const isSuperAdmin = me.role === "SUPER_ADMIN";
  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA" || me.role === "SUPER_ADMIN";
  // Super Admin's chosen AsRole drives which org fields apply, mirroring that role's own real
  // constraints (see backend AsRoleValidationError) - GA roles need neither, Divisi roles need
  // only Divisi, Departemen roles need both.
  const asRoleNeedsDivisi = isSuperAdmin && asRole !== "" && asRole !== "ADMIN_GA" && asRole !== "APPROVAL_GA";
  const asRoleNeedsDepartemen = isSuperAdmin && (asRole === "ADMIN_DEPARTEMEN" || asRole === "APPROVAL_DEPARTEMEN");

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setAsRole("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextAtkNomor(form.tanggal, isGaActor ? form.divisi : undefined, isSuperAdmin ? asRole || undefined : undefined)
      .then((r) => setNomorPermintaan(r.nomorPermintaan))
      .catch(() => setNomorPermintaan(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal, form.divisi, asRole]);

  if (!open) return null;

  // Flattened once so both directions of the Divisi<->Departemen sync below can look either one
  // up without re-walking direktoratTree per keystroke.
  const allDivisiNodes = orgStructure?.direktoratTree.flatMap((d) => d.divisi) || [];
  const departemenOptions = form.divisi
    ? allDivisiNodes.find((v) => v.nama === form.divisi)?.departemen || []
    : orgStructure?.departemen || [];

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin GA" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof AtkFormState>(key: K, value: AtkFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setItem(index: number, patch: Partial<PermintaanAtkItemPayload>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addItemRow() {
    setForm((f) => (f.items.length >= MAX_ITEM_ROWS ? f : { ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItemRow(index: number) {
    setForm((f) => (f.items.length <= 1 ? f : { ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSuperAdmin) {
      if (!asRole) {
        setError("Bertindak Sebagai Role wajib dipilih");
        return;
      }
      if (asRoleNeedsDivisi && !form.divisi) {
        setError("Divisi wajib dipilih untuk role ini");
        return;
      }
      if (asRoleNeedsDepartemen && !form.departemen) {
        setError("Departemen wajib dipilih untuk role ini");
        return;
      }
    } else if (isGaActor) {
      if (!form.divisi) {
        setError("Divisi wajib dipilih");
        return;
      }
      if (form.departemen === undefined) {
        setError("Departemen wajib dipilih");
        return;
      }
    }
    if (!form.kategori) {
      setError("Kategori wajib dipilih");
      return;
    }
    setBusy(true);
    try {
      // "" (the explicit "Kebutuhan Divisi" choice) means no specific Departemen - translated to
      // undefined here (not sent at all) so the backend still records a null Departemen.
      await api.createAtk({
        ...form,
        kategori: form.kategori,
        departemen: form.departemen || undefined,
        catatan: form.catatan || null,
        asRole: isSuperAdmin ? asRole || undefined : undefined,
      });
      showToast("Pesanan Kebutuhan Kantor berhasil disimpan sebagai Draft");
      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Form Pesan Kebutuhan Kantor {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fa-nomor-permintaan">Nomor Pesanan</label>
              <input type="text" id="fa-nomor-permintaan" disabled value={nomorPermintaan} />
            </div>
            {isSuperAdmin && (
              <div className="field full">
                <label htmlFor="fa-as-role">Bertindak Sebagai Role</label>
                <SearchableSelect
                  id="fa-as-role"
                  value={asRole}
                  onChange={(next) => {
                    setAsRole(next as Role);
                    setForm((f) => ({ ...f, divisi: undefined, departemen: undefined }));
                  }}
                  options={AS_ROLE_OPTIONS}
                  getLabel={(v) => ROLE_LABEL[v as Role]}
                  placeholder="Pilih Role"
                  searchable={false}
                />
              </div>
            )}
            {(asRoleNeedsDivisi || (isGaActor && !isSuperAdmin)) && (
              <div className="field">
                <label htmlFor="fa-divisi">Divisi</label>
                <SearchableSelect
                  id="fa-divisi"
                  value={form.divisi}
                  onChange={(next) => {
                    const divisiNode = allDivisiNodes.find((d) => d.nama === next);
                    setForm((f) => ({
                      ...f,
                      divisi: next,
                      departemen: f.departemen === "" || (f.departemen && divisiNode?.departemen.includes(f.departemen)) ? f.departemen : undefined,
                    }));
                  }}
                  options={orgStructure?.divisi || []}
                  placeholder="Pilih Divisi"
                />
              </div>
            )}
            {(asRoleNeedsDepartemen || (isGaActor && !isSuperAdmin)) && (
              <div className="field">
                <label htmlFor="fa-departemen">Departemen</label>
                <SearchableSelect
                  id="fa-departemen"
                  value={form.departemen}
                  onChange={(next) => {
                    if (!next) { set("departemen", next); return; }
                    const owningDivisi = allDivisiNodes.find((d) => d.departemen.includes(next))?.nama;
                    setForm((f) => ({ ...f, departemen: next, divisi: owningDivisi || f.divisi }));
                  }}
                  options={departemenOptions}
                  placeholder="Pilih Departemen"
                  clearLabel="Kebutuhan Divisi"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="fa-tanggal">Tanggal</label>
              <DateFilterPicker id="fa-tanggal" value={form.tanggal} onChange={(v) => set("tanggal", v)} clearable={false} />
            </div>
            <div className="field">
              <label htmlFor="fa-kategori">Kategori</label>
              <SearchableSelect
                id="fa-kategori"
                value={form.kategori}
                onChange={(v) => set("kategori", v as AtkKategori)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => KATEGORI_ATK_LABEL[v as AtkKategori] || v}
                placeholder="Pilih Kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="fa-nama-pemohon">Nama PIC</label>
              <input type="text" id="fa-nama-pemohon" required maxLength={255} value={form.namaPemohon} onChange={(e) => set("namaPemohon", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fa-no-telepon-pemohon">No. Telepon PIC</label>
              <input type="text" id="fa-no-telepon-pemohon" required maxLength={50} value={form.noTeleponPemohon} onChange={(e) => set("noTeleponPemohon", e.target.value.replace(/[^0-9+]/g, ""))} />
            </div>
            <div className="field full">
              <label htmlFor="fa-keperluan">Tujuan</label>
              <input type="text" id="fa-keperluan" required maxLength={150} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Daftar Barang</label>
              <div className="photo-drop-uploader">
                <div className="item-row-list">
                  {form.items.map((row, idx) => (
                    <div key={idx} className="item-row">
                      <div className="item-row-field item-row-col-lg">
                        <label htmlFor={`fa-nama-barang-${idx}`}>Nama Barang</label>
                        <TextAutocomplete
                          id={`fa-nama-barang-${idx}`}
                          ariaLabel={`Nama barang ${idx + 1}`}
                          required
                          maxLength={255}
                          options={ATK_CATALOG_NAMES}
                          placeholder="Contoh: Pulpen"
                          value={row.namaBarang}
                          onChange={(namaBarang) => {
                            setItem(idx, { namaBarang, satuan: ATK_CATALOG_BY_NAME.get(namaBarang) || DEFAULT_SATUAN });
                          }}
                        />
                      </div>
                      <div className="item-row-field item-row-col-sm">
                        <label htmlFor={`fa-jumlah-${idx}`}>Jumlah</label>
                        <input
                          type="text"
                          id={`fa-jumlah-${idx}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`Jumlah barang ${idx + 1}`}
                          required
                          placeholder="Jumlah"
                          value={row.jumlah === 0 ? "" : String(row.jumlah)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                            setItem(idx, { jumlah: digits === "" ? 0 : Math.min(Number(digits), 9999) });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="card-icon-btn card-icon-btn-danger item-row-delete-btn"
                        aria-label={`Hapus baris barang ${idx + 1}`}
                        disabled={form.items.length <= 1}
                        style={{ opacity: form.items.length <= 1 ? 0.4 : 1 }}
                        onClick={() => removeItemRow(idx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {form.items.length < MAX_ITEM_ROWS && (
                  <button type="button" className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={addItemRow}>
                    + Tambah Barang
                  </button>
                )}
              </div>
            </div>

            <div className="field full">
              <label htmlFor="fa-catatan">Catatan</label>
              <input type="text" id="fa-catatan" maxLength={255} placeholder="Contoh: Stok Menipis" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
