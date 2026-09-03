"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Gagal memuat gambar"));
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar"))), "image/jpeg", 0.92);
  });
}

export interface AvatarCropDialogProps {
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  saving?: boolean;
}

export function AvatarCropDialog({ imageSrc, onCancel, onConfirm, saving }: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setProcessing(false);
    }
  }

  const busy = processing || !!saving;

  return (
    <Dialog open={!!imageSrc} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesuaikan Foto Profil</DialogTitle>
          <DialogDescription>Geser untuk memindahkan, gunakan slider untuk memperbesar.</DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <div className="avatar-crop-area">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="avatar-crop-zoom">Perbesar</label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>

        <DialogFooter>
          <button type="button" className="btn btn-secondary" style={{ width: "auto" }} disabled={busy} onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={busy || !croppedAreaPixels}
            onClick={handleConfirm}
          >
            {busy ? "Menyimpan..." : "Simpan Foto Profil"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
