"use client";

import { useState } from "react";

interface Props {
  fid: number | null;
  onVerified: () => void;
}

const CAST_TEXT =
  "I'm entering the GLADAITOR pit 🗡️ — configure your agent and fight me: gladaitors.vercel.app [FREE FIGHT]";

export default function CastGate({ fid, onVerified }: Props) {
  const [status, setStatus] = useState<
    "idle" | "waiting" | "not_found" | "error"
  >("idle");

  // No FID means we're not inside a Farcaster client — open Warpcast anyway
  const composerUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(CAST_TEXT)}`;

  async function handleCastAndVerify() {
    // Open Warpcast composer in new tab
    window.open(composerUrl, "_blank", "noopener,noreferrer");
    setStatus("waiting");
  }

  async function handleVerify() {
    if (!fid) {
      // No FID available — can't verify via Neynar; just unlock (free fight only, low stakes)
      onVerified();
      return;
    }

    setStatus("waiting");
    try {
      const res = await fetch("/api/cast/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      if (data.verified) {
        onVerified();
      } else {
        setStatus("not_found");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="arena-bg min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-5xl mb-4">🗡️</div>
        <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">
          Cast to Unlock Free Fight
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Free fights are powered by your Farcaster cast. Cast about the pit
          to get your free entry ticket.
        </p>

        <div className="bg-black border border-gray-700 rounded-lg p-4 mb-6 text-left">
          <p className="text-gray-300 text-sm font-mono leading-relaxed">
            {CAST_TEXT}
          </p>
        </div>

        {status === "idle" && (
          <button className="btn-primary w-full" onClick={handleCastAndVerify}>
            Cast & Enter
          </button>
        )}

        {status === "waiting" && (
          <div className="space-y-3">
            <p className="text-amber-400 text-sm animate-pulse">
              Waiting for your cast...
            </p>
            <button className="btn-primary w-full" onClick={handleVerify}>
              I Casted — Verify Now
            </button>
          </div>
        )}

        {status === "not_found" && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">
              Cast not found yet — wait a moment and try again.
            </p>
            <button className="btn-secondary w-full" onClick={handleVerify}>
              Retry Verification
            </button>
            <button className="btn-primary w-full" onClick={handleCastAndVerify}>
              Cast Again
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">
              Something went wrong. Try again.
            </p>
            <button className="btn-primary w-full" onClick={handleVerify}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
