"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { bookingRoomsLabel } from "@/lib/constants";
import { onOpenGlobalChat } from "@/lib/globalChat";
import type { ChatKind } from "@/lib/chatHub";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";
import ChatModal from "./ChatModal";
import RoomBookingChatModal from "./RoomBookingChatModal";
import VehicleBookingChatModal from "./VehicleBookingChatModal";
import AtkChatModal from "./AtkChatModal";
import SaranaChatModal from "./SaranaChatModal";
import ArsipChatModal from "./ArsipChatModal";

interface ResolvedChat {
  kind: ChatKind;
  itemId: number;
  itemLabel: string;
  departemen: string | null;
  createdByRole: Role | null;
}

// Mounted once from AppShell (alongside ChatNotificationListener) so a chat notification's click
// opens the relevant thread directly on top of whatever page is currently open, instead of first
// navigating to that module's Transaction page the way an activity notification still does (see
// NotificationBell.openItem / ChatNotificationListener, which call openGlobalChat for chat-source
// notifications). Fetches just enough of the item to build the same itemLabel/departemen each
// Transaksi page already passes its own chat modal, then renders whichever modal matches "kind".
export default function GlobalChatModal() {
  const { me } = useAuth();
  const [resolved, setResolved] = useState<ResolvedChat | null>(null);

  useEffect(() => {
    return onOpenGlobalChat(async (kind, itemId) => {
      try {
        if (kind === "pengiriman") {
          const item = await api.getPengiriman(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.tujuanPenerimaan} - ${item.nomorTransmittal}`,
            departemen: item.departemen ?? null,
            createdByRole: item.createdByRole,
          });
        } else if (kind === "booking") {
          const item = await api.getBooking(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.namaKegiatan} - ${bookingRoomsLabel(item)} - ${item.nomorPemesanan || "-"}`,
            departemen: item.departemen ?? null,
            createdByRole: null,
          });
        } else if (kind === "kendaraan") {
          const item = await api.getKendaraanBooking(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.keperluan} - ${item.namaKendaraan} - ${item.nomorPemesanan || "-"}`,
            departemen: item.departemen ?? null,
            createdByRole: null,
          });
        } else if (kind === "atk") {
          const item = await api.getAtk(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.keperluan} - ${item.nomorPermintaan || "-"}`,
            departemen: item.departemen ?? null,
            createdByRole: item.createdByRole,
          });
        } else if (kind === "sarana") {
          const item = await api.getSarana(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.lokasi} - ${item.nomorPerbaikan || "-"}`,
            departemen: item.departemen ?? null,
            createdByRole: item.createdByRole,
          });
        } else {
          const item = await api.getArsip(itemId);
          setResolved({
            kind,
            itemId,
            itemLabel: `${item.namaArsip} - ${item.nomorArsip || "-"}`,
            departemen: item.departemen ?? null,
            createdByRole: item.createdByRole,
          });
        }
      } catch {
        // The item may no longer be visible to this user (deleted, or access revoked since the
        // notification was sent) - silently drop instead of popping open a broken chat modal.
      }
    });
  }, []);

  if (!me) return null;

  const close = () => setResolved(null);
  const common = {
    itemId: resolved?.itemId ?? null,
    itemLabel: resolved?.itemLabel ?? "",
    departemen: resolved?.departemen ?? null,
    me,
    onClose: close,
    onRead: () => {},
  };

  switch (resolved?.kind) {
    case "pengiriman":
      return <ChatModal {...common} open createdByRole={resolved.createdByRole} />;
    case "booking":
      return <RoomBookingChatModal {...common} open />;
    case "kendaraan":
      return <VehicleBookingChatModal {...common} open />;
    case "atk":
      return <AtkChatModal {...common} open createdByRole={resolved.createdByRole} />;
    case "sarana":
      return <SaranaChatModal {...common} open createdByRole={resolved.createdByRole} />;
    case "arsip":
      return <ArsipChatModal {...common} open createdByRole={resolved.createdByRole} />;
    default:
      return null;
  }
}
