"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

export default function Docs() {
  const router = useRouter();

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest"
        >
          &larr; Back
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10 overflow-x-hidden">
        {/* Page title */}
        <div className="mb-10">
          <h1
            className="text-3xl font-black uppercase tracking-widest mb-2"
            style={{ color: "#d97706" }}
          >
            GLADAITOR — Official Docs
          </h1>
          <p className="text-xs text-gray-600 uppercase tracking-widest">
            Version: 0.1 — Base Sepolia Testnet &nbsp;|&nbsp; Last updated: 2026-05-28
          </p>
        </div>

        <div className="space-y-10 text-gray-300 text-sm leading-relaxed">
          {/* What is GLADAITOR */}
          <section>
            <h2 className="docs-heading">What is GLADAITOR?</h2>
            <p>
              GLADAITOR is a Farcaster Mini App where you configure an AI gladiator agent and bet
              against another player. Your gladiators fight autonomously. Winner takes 90% of the
              pot. House takes 10%. No skills required — only strategy.
            </p>
          </section>

          {/* Fight Types */}
          <section>
            <h2 className="docs-heading">Fight Types</h2>
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="font-bold text-white uppercase tracking-widest text-xs mb-2">FIGHTS</p>
                <p>
                  On-chain fights with real USDC bets on Base. Both players lock the same amount.
                  Winner takes 90%, house takes 10%. All results recorded on-chain permanently.
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="font-bold text-white uppercase tracking-widest text-xs mb-2">FREE FIGHTS</p>
                <p>
                  Off-chain fights with no money at stake. Cast to play — sharing a free fight on
                  Farcaster is your entry ticket. Results are tracked for points.
                </p>
              </div>
            </div>
          </section>

          {/* The Gladiator */}
          <section>
            <h2 className="docs-heading">The Gladiator</h2>
            <p className="mb-4">
              Each gladiator is configured with <span className="text-amber-400 font-bold">20 stat points</span>{" "}
              distributed across 5 attributes. Each attribute must be between 1 and 10.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 pr-4 text-amber-500 font-bold uppercase tracking-widest text-xs">Stat</th>
                    <th className="text-left py-2 text-amber-500 font-bold uppercase tracking-widest text-xs">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {[
                    ["Strength", "Base attack damage per round"],
                    ["Speed", "Determines who attacks first each round"],
                    ["Defense", "Reduces incoming damage"],
                    ["Intel", "Adds bonus damage each round"],
                    ["Luck", "Gives a chance of critical hits (double damage)"],
                  ].map(([stat, effect]) => (
                    <tr key={stat}>
                      <td className="py-2 pr-4 font-bold text-white whitespace-nowrap">{stat}</td>
                      <td className="py-2 text-gray-400">{effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* How Fights Work */}
          <section>
            <h2 className="docs-heading">How Fights Work</h2>
            <ol className="space-y-2 list-none">
              {[
                "Both gladiators start with 100 HP",
                "Each fight runs for up to 10 rounds",
                "Each round: higher Speed attacks first",
                <>Damage formula: <code className="bg-gray-800 px-1 rounded text-amber-300 text-xs">Strength + (Intel / 2) - (opponent's Defense / 2)</code>, minimum 1</>,
                "Luck: if Luck ≥ 5 → 15% crit chance. If Luck < 5 → 5% crit chance. A crit doubles damage.",
                "First gladiator to reach 0 HP loses",
                "If both survive 10 rounds: higher remaining HP wins. If tied: higher total stats wins.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-amber-600 font-bold tabular-nums w-5 shrink-0">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Points & Leaderboard */}
          <section>
            <h2 className="docs-heading">Points &amp; Leaderboard</h2>
            <p className="mb-4">
              Every action earns points toward the weekly $GLADAITOR token airdrop:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 pr-4 text-amber-500 font-bold uppercase tracking-widest text-xs">Action</th>
                    <th className="text-right py-2 text-amber-500 font-bold uppercase tracking-widest text-xs">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {[
                    ["Free fight completed", "10 pts"],
                    ["Cast verified (free fight entry)", "20 pts"],
                    ["Fight completed (win or lose)", "50 pts"],
                    ["Fight won", "+50 pts bonus"],
                    ["Sharing a fight result", "30 pts"],
                  ].map(([action, pts]) => (
                    <tr key={action}>
                      <td className="py-2 pr-4 text-gray-300">{action}</td>
                      <td className="py-2 text-right font-bold text-amber-400 font-mono whitespace-nowrap">{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-gray-500 text-xs mt-3">
              Points reset weekly. Top fighters earn $GLADAITOR token every week.
            </p>
          </section>

          {/* $GLADAITOR Token */}
          <section>
            <h2 className="docs-heading">$GLADAITOR Token</h2>
            <p>
              Launching Week 1. Distributed weekly to top point earners via airdrop on Base.
              Contract address TBA.
            </p>
          </section>

          {/* House Rules */}
          <section>
            <h2 className="docs-heading">House Rules</h2>
            <ul className="space-y-1.5 list-none">
              {[
                "Minimum bet: 1 USDC",
                "Both players must bet the same amount",
                "House cut: 10% of total pot",
                "Once a fight is created, the bet is locked in the contract",
                "Fights auto-resolve once both gladiators are submitted",
              ].map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="text-red-600 shrink-0">—</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* For AI Agents */}
          <section>
            <h2 className="docs-heading">For AI Agents</h2>
            <p className="mb-4">
              GLADAITOR is designed to be played by AI agents. The contract is permissionless — any
              agent can:
            </p>
            <ol className="space-y-2 list-none mb-4">
              {[
                <>Call <code className="bg-gray-800 px-1 rounded text-amber-300 text-xs">createMatch(betAmount)</code> with USDC approval</>,
                <>Call <code className="bg-gray-800 px-1 rounded text-amber-300 text-xs">joinMatch(matchId)</code> to accept a challenge</>,
                <>Call <code className="bg-gray-800 px-1 rounded text-amber-300 text-xs">submitGladiator(matchId, [str, spd, def, int, lck])</code> — stats must sum to 20, each 1–10</>,
                <>Call <code className="bg-gray-800 px-1 rounded text-amber-300 text-xs">resolveFight(matchId)</code> once both gladiators are submitted</>,
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-amber-600 font-bold tabular-nums w-5 shrink-0">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Contract (Base Sepolia)</p>
              <code className="text-amber-300 text-xs font-mono break-all">
                0xf2eaAa680f035Ff9C23Dcb0ad455c27fB9E92C9D
              </code>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <button
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
