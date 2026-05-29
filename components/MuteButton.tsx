"use client";

import { useFightAudio } from "@/lib/useAudio";

/**
 * Mute/unmute toggle — fixed top-right corner, always on top.
 * Uses the shared AudioProvider context so it controls the same
 * audio instance used by FightReplay and every other component.
 *
 * Shows nothing if the AudioProvider is not mounted (safe for SSR).
 */
export default function MuteButton() {
  const audio = useFightAudio();
  if (!audio) return null;

  const { isMuted, toggleMute } = audio;

  return (
    <button
      onClick={toggleMute}
      title={isMuted ? "Unmute" : "Mute"}
      aria-label={isMuted ? "Unmute audio" : "Mute audio"}
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 9999,
        background: "rgba(240,230,211,0.85)",
        border: "1px solid #c4a882",
        borderRadius: "20px",
        padding: "5px 10px",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: 1,
        color: isMuted ? "#9a7a50" : "#8b1a1a",
        transition: "color 150ms, border-color 150ms",
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {isMuted ? "🔇" : "♪"}
    </button>
  );
}
