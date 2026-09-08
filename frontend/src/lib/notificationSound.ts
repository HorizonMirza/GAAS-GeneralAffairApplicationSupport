// Synthesized tones via Web Audio API - no audio asset needed (and nothing to license). One
// shared AudioContext, created lazily on first use since browsers refuse to construct one before
// any user gesture on the page - by the time a chat notification can fire the user has already
// logged in and clicked around, so this almost always succeeds silently.
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function tone(context: AudioContext, freq: number, startAt: number, duration: number, peakGain: number, type: OscillatorType = "sine"): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Quick fade in/out envelope instead of a hard on/off, so the tone doesn't click.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export interface SoundPreset {
  label: string;
  play: (context: AudioContext, now: number) => void;
}

// The fixed list of 10 sound choices Superadmin can assign to each notification type (see
// NotificationSettingsController - its ValidSoundIds must stay in sync with these keys). Ids are
// stored as plain strings in the DB/localStorage so adding a preset later never needs a migration.
export const SOUND_PRESETS: Record<string, SoundPreset> = {
  ding: {
    label: "Ding (naik)",
    play: (c, now) => {
      tone(c, 880, now, 0.13, 0.18);
      tone(c, 1318.5, now + 0.11, 0.16, 0.16);
    },
  },
  pop: {
    label: "Pop (turun)",
    play: (c, now) => {
      tone(c, 660, now, 0.12, 0.16, "triangle");
      tone(c, 440, now + 0.1, 0.18, 0.18, "triangle");
    },
  },
  bell: {
    label: "Bell",
    play: (c, now) => {
      tone(c, 1046.5, now, 0.35, 0.15);
      tone(c, 1568, now, 0.3, 0.08);
    },
  },
  marimba: {
    label: "Marimba",
    play: (c, now) => {
      tone(c, 523.25, now, 0.14, 0.18, "triangle");
      tone(c, 659.25, now + 0.09, 0.14, 0.16, "triangle");
      tone(c, 783.99, now + 0.18, 0.16, 0.16, "triangle");
    },
  },
  chime: {
    label: "Chime",
    play: (c, now) => {
      tone(c, 987.77, now, 0.2, 0.13);
      tone(c, 1174.66, now + 0.13, 0.2, 0.13);
      tone(c, 1567.98, now + 0.26, 0.24, 0.13);
    },
  },
  alert: {
    label: "Alert",
    play: (c, now) => {
      tone(c, 784, now, 0.09, 0.16, "square");
      tone(c, 784, now + 0.13, 0.09, 0.16, "square");
    },
  },
  soft: {
    label: "Soft",
    play: (c, now) => {
      tone(c, 392, now, 0.28, 0.14, "sine");
    },
  },
  digital: {
    label: "Digital",
    play: (c, now) => {
      tone(c, 1200, now, 0.06, 0.13, "square");
      tone(c, 1600, now + 0.08, 0.06, 0.13, "square");
    },
  },
  harp: {
    label: "Harp",
    play: (c, now) => {
      tone(c, 1318.5, now, 0.18, 0.14);
      tone(c, 1046.5, now + 0.08, 0.18, 0.13);
      tone(c, 783.99, now + 0.16, 0.2, 0.12);
    },
  },
  pulse: {
    label: "Pulse",
    play: (c, now) => {
      tone(c, 220, now, 0.2, 0.2, "sawtooth");
    },
  },
};

export const DEFAULT_CHAT_SOUND_ID = "ding";
export const DEFAULT_ACTIVITY_SOUND_ID = "pop";

// Cached in-memory so playing a sound never needs to await a fetch - populated once at app start
// (AppShell/ChatNotificationListener calls fetchNotificationSoundSettings on mount) and kept in
// sync live via ChatHub's "ReceiveNotificationSettingsChanged" (see chatHub.ts).
let chatSoundId = DEFAULT_CHAT_SOUND_ID;
let activitySoundId = DEFAULT_ACTIVITY_SOUND_ID;

export function setNotificationSoundIds(next: { chatSoundId: string; activitySoundId: string }): void {
  if (SOUND_PRESETS[next.chatSoundId]) chatSoundId = next.chatSoundId;
  if (SOUND_PRESETS[next.activitySoundId]) activitySoundId = next.activitySoundId;
}

export function getNotificationSoundIds(): { chatSoundId: string; activitySoundId: string } {
  return { chatSoundId, activitySoundId };
}

function playPreset(id: string): void {
  try {
    const preset = SOUND_PRESETS[id];
    if (!preset) return;
    const context = getContext();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});
    preset.play(context, context.currentTime);
  } catch {
    // Sound is a nice-to-have, never worth surfacing an error for.
  }
}

// A new chat message - plays whichever preset is currently configured for "chat" (see
// setNotificationSoundIds), "ding" (rising two-tone) by default.
export function playChatNotificationSound(): void {
  playPreset(chatSoundId);
}

// A new transaction or an approval step - plays whichever preset is currently configured for
// "activity" (see setNotificationSoundIds), "pop" (falling two-tone) by default.
export function playActivityNotificationSound(): void {
  playPreset(activitySoundId);
}

// Lets the Superadmin settings page play a preset on demand while choosing, independent of
// whatever is currently saved as the chat/activity setting.
export function previewSound(id: string): void {
  playPreset(id);
}
