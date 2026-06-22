# GLADAITORS

Farcaster Mini App. Configure a cyber-gladiator, bet USDC, fight to the death on Base.

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Chain**: Base Sepolia (testnet) — Base mainnet coming
- **Wallet/Auth**: Farcaster Mini App SDK, OnchainKit, wagmi v3, viem v2
- **Payments**: USDC on Base, on-chain wager contract
- **Backend**: Next.js API routes, Vercel KV
- **Deploy**: Vercel

## Contract

**PitArena (Base Sepolia):** `0x7581a548C0D1E2162Ba18D504A34dd0f2309e2b9`

## Fight Types

| Mode | Description |
|------|-------------|
| Create Fight | On-chain USDC wager. Set bet, share link, opponent joins. Winner takes the pot. |
| Free Fight | Off-chain, no stake. Cast on Farcaster to enter. Earns points. |
| Fight Aitor | Challenge the house AI. Fixed stat build. Good warm-up. Earns points. |

## Fight Mechanics

- 100 HP per fighter
- Fight runs until one (or both) gladiators hit 0 HP — no round cap
- Higher Speed attacks first. Speed gap >= 3 = double attack
- Damage: `max(1, STR - max(0, DEF - INT))` — Intel pierces Defense
- Crit: `floor(LCK / 2) * 10%` crit chance, 2x damage on crit
- Red = fight creator, Blue = challenger (same chibi design, different color)

## Stats (25 points, 1–10 per stat)

| Stat | Effect |
|------|--------|
| Strength | Base damage |
| Speed | Attack order, double attack if gap >= 3 |
| Defense | Damage reduction per hit |
| Intel | Pierces opponent's Defense |
| Luck | Crit chance (every 2 pts = +10% crit) |

## Claiming Winnings

Winners claim from the profile page. Gas is sponsored by the house (gasless claim via server-side `claimFor`).

## Running Locally

```bash
npm install
npm run dev
```

Requires `.env.local` — see `.env.example` (not committed).

## Deploy

```bash
vercel --prod
```
