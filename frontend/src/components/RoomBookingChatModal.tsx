"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CHAT_IMAGE_ACCEPT, MAX_CHAT_IMAGE_SIZE_BYTES, ROLE_COLOR, ROLE_SHORT_LABEL, bookingChatParticipantLabels } from "@/lib/constants";
import { joinChat, leaveChat, onChatMessage } from "@/lib/chatHub";
import { formatTime } from "@/lib/format";
import type { ChatMessage, Me, Role } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";

interface Props {
  open: boolean;
  itemId: number | null;
  itemLabel: string;
  departemen: string | null;
  createdByRole?: Role | null;
  me: Me;
  onClose: () => void;
  onRead: () => void;
}

const MENTION_PATTERN_CHARS = /[.*+?^${}()|[\]\\]/g;

function renderWithMentions(text: string, labels: string[]) {
  if (labels.length === 0) return text;
  const pattern = new RegExp(`@(${labels.map((l) => l.replace(MENTION_PATTERN_CHARS, "\\$&")).join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<span key={key++} className="chat-mention">{match[0]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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

function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"></path>
    </svg>
  );
}

export default function RoomBookingChatModal({ open, itemId, itemLabel, departemen, createdByRole, me, onClose, onRead }: Props) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readNotified = useRef(false);

  const myLabel = ROLE_SHORT_LABEL[me.role];
  const participantLabels = bookingChatParticipantLabels(departemen, createdByRole);
  const mentionMatches =
    mentionQuery !== null
      ? participantLabels.filter((l) => l !== myLabel && l.toLowerCase().includes(mentionQuery.toLowerCase()))
      : [];

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
      .getBookingChatMessages(id)
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

    // Real-time push (see ChatHub.JoinBookingChat / BookingChatController.Send) replaces the old
    // fixed-interval poll - join this thread's group so new messages arrive as they're sent.
    joinChat("booking", id).catch((err) => {
      if (!cancelled) setError((err as Error).message);
    });
    const unsubscribe = onChatMessage("booking", (message) => {
      if (cancelled) return;
      // The sender's own client already appended this message locally on a successful POST
      // (see handleSend) - the broadcast reaching this same connection is a harmless duplicate,
      // deduped here by id.
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
      leaveChat("booking", id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Local preview thumbnail for a picked-but-not-yet-sent image - the object URL is only valid
  // client-side, so it must be revoked whenever the file changes or the modal unmounts.
  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPendingImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  if (!open) return null;

  function handleDraftChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setDraft(value);
    const cursor = e.target.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const atIdx = uptoCursor.lastIndexOf("@");
    if (atIdx === -1) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    setMentionQuery(uptoCursor.slice(atIdx + 1));
    setMentionStart(atIdx);
  }

  function selectMention(label: string) {
    if (mentionStart == null) return;
    const cursor = inputRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(cursor);
    const next = `${before}@${label} ${after}`;
    setDraft(next);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = before.length + label.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handlePickImage(file: File | null) {
    if (!file) return;
    if (!CHAT_IMAGE_ACCEPT.split(",").includes(file.type)) {
      setError("Format gambar harus JPG, PNG, WEBP, atau GIF");
      return;
    }
    if (file.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
      setError("Ukuran gambar maksimal 10 MB");
      return;
    }
    setError("");
    setPendingImage(file);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !pendingImage) || itemId == null) return;
    setSending(true);
    setError("");
    try {
      const sent = await api.sendBookingChatMessage(itemId, text, pendingImage);
      // The server broadcasts this message over the hub before the POST response even comes
      // back (see BookingChatController.Send), so the SignalR push for this exact message can -
      // and often does - reach this same connection first. Same dedup-by-id as the hub handler
      // below, so whichever arrives second is a no-op instead of a duplicate bubble.
      setMessages((prev) => {
        if (!prev) return [sent];
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setDraft("");
      setPendingImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMentionQuery(null);
      setMentionStart(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
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
          <p className="chat-participant-line">{participantLabels.join(", ")}</p>
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
              const imageUrl = m.hasImage ? api.bookingChatImageUrl(itemId!, m.id) : null;
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
                      {initials(m.senderNama)}
                    </div>
                  )}
                  <div className="chat-bubble-stack">
                    <div className={`chat-bubble ${isMine ? "chat-bubble-mine" : ""}`}>
                      {!isMine && isFirstInGroup && (
                        <div className="chat-bubble-sender" style={{ color: roleColor }}>
                          {ROLE_SHORT_LABEL[m.senderRole] || m.senderRole}
                        </div>
                      )}
                      {imageUrl && (
                        <img
                          className="chat-bubble-image"
                          src={imageUrl}
                          alt="Lampiran gambar"
                          onClick={() => setLightboxImage(imageUrl)}
                        />
                      )}
                      {m.message && <div className="chat-bubble-text">{renderWithMentions(m.message, participantLabels)}</div>}
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
          {mentionMatches.length > 0 && (
            <div className="chat-mention-menu">
              {mentionMatches.map((label) => (
                <button type="button" key={label} className="chat-mention-item" onClick={() => selectMention(label)}>
                  @{label}
                </button>
              ))}
            </div>
          )}
          {pendingImage && pendingImagePreview && (
            <div className="chat-image-preview">
              <img src={pendingImagePreview} alt="Pratinjau gambar" />
              <span className="chat-image-preview-name">{pendingImage.name}</span>
              <button
                type="button"
                className="chat-image-preview-remove"
                aria-label="Hapus gambar"
                onClick={() => {
                  setPendingImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                &times;
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="chat-input-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={CHAT_IMAGE_ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => handlePickImage(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="chat-attach-btn"
              aria-label="Lampirkan gambar"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
            >
              <AttachIcon />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder="Tulis pesan..."
              value={draft}
              onChange={handleDraftChange}
              disabled={sending}
            />
            <button type="submit" className="chat-send-btn" aria-label="Kirim" disabled={sending || (!draft.trim() && !pendingImage)}>
              <SendIcon />
            </button>
          </form>
        </div>
      </div>

      {lightboxImage && (
        <div className="chat-lightbox" onClick={() => setLightboxImage(null)}>
          <button type="button" className="chat-lightbox-close" aria-label="Tutup" onClick={() => setLightboxImage(null)}>&times;</button>
          <img src={lightboxImage} alt="Lampiran gambar diperbesar" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </ModalOverlay>
  );
}
