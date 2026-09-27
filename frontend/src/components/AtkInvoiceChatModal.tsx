"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_COLOR, ROLE_SHORT_LABEL, INVOICE_CHAT_PARTICIPANT_LABELS } from "@/lib/constants";
import { joinChat, leaveChat, onChatMessage } from "@/lib/chatHub";
import { formatTime } from "@/lib/format";
import type { ChatMessage, Me } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  itemId: number | null;
  itemLabel: string;
  me: Me;
  onClose: () => void;
  onRead: () => void;
}

function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"></circle>
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.6 21 12 3.4 3.4 3 10l13 2-13 2z"></path>
    </svg>
  );
}

// Office Supplies' own AtkInvoice chat - mirrors InvoiceChatModal exactly, on its own thread.
export default function AtkInvoiceChatModal({ open, itemId, itemLabel, me, onClose, onRead }: Props) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [photoErrors, setPhotoErrors] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readNotified = useRef(false);

  useEffect(() => {
    if (!open || itemId == null) {
      setMessages(null);
      readNotified.current = false;
      return;
    }
    let cancelled = false;
    readNotified.current = false;
    const id = itemId;

    api
      .getAtkInvoiceChatMessages(id)
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

    joinChat("atk-invoice", id).catch((err) => {
      if (!cancelled) setError((err as Error).message);
    });
    const unsubscribe = onChatMessage("atk-invoice", (message) => {
      if (cancelled) return;
      setMessages((prev) => {
        if (!prev) return [message];
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      onRead();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      leaveChat("atk-invoice", id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || itemId == null || sending) return;
    setSending(true);
    setError("");
    try {
      const sent = await api.sendAtkInvoiceChatMessage(itemId, text);
      setMessages((prev) => {
        if (!prev) return [sent];
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal chat-modal">
        <div className="chat-modal-header-bar">
          <div className="modal-header">
            <h3>{itemLabel}</h3>
            <button type="button" className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <p className="chat-participant-line">{INVOICE_CHAT_PARTICIPANT_LABELS.join(", ")}</p>
        </div>

        <div className="chat-message-list" ref={listRef}>
          {messages === null && error ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "24px 0" }}>Gagal memuat chat: {error}</p>
          ) : messages === null ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "24px 0" }}>Memuat chat...</p>
          ) : messages.length === 0 ? (
            <p className="text-secondary" style={{ textAlign: "center", padding: "24px 0" }}>Belum ada pesan. Mulai percakapan di bawah.</p>
          ) : (
            messages.map((m, idx) => {
              const isMine = m.senderId === me.id;
              const prev = messages[idx - 1];
              const isFirstInGroup = !prev || prev.senderId !== m.senderId;
              const roleColor = ROLE_COLOR[m.senderRole] || "var(--blue-500)";
              return (
                <div
                  key={m.id}
                  className={`chat-bubble-row ${isMine ? "chat-bubble-row-mine" : ""} ${isFirstInGroup ? "chat-bubble-row-first" : "chat-bubble-row-grouped"}`}
                >
                  {!isMine && (
                    <div
                      className="chat-avatar"
                      style={{ background: roleColor, visibility: isFirstInGroup ? "visible" : "hidden" }}
                    >
                      {photoErrors.has(m.senderId) ? (
                        <PersonIcon />
                      ) : (
                        <img
                          src={api.userPhotoUrl(m.senderId)}
                          alt=""
                          className="chat-avatar-photo"
                          onError={() => setPhotoErrors((current) => new Set(current).add(m.senderId))}
                        />
                      )}
                    </div>
                  )}
                  <div className="chat-bubble-stack">
                    <div className={`chat-bubble ${isMine ? "chat-bubble-mine" : ""}`}>
                      {!isMine && isFirstInGroup && (
                        <div className="chat-bubble-sender" style={{ color: roleColor }}>
                          {ROLE_SHORT_LABEL[m.senderRole] || m.senderRole}
                        </div>
                      )}
                      <div className="chat-bubble-text">{m.message}</div>
                      <div className="chat-bubble-meta">
                        <span className="chat-bubble-time">{formatTime(m.createdAt)}</span>
                        {isMine && <CheckIcon />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && messages !== null && <div className="error-text">{error}</div>}

        <div className="chat-input-wrap">
          <form onSubmit={handleSend} className="chat-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Tulis pesan..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="chat-send-btn" aria-label="Kirim" disabled={sending || !draft.trim()}>
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </ModalOverlay>
  );
}
