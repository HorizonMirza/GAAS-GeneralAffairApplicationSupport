"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { previewSound, setNotificationSoundIds, SOUND_PRESETS } from "@/lib/notificationSound";
import { useToast } from "@/components/ui/ToastProvider";
import SearchableSelect from "./SearchableSelect";

const SOUND_OPTIONS = Object.keys(SOUND_PRESETS);
const soundLabel = (id: string) => SOUND_PRESETS[id]?.label || id;

// Superadmin-only card (rendered from /superadmin) for picking which of the 10 built-in sound
// presets plays for chat notifications vs. workflow (transaction/approval) notifications - a
// single global choice shared by every user (see NotificationSettingsController), not a per-user
// preference. Saving broadcasts live to every open tab via ChatHub, so this component also
// updates its own local playback cache immediately rather than waiting for that round trip.
export default function NotificationSoundSettingsCard() {
  const { showToast } = useToast();
  const [chatSoundId, setChatSoundId] = useState<string>("");
  const [activitySoundId, setActivitySoundId] = useState<string>("");
  const [saved, setSaved] = useState<{ chat: string; activity: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getNotificationSoundSettings()
      .then((settings) => {
        setChatSoundId(settings.chatSoundId);
        setActivitySoundId(settings.activitySoundId);
        setSaved({ chat: settings.chatSoundId, activity: settings.activitySoundId });
      })
      .catch(() => showToast("Gagal memuat pengaturan suara notifikasi", "error"))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !!saved && (saved.chat !== chatSoundId || saved.activity !== activitySoundId);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await api.updateNotificationSoundSettings({ chatSoundId, activitySoundId });
      setNotificationSoundIds(result);
      setSaved({ chat: result.chatSoundId, activity: result.activitySoundId });
      showToast("Pengaturan suara notifikasi disimpan");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card notification-sound-settings-card">
      <h3 style={{ margin: "0 0 4px" }}>Pengaturan Suara Notifikasi</h3>
      <p className="text-secondary" style={{ margin: "0 0 16px", fontSize: "0.85rem" }}>
        Suara ini berlaku untuk semua pengguna. Klik ▶ untuk mendengarkan pilihan sebelum disimpan.
      </p>
      <div className="notification-sound-settings-row">
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label htmlFor="notif-sound-chat">Suara Chat</label>
          <SearchableSelect
            id="notif-sound-chat"
            value={busy ? undefined : chatSoundId}
            onChange={setChatSoundId}
            options={SOUND_OPTIONS}
            getLabel={soundLabel}
            placeholder="Pilih suara"
            disabled={busy}
          />
        </div>
        <button
          type="button"
          className="icon-btn notification-sound-preview-btn"
          aria-label="Dengarkan suara chat"
          disabled={!chatSoundId}
          onClick={() => previewSound(chatSoundId)}
        >
          <Volume2 width={18} height={18} />
        </button>
      </div>
      <div className="notification-sound-settings-row">
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label htmlFor="notif-sound-activity">Suara Transaksi/Approval</label>
          <SearchableSelect
            id="notif-sound-activity"
            value={busy ? undefined : activitySoundId}
            onChange={setActivitySoundId}
            options={SOUND_OPTIONS}
            getLabel={soundLabel}
            placeholder="Pilih suara"
            disabled={busy}
          />
        </div>
        <button
          type="button"
          className="icon-btn notification-sound-preview-btn"
          aria-label="Dengarkan suara transaksi"
          disabled={!activitySoundId}
          onClick={() => previewSound(activitySoundId)}
        >
          <Volume2 width={18} height={18} />
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "auto", marginTop: 4 }}
        disabled={busy || saving || !dirty}
        onClick={handleSave}
      >
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );
}
