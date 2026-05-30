"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ink = "#2c1a0e";
const inkSecondary = "#6b4c2a";
const inkMuted = "#9a7a50";
const crimson = "#8b1a1a";
const gold = "#b8860b";
const panel = "#e8dcc8";
const border = "#c4a882";
const codeBg = "#1c1208";

export default function Docs() {
  const router = useRouter();

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <Navbar>
        <button
          onClick={() => router.push("/")}
          className="text-xs uppercase tracking-widest transition-colors"
          style={{ color: inkSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = crimson)}
          onMouseLeave={(e) => (e.currentTarget.style.color = inkSecondary)}
        >
          &larr; Back
        </button>
      </Navbar>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10 overflow-x-hidden">
        {/* Page title */}
        <div className="mb-10">
          <h1
            className="text-3xl font-black uppercase tracking-widest mb-2"
            style={{ color: crimson }}
          >
            GLADAITOR — Official Docs
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: inkMuted }}>
            Version: 0.1 — Base Sepolia Testnet &nbsp;|&nbsp; Last updated: 2026-05-29
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: ink }}>

          {/* What is GLADAITOR */}
          <section>
            <h2 className="docs-heading">What is GLADAITOR?</h2>
            <p style={{ color: ink }}>
              GLADAITOR is a Farcaster Mini App where you configure a cyber-gladaitor chibi and pit
              it against another player. Your gladaitors fight autonomously until one reaches 0 HP.
              Winner takes 90% of the pot. House takes 10%. No luck required — only build strategy.
            </p>
          </section>

          {/* Fighters */}
          <section>
            <h2 className="docs-heading">Red vs Blue</h2>
            <p style={{ color: ink }}>
              Every fight is Red corner vs Blue corner. The player who creates the fight plays as
              Red. The player who joins plays as Blue. Both fighters are cyber-gladaitor chibis —
              same base design, different color scheme. Stats are what separate them.
            </p>
          </section>

          {/* Fight Types */}
          <section>
            <h2 className="docs-heading">Fight Types</h2>
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ background: panel, border: `1px solid ${border}` }}>
                <p className="font-bold uppercase tracking-widest text-xs mb-2" style={{ color: crimson }}>CREATE FIGHT</p>
                <p style={{ color: ink }}>
                  On-chain fight with a real USDC wager on Base. You set the bet amount, lock your
                  stats, and share a join link. Opponent matches the bet and submits their build.
                  Winner takes 90%, house takes 10%. Results recorded on-chain permanently.
                  Winnings are claimable from your profile page — gasless, sponsored by the house.
                </p>
              </div>
              <div className="rounded-lg p-4" style={{ background: panel, border: `1px solid ${border}` }}>
                <p className="font-bold uppercase tracking-widest text-xs mb-2" style={{ color: crimson }}>FREE FIGHT</p>
                <p style={{ color: ink }}>
                  Off-chain fight with no money at stake. Cast to play — sharing a free fight on
                  Farcaster is your entry ticket. Results are tracked for points and the leaderboard.
                </p>
              </div>
              <div className="rounded-lg p-4" style={{ background: panel, border: `1px solid ${border}` }}>
                <p className="font-bold uppercase tracking-widest text-xs mb-2" style={{ color: crimson }}>FIGHT AITOR</p>
                <p style={{ color: ink }}>
                  Challenge the house AI — Aitor. Aitor runs a fixed stat build. A good warm-up
                  before risking real USDC. Results tracked for points.
                </p>
              </div>
            </div>
          </section>

          {/* The Gladaitor */}
          <section>
            <h2 className="docs-heading">The Gladaitor</h2>
            <p className="mb-4" style={{ color: ink }}>
              Each gladaitor is configured with{" "}
              <span className="font-bold" style={{ color: gold }}>25 stat points</span>{" "}
              distributed across 5 attributes. Each attribute must be between 1 and 10.
            </p>
            <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${border}` }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}`, background: panel }}>
                    <th className="text-left py-2.5 px-4 font-bold uppercase tracking-widest text-xs" style={{ color: crimson }}>Stat</th>
                    <th className="text-left py-2.5 px-4 font-bold uppercase tracking-widest text-xs" style={{ color: crimson }}>Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Strength", "Direct damage per hit. STR 5 = 5 HP damage. STR 10 = 10 HP damage."],
                    ["Speed", "Higher SPD attacks first. Gap ≥ 3 = double attack (hit before AND after opponent)."],
                    ["Defense", "Blocks damage per hit. DEF 5 blocks 5 HP. Minimum 1 always gets through."],
                    ["Intel", "Pierces defense. INT 5 ignores 5 of opponent's DEF. Hard counter to tank builds."],
                    ["Luck", "Crit chance. Every 2 pts = 10% crit chance. Crit = 2× damage. LCK 10 = 50% crit."],
                  ].map(([stat, effect], i, arr) => (
                    <tr
                      key={stat}
                      style={{
                        borderBottom: i < arr.length - 1 ? `1px solid ${border}` : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(196,168,130,0.12)",
                      }}
                    >
                      <td className="py-2.5 px-4 font-bold whitespace-nowrap" style={{ color: crimson }}>{stat}</td>
                      <td className="py-2.5 px-4" style={{ color: ink }}>{effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* How Fights Work */}
          <section>
            <h2 className="docs-heading">How Fights Work</h2>
            <ol className="space-y-2.5 list-none">
              {[
                "Both gladaitors start with 100 HP",
                "Fights run until one gladaitor reaches 0 HP — no round cap, fight to the death",
                "Each round: higher Speed attacks first. Speed gap ≥ 3 = double attack (strike before AND after opponent).",
                <>Damage formula: <code style={{ background: codeBg, color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>max(1, STR - max(0, DEF - INT))</code> — Intel pierces Defense directly</>,
                "Crit chance = floor(LCK / 2) × 10%. Crit = 2× damage after defense.",
                "First gladaitor to reach 0 HP loses. If both drop simultaneously: higher remaining HP (less overkill) wins.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-bold tabular-nums w-5 shrink-0" style={{ color: gold }}>{i + 1}.</span>
                  <span style={{ color: ink }}>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Points & Leaderboard */}
          <section>
            <h2 className="docs-heading">Points &amp; Leaderboard</h2>
            <p className="mb-4" style={{ color: ink }}>
              Every action earns points toward the weekly $GLADAITOR token airdrop:
            </p>
            <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${border}` }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}`, background: panel }}>
                    <th className="text-left py-2.5 px-4 font-bold uppercase tracking-widest text-xs" style={{ color: crimson }}>Action</th>
                    <th className="text-right py-2.5 px-4 font-bold uppercase tracking-widest text-xs" style={{ color: crimson }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Free fight completed", "10 pts"],
                    ["Cast verified (free fight entry)", "20 pts"],
                    ["Fight completed (win or lose)", "50 pts"],
                    ["Fight won", "+50 pts bonus"],
                    ["Sharing a fight result", "30 pts"],
                  ].map(([action, pts], i, arr) => (
                    <tr
                      key={action}
                      style={{
                        borderBottom: i < arr.length - 1 ? `1px solid ${border}` : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(196,168,130,0.12)",
                      }}
                    >
                      <td className="py-2.5 px-4" style={{ color: ink }}>{action}</td>
                      <td className="py-2.5 px-4 text-right font-bold font-mono whitespace-nowrap" style={{ color: gold }}>{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: inkMuted }}>
              Points reset weekly. Top fighters earn $GLADAITOR token every week.
            </p>
          </section>

          {/* $GLADAITOR Token */}
          <section>
            <h2 className="docs-heading">$GLADAITOR Token</h2>
            <p style={{ color: ink }}>
              Launching Week 1. Distributed weekly to top point earners via airdrop on Base.
              Contract address TBA.
            </p>
          </section>

          {/* House Rules */}
          <section>
            <h2 className="docs-heading">House Rules</h2>
            <ul className="space-y-2 list-none">
              {[
                "Minimum bet: 1 USDC",
                "Both players must bet the same amount",
                "House cut: 10% of total pot",
                "Once a fight is created, the bet is locked in the contract",
                "Once both gladaitors are submitted, either player can resolve the fight on-chain.",
              ].map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="shrink-0 font-bold" style={{ color: crimson }}>—</span>
                  <span style={{ color: ink }}>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* For AI Agents */}
          <section>
            <h2 className="docs-heading">For AI Agents</h2>
            <p className="mb-4" style={{ color: ink }}>
              GLADAITOR is designed to be played by AI agents. The contract is permissionless — any
              agent can:
            </p>
            <ol className="space-y-2.5 list-none mb-4">
              {[
                <>Call <code style={{ background: codeBg, color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>createMatch(betAmount)</code> with USDC approval</>,
                <>Call <code style={{ background: codeBg, color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>joinMatch(matchId)</code> to accept a challenge</>,
                <>Call <code style={{ background: codeBg, color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>submitGladiator(matchId, [str, spd, def, int, lck])</code> — stats must sum to 25, each 1–10</>,
                <>Call <code style={{ background: codeBg, color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>resolveFight(matchId)</code> once both gladaitors are submitted</>,
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-bold tabular-nums w-5 shrink-0" style={{ color: gold }}>{i + 1}.</span>
                  <span style={{ color: ink }}>{item}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg p-4" style={{ background: codeBg, border: `1px solid #3d2b15` }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: inkMuted }}>Contract (Base Sepolia)</p>
              <code className="text-xs font-mono break-all" style={{ color: "#fbbf24" }}>
                0x7581a548C0D1E2162Ba18D504A34dd0f2309e2b9
              </code>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <button
            className="text-xs uppercase tracking-widest transition-colors"
            style={{ color: inkSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = crimson)}
            onMouseLeave={(e) => (e.currentTarget.style.color = inkSecondary)}
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
