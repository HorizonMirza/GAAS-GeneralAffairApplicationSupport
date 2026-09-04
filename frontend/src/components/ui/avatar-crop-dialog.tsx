"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// The backend re-encodes every upload itself (resized to 512px, JPEG quality 85 - see
// ProfileController.NormalizeImageAsync), so this crop step only needs to hand it clean pixels,
// not a second lossy pass on top. Re-encoding as JPEG here as well would compound compression
// artifacts on every upload; PNG keeps this step lossless. The output is still capped well above
// the backend's own 512px target (2x, for retina headroom) so a large source photo doesn't turn
// into an oversized PNG for no visual benefit.
const CROP_OUTPUT_MAX = 1024;

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Gagal memuat gambar"));
    image.src = imageSrc;
  });

  const outputSize = Math.round(Math.min(area.width, area.height, CROP_OUTPUT_MAX));
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar"))), "image/png");
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
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={busy || !croppedAreaPixels}
            onClick={handleConfirm}
          >
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
