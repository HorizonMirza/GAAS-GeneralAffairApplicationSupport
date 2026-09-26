"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isValidPengirimanPhone, ROLE_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Asuransi, Me, PengirimanCreatePayload, Role } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyForm(): PengirimanCreatePayload {
  return {
    tanggal: todayLocalDate(),
    jumlahItem: 1,
    tujuanPenerimaan: "",
    namaPengirim: "",
    noTeleponPengirim: "",
    alamatPengirim: "",
    kodeProgram: "",
    namaPenerima: "",
    noTeleponPenerima: "",
    alamatPenerima: "",
    asuransiStatus: "Tidak",
    requestPacking: "Tidak",
    catatan: "",
  };
}

// The 6 roles a real actor can create Pengiriman as (PengirimanController.OriginRoles minus
// KPU/SUPER_ADMIN, which never create their own) - what Super Admin picks from in "Bertindak
// Sebagai Role" to declare which origin identity a new item is created under.
const AS_ROLE_OPTIONS: Role[] = ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"];

export default function PengirimanFormModal({ open, me, onClose, onCreated }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<PengirimanCreatePayload>(emptyForm());
  const [asRole, setAsRole] = useState<Role | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nomorTransmittal, setNomorTransmittal] = useState("");
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
      .nextTransmittal(form.tanggal, isGaActor ? form.divisi : undefined, isSuperAdmin ? asRole || undefined : undefined)
      .then((r) => setNomorTransmittal(r.nomorTransmittal))
      .catch(() => setNomorTransmittal(""));
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

  function set<K extends keyof PengirimanCreatePayload>(key: K, value: PengirimanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
    if (form.jumlahItem <= 0) {
      setError("Jumlah barang harus lebih dari 0");
      return;
    }
    if (!form.namaPengirim.trim()) {
      setError("Nama pengirim wajib diisi");
      return;
    }
    if (!isValidPengirimanPhone(form.noTeleponPengirim)) {
      setError("Nomor telepon pengirim tidak valid");
      return;
    }
    if (!form.namaPenerima.trim()) {
      setError("Nama penerima wajib diisi");
      return;
    }
    if (!isValidPengirimanPhone(form.noTeleponPenerima)) {
      setError("Nomor telepon penerima tidak valid");
      return;
    }
    setBusy(true);
    try {
      // "" (the explicit "Kebutuhan Divisi ini" choice) means no specific Departemen - translated
      // to undefined here (not sent at all) so the backend still records a null Departemen, same
      // as before this field became a required pick instead of an optional one left blank.
      await api.createPengiriman({
        ...form,
        departemen: form.departemen || undefined,
        catatan: form.catatan || null,
        asRole: isSuperAdmin ? asRole || undefined : undefined,
      });
      showToast("Data berhasil disimpan sebagai Draft");
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
          <h3>Form Data Barang {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nomor-transmittal">Nomor Transmittal</label>
              <input type="text" id="f-nomor-transmittal" disabled value={nomorTransmittal} />
            </div>
            {isSuperAdmin && (
              <div className="field full">
                <label htmlFor="f-as-role">Bertindak Sebagai Role</label>
                <SearchableSelect
                  id="f-as-role"
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
                <label htmlFor="f-divisi">Divisi</label>
                <SearchableSelect
                  id="f-divisi"
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
                <label htmlFor="f-departemen">Departemen</label>
                <SearchableSelect
                  id="f-departemen"
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
              <label htmlFor="f-tanggal">Tanggal</label>
              <DateFilterPicker id="f-tanggal" value={form.tanggal} onChange={(v) => set("tanggal", v)} clearable={false} />
            </div>
            <div className="field">
              <label htmlFor="f-jumlah-item">Jumlah Barang</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="f-jumlah-item"
                required
                placeholder="Masukkan angka"
                value={form.jumlahItem === 0 ? "" : String(form.jumlahItem)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahItem", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="f-pengirim">Nama Pengirim</label>
              <input
                type="text"
                id="f-pengirim"
                required
                maxLength={50}
                value={form.namaPengirim}
                onChange={(e) => set("namaPengirim", e.target.value.replace(/[^A-Za-z0-9\s.'-]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="f-telepon-pengirim">No. Telepon Pengirim</label>
              <input
                type="text"
                inputMode="tel"
                id="f-telepon-pengirim"
                required
                maxLength={15}
                value={form.noTeleponPengirim}
                onChange={(e) => set("noTeleponPengirim", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat-pengirim">Alamat Pengirim</label>
              <textarea id="f-alamat-pengirim" required maxLength={255} value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-penerima">Nama Penerima</label>
              <input
                type="text"
                id="f-penerima"
                required
                maxLength={50}
                value={form.namaPenerima}
                onChange={(e) => set("namaPenerima", e.target.value.replace(/[^A-Za-z0-9\s.'-]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="f-telepon">No. Telepon Penerima</label>
              <input
                type="text"
                inputMode="tel"
                id="f-telepon"
                required
                maxLength={15}
                value={form.noTeleponPenerima}
                onChange={(e) => set("noTeleponPenerima", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat">Alamat Penerima</label>
              <textarea id="f-alamat" required maxLength={255} value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-tujuan">Tujuan</label>
              <input type="text" id="f-tujuan" required maxLength={150} placeholder="Contoh: Pengiriman Invoice Tagihan" value={form.tujuanPenerimaan} onChange={(e) => set("tujuanPenerimaan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-kode-program">Kode Program</label>
              <input
                type="text"
                id="f-kode-program"
                required
                inputMode="numeric"
                placeholder="Contoh: 11.03.018.206.29.0313.47.09"
                value={form.kodeProgram}
                // Digits plus the dot separators the MAK-style code above is written with - not
                // pure digits-only, or the exact format shown in this field's own placeholder
                // would be untypable.
                onChange={(e) => set("kodeProgram", e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="f-asuransi">Asuransi</label>
              <SearchableSelect
                id="f-asuransi"
                value={form.asuransiStatus}
                onChange={(v) => set("asuransiStatus", v as Asuransi)}
                options={["Tidak", "Ya"]}
                placeholder="Tidak"
              />
            </div>
            <div className="field">
              <label htmlFor="f-packing">Pengemasan Tambahan</label>
              <SearchableSelect
                id="f-packing"
                value={form.requestPacking}
                onChange={(v) => set("requestPacking", v)}
                options={["Tidak", "Tambahan Kayu"]}
                placeholder="Tidak"
              />
            </div>
            <div className="field full">
              <label htmlFor="f-catatan">Catatan</label>
              <input type="text" id="f-catatan" maxLength={255} placeholder="Contoh: Request JNE Instant" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value.replace(/[^A-Za-z0-9\s]/g, ""))} />
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
