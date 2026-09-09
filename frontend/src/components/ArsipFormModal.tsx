"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { ArchiveKategori, Me, PermintaanArsipCreatePayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

// Kategori starts unset (undefined) so SearchableSelect shows its placeholder instead of a
// pre-picked value - handleSubmit validates one is chosen before submitting, the same pattern
// RoomBookingFormModal uses for its own required-but-unset selects.
function emptyForm(): Omit<PermintaanArsipCreatePayload, "kategori"> & { kategori: ArchiveKategori | undefined } {
  return {
    tanggal: todayLocalDate(),
    jumlahArsip: 1,
    namaPic: "",
    noTeleponPic: "",
    keperluan: "",
    lokasiPenyimpanan: "",
    catatan: "",
    namaArsip: "",
    kategori: undefined,
    tahunArsip: "",
    jumlah: 1,
    satuan: "",
  };
}

type FormState = ReturnType<typeof emptyForm>;

export default function ArsipFormModal({ open, me, onClose, onCreated }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nomorArsip, setNomorArsip] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextArsipNomor(form.tanggal, isGaActor ? form.divisi : undefined)
      .then((r) => setNomorArsip(r.nomorArsip))
      .catch(() => setNomorArsip(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal, form.divisi]);

  if (!open) return null;

  const departemenOptions = form.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === form.divisi)?.departemen || []
    : [];

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin GA" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isGaActor) {
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
      await api.createArsip({
        ...form,
        kategori: form.kategori,
        departemen: form.departemen || undefined,
        catatan: form.catatan || null,
      });
      showToast("Permintaan pemindahan arsip berhasil disimpan sebagai Draft");
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
          <h3>Form Permintaan Pemindahan Arsip {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fr-nomor-arsip">Nomor Pemindahan Arsip</label>
              <input type="text" id="fr-nomor-arsip" disabled value={nomorArsip} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="fr-divisi">Divisi</label>
                  <SearchableSelect
                    id="fr-divisi"
                    value={form.divisi}
                    onChange={(next) => setForm((f) => ({ ...f, divisi: next, departemen: undefined }))}
                    options={orgStructure?.divisi || []}
                    placeholder="Pilih Divisi"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fr-departemen">Departemen</label>
                  <SearchableSelect
                    id="fr-departemen"
                    value={form.departemen}
                    onChange={(next) => set("departemen", next)}
                    options={departemenOptions}
                    placeholder="Pilih Departemen"
                    clearLabel="Kebutuhan Divisi"
                    disabled={!form.divisi}
                  />
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="fr-tanggal">Tanggal</label>
              <input type="date" id="fr-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-jumlah-arsip">Jumlah Arsip</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fr-jumlah-arsip"
                required
                placeholder="Masukkan Angka"
                value={form.jumlahArsip ? String(form.jumlahArsip) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahArsip", digits === "" ? 0 : Math.min(Number(digits), 9999));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fr-nama-pic">Nama PIC</label>
              <input type="text" id="fr-nama-pic" required maxLength={50} value={form.namaPic} onChange={(e) => set("namaPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-telepon-pic">No. Telepon PIC</label>
              <input
                type="text"
                inputMode="tel"
                id="fr-telepon-pic"
                required
                maxLength={15}
                value={form.noTeleponPic}
                onChange={(e) => set("noTeleponPic", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="fr-lokasi">Lokasi Penyimpanan Saat Ini</label>
              <input type="text" id="fr-lokasi" required maxLength={100} value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fr-keperluan">Tujuan</label>
              <input type="text" id="fr-keperluan" required maxLength={150} placeholder="Contoh: Pemindahan arsip kontrak lama" value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label htmlFor="fr-nama-arsip">Nama Arsip</label>
              <input
                type="text"
                id="fr-nama-arsip"
                required
                maxLength={100}
                placeholder="Contoh: Kontrak Vendor 2018 - 2019"
                value={form.namaArsip}
                onChange={(e) => set("namaArsip", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fr-kategori">Kategori</label>
              <SearchableSelect
                id="fr-kategori"
                value={form.kategori}
                onChange={(v) => set("kategori", v as ArchiveKategori)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                placeholder="Pilih Kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="fr-tahun">Tahun</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fr-tahun"
                required
                placeholder="Contoh: 2018"
                value={form.tahunArsip}
                onChange={(e) => set("tahunArsip", e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
            <div className="field">
              <label htmlFor="fr-jumlah">Jumlah</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fr-jumlah"
                required
                placeholder="Masukkan Angka"
                value={form.jumlah ? String(form.jumlah) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlah", digits === "" ? 0 : Math.min(Number(digits), 9999));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fr-satuan">Satuan</label>
              <input
                type="text"
                id="fr-satuan"
                required
                maxLength={50}
                placeholder="Contoh: Berkas, Bendel, Box"
                value={form.satuan}
                onChange={(e) => set("satuan", e.target.value)}
              />
            </div>

            <div className="field full">
              <label htmlFor="fr-catatan">Catatan</label>
              <input type="text" id="fr-catatan" maxLength={255} placeholder="Contoh: Sudah tidak dipakai sejak 2022" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
