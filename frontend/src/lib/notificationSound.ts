// Synthesized two-tone "ding" via Web Audio API - no audio asset needed (and nothing to license).
// One shared AudioContext, created lazily on first use since browsers refuse to construct one
// before any user gesture on the page - by the time a chat notification can fire the user has
// already logged in and clicked around, so this almost always succeeds silently.
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

// Rising two-tone "ding" (sine) - a new chat message.
export function playChatNotificationSound(): void {
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});
    const now = context.currentTime;
    tone(context, 880, now, 0.13, 0.18);
    tone(context, 1318.5, now + 0.11, 0.16, 0.16);
  } catch {
    // Sound is a nice-to-have, never worth surfacing an error for.
  }
}

// Falling two-tone "pop" (triangle wave, lower register) - deliberately a different shape and
// direction from the chat ding above, for a new transaction or an approval step.
export function playActivityNotificationSound(): void {
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});
    const now = context.currentTime;
    tone(context, 660, now, 0.12, 0.16, "triangle");
    tone(context, 440, now + 0.1, 0.18, 0.18, "triangle");
  } catch {
    // Sound is a nice-to-have, never worth surfacing an error for.
  }
}
