"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL, chatParticipantLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { ChatMessage, Me } from "@/lib/types";

interface Props {
  open: boolean;
  itemId: number | null;
  itemLabel: string;
  departemen: string | null;
  me: Me;
  onClose: () => void;
  onRead: () => void;
}

const POLL_INTERVAL_MS = 4000;
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

export default function ChatModal({ open, itemId, itemLabel, departemen, me, onClose, onRead }: Props) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readNotified = useRef(false);

  const participantLabels = chatParticipantLabels(departemen);
  const mentionMatches =
    mentionQuery !== null
      ? participantLabels.filter((l) => l.toLowerCase().includes(mentionQuery.toLowerCase()))
      : [];

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
      setMentionQuery(null);
      setMentionStart(null);
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
          <h3>{itemLabel}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <p className="text-secondary" style={{ marginTop: -8, marginBottom: 4 }}>{participantLabels.join(", ")}</p>

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
                    <div className="chat-bubble-text">{renderWithMentions(m.message, participantLabels)}</div>
                    <div className="chat-bubble-time">{formatDateTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <div className="error-text">{error}</div>}

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
          <form onSubmit={handleSend} className="chat-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Tulis pesan... (ketik @ untuk tag role)"
              value={draft}
              onChange={handleDraftChange}
              disabled={sending}
            />
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={sending || !draft.trim()}>
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
