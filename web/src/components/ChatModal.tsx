"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { ChatMessage, Me } from "@/lib/types";

interface Props {
  open: boolean;
  itemId: number | null;
  itemLabel: string;
  me: Me;
  onClose: () => void;
  onRead: () => void;
}

const POLL_INTERVAL_MS = 4000;

export default function ChatModal({ open, itemId, itemLabel, me, onClose, onRead }: Props) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const readNotified = useRef(false);

  useEffect(() => {
    if (!open || itemId == null) {
      setMessages(null);
      readNotified.current = false;
      return;
    }
    let cancelled = false;
    readNotified.current = false;

    function load() {
      api
        .getChatMessages(itemId!)
        .then((data) => {
          if (cancelled) return;
          setMessages(data);
          if (!readNotified.current) {
            readNotified.current = true;
            onRead();
          }
        })
        .catch((err) => {
          if (!cancelled) setError((err as Error).message);
        });
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (!open) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || itemId == null) return;
    setSending(true);
    setError("");
    try {
      const sent = await api.sendChatMessage(itemId, text);
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal chat-modal">
        <div className="modal-header">
          <h3>Chat Transaksi</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <p className="text-secondary" style={{ marginTop: -8, marginBottom: 4 }}>{itemLabel}</p>

        <div className="chat-message-list" ref={listRef}>
          {messages === null ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "24px 0" }}>Memuat chat...</p>
          ) : messages.length === 0 ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "24px 0" }}>Belum ada pesan. Mulai percakapan di bawah.</p>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === me.id;
              return (
                <div key={m.id} className={`chat-bubble-row ${isMine ? "chat-bubble-row-mine" : ""}`}>
                  <div className={`chat-bubble ${isMine ? "chat-bubble-mine" : ""}`}>
                    {!isMine && (
                      <div className="chat-bubble-sender">
                        {m.senderNama} <span className="chat-bubble-role">· {ROLE_LABEL[m.senderRole] || m.senderRole}</span>
                      </div>
                    )}
                    <div className="chat-bubble-text">{m.message}</div>
                    <div className="chat-bubble-time">{formatDateTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <div className="error-text">{error}</div>}

        <form onSubmit={handleSend} className="chat-input-row">
          <input
            type="text"
            placeholder="Tulis pesan..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={sending || !draft.trim()}>
            Kirim
          </button>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
