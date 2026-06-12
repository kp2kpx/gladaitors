# Combat Replay — visual notes (visual-upgrade branch)

Working notes for the GLADAITORS combat-replay renderer. Author: Designer agent, 2026-06-11.

## Art approach (the fork, and why)

**Decision: fully procedural pixel art, no image assets.**

Options weighed:
1. PNG sprite sheets (status quo) — the existing sheets needed a portrait-crop hack
   (`SPRITE_SRC_Y = 100`) because of a transparent dead zone mid-sheet, gold had no real
   art (blue + CSS `sepia/hue-rotate` filter), and `ctx.filter` is slow on mobile canvas.
2. Procedural pixel art baked at load — every frame authored in code on a 64×64 art grid,
   rendered once into offscreen canvases, blitted with `imageSmoothingEnabled = false`.

Went with (2): zero asset payload, crisp at any devicePixelRatio, three genuinely distinct
character designs, palette/silhouette fully tunable in code, and per-frame cost is just a
`drawImage` of a small canvas (fast everywhere).

## Renderer architecture

- `components/combat-replay/CombatReplay.tsx` — self-contained client component, vanilla canvas, no SSR.
  (Sprite factory lives beside it: `components/combat-replay/sprites.ts`.)
- All sprites baked in `bakeSprites()` at mount: 3 colors x 6 anims (idle/walk/attack/hit/death/victory).
- Background, vignette and floor-glow are baked once into offscreen canvases — **no
  per-frame gradient creation** (that was a frame-time killer on mobile).
- Single rAF loop driven by `simTime` with a `timeScale` (enables hit-stop and kill-cam
  slow-mo without setTimeout drift). No setTimeout in the hot path.
- Particles are a fixed-size ring buffer (cap 220) — no unbounded allocation.
- Event schedule is precomputed from `result.log` (the engine event log is the single
  source of truth; renderer never re-derives fight outcomes).

## Pacing

- Normal hit cycle ~610ms, crit cycle ~1.1s, combo continuation hits land ~75ms apart
  (20ms scheduling gap + 55ms strike windup).
- Long fights are compressed: gap times scale by `min(1, 26000 / estimatedTotal)`
  (floor 0.35) so a 200-event grind doesn't run 2 minutes. Combo gaps never scale.

## Engine findings (do not re-derive)

- `RoundLog.round` is an attack-event counter, not a round. Never surface it.
- **Draws are unreachable in `simulateFight` as written.** The mid-tick break
  (`if (hp1 <= 0 || hp2 <= 0) break;`) stops the attack queue the moment anyone hits 0,
  so both fighters can never be ≤0. Verified empirically: 200,000 mirror-build fights,
  0 draws. The renderer still fully implements the draw beat (mutual kill, DOUBLE K.O.,
  both fall, neutral DRAW card) driven by `winner === "draw"` / final entry with both
  HP ≤ 0 — tested via a synthesized FightResult in the harness (`/visual-test?auto=draw`).
- Combo data: `isCombo` true for runs ≥2 by same attacker, `comboStep` is 1-based
  position in the run. The 4x crit-extend only fires when `speedGap >= 5`.

## Mobile perf notes

- Canvas backing store = CSS px x min(devicePixelRatio, 2).
- Everything pre-baked blits; per frame: 1 bg drawImage, ~70 twinkle rects, ~24 haze
  motes, 2 sprite blits + ambient effects, bounded particles, a few stroked arcs, text.
- Sprite scale snapped to integer multiples for clean pixels.

## Verified screenshots (session 2, 2026-06-12)

Correction: the 2026-06-11 session claimed verified screenshots but `screenshots/` was
empty and the `/visual-test` harness was never wired — verification never happened.
It has now. Captured at 390x844 portrait, deviceScaleFactor 2, headless Chromium
(Playwright), through the real engine via `/visual-test` auto modes. Re-capture any
time with `node visual-notes/capture-replay.mjs` (dev server on :3177; point
`PLAYWRIGHT_PKG` at a playwright install — it is not a repo dependency).

- `01-intro-approach-red-vs-blue.png` — walk-in approach, usernames + HP bars
- `02-crit-flash.png` — crit impact: white defender silhouette flash, gold ring, CRITICAL number
- `03-killcam-ko.png` — kill-cam zoom + K.O. slam text
- `04-victory-pose.png` — winner card + victory pose, loser flat on the sand
- `05-combo-4x-counter.png` — 4x COMBO counter with radiating burst lines mid-chain
- `06-double-ko.png` — DOUBLE K.O. beat, both falling (synthesized draw)
- `07-draw-card.png` — neutral DRAW card, both HP bars empty, both bodies down
- `08-intro-gold-vs-red.png` — VS card, gold Wildcard evidence
- `09-sprite-sheet.png` — full bank: 3 colors x 6 anims (`?auto=sheet`)

Measured fps in headless run: 60 (`canvas.dataset.fps` hook).

## Session 2 changes (2026-06-12, Designer)

1. **TS narrowing fixes** — `ctx`/`canvas` null-guards didn't narrow inside the nested
   render closures (219 compile errors). Aliased after the guard
   (`ctx0`→`ctx`, `canvasEl`→`canvas`). No behavior change.
2. **Beat-tag priority fix** — an impact that is both combo continuation AND crit
   (exactly the engine's 4x crit-extend) set `data-beat="combo4"` then immediately
   overwrote it with `"crit"`. Combo beat now wins on continuation crits. Visuals
   were unaffected (both counter and crit VFX always rendered); the observable hook lied.
3. **Combo windup priority fix (visible pacing change)** — continuation hits that were
   crits used the 430ms crit windup, stretching the "burst" to ~530ms per hit. Since 4x
   chains are crit-extends by definition, the burst never read as a burst. Combo
   continuation now uses the 60ms windup regardless of crit; chain rhythm is ~80ms sim
   + 90ms crit hit-stop per extend — a drumroll with punch, ending on the 4x counter.
4. **Harness wiring** — `/visual-test` now renders `CombatReplay` (replacing the old
   `CanvasFight` usage on that page) and supports
   `?auto=crit|combo|draw|sheet`, `&p1=&p2=` (colors), `&p1name=&p2name=` (usernames).
   `auto=draw` uses a synthesized mutual-kill `FightResult` (real draws unreachable —
   see Engine findings). `auto=combo` loop-simulates a speed-gap-8 / luck-9 build until
   the log contains `comboStep >= 4` (~33% of fights with that build, measured over
   2000 sims). Also: winner line on the page is draw-aware, and user-facing copy on the
   harness says "gladaitor".

## Perf check (session 2)

- No per-frame gradient/canvas allocation confirmed by review: background, vignette,
  floor glow, HP gradients all baked once; sprites blit from the baked bank.
- Per-frame allocations that remain: small VFX objects at *event* rate (sparks ring-
  buffered at 220, ghosts capped at 6, slashes/rings/dmgNums short-lived and spliced),
  plus per-frame font/string literals in HUD text — negligible.
- Expected frame cost: 1 bg blit + ~72 twinkle rects + 22 motes + 2 sprite blits +
  bounded particles + a few arcs + HUD text. Headless run held 60fps; nothing here is
  fill-rate heavy at 390px-wide canvas with dpr cap 2.

## Drop-in to the product (for KP/CTO)

`CombatReplay` consumes the same `FightResult` the current `FightReplay` gets. To swap
the canvas replay into a fight page:

```tsx
import dynamic from "next/dynamic";
const CombatReplay = dynamic(() => import("@/components/combat-replay/CombatReplay"), { ssr: false });

<CombatReplay
  result={fightResult}      // FightResult from the engine — unchanged
  p1Color="red"             // FighterColor: "red" | "blue" | "gold" (cosmetic pick)
  p2Color="blue"
  p1Name={p1Username}       // Farcaster usernames, rendered white
  p2Name={p2Username}
  onDone={() => setShowSummary(true)}  // fires after victory/draw card (~4.4s post-kill)
/>
```

`FightReplay`'s post-fight overlay (Fight Again / Home / stats, `viewerRole` win-lose
text) is NOT part of CombatReplay — keep that UI in the parent and reveal it in
`onDone`. Nothing in CombatReplay reads `RoundLog.round`, and no round counts are
ever rendered.
