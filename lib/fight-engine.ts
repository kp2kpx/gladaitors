// TypeScript port of PitArena._simulateFight
// Mirrors the Solidity logic exactly, replacing block.prevrandao + keccak256 with Math.random()-seeded hashing.

export interface GladiatorStats {
  strength: number;
  speed: number;
  defense: number;
  intel: number;
  luck: number;
}

export interface RoundLog {
  round: number;
  attacker: "p1" | "p2";
  damage: number;
  isCrit: boolean;
  hp1After: number;
  hp2After: number;
}

export interface FightResult {
  winner: "p1" | "p2";
  rounds: number;
  hp1Final: number;
  hp2Final: number;
  log: RoundLog[];
}

const STARTING_HP = 100;
const NUM_ROUNDS = 10;

// Simple deterministic hash-like mixer using LCG — good enough for client-side sim
function nextSeed(seed: number): number {
  // Mimics keccak chaining with a fast integer mixer
  // Using xorshift64-ish pattern on a 53-bit safe integer
  seed ^= seed << 13;
  seed ^= seed >> 7;
  seed ^= seed << 17;
  // Keep within 32-bit range to avoid float precision issues
  return (seed >>> 0);
}

function calcDamage(
  attacker: GladiatorStats,
  defender: GladiatorStats,
  seed: number
): { damage: number; isCrit: boolean; nextSeedVal: number } {
  const nextSeedVal = nextSeed(seed);
  let base =
    attacker.strength +
    Math.floor(attacker.intel / 2) -
    Math.floor(defender.defense / 2);
  if (base < 1) base = 1;

  const critThreshold = attacker.luck >= 5 ? 15 : 5;
  const roll = nextSeedVal % 100;
  const isCrit = roll < critThreshold;
  const damage = isCrit ? base * 2 : base;

  return { damage, isCrit, nextSeedVal };
}

export function simulateFight(
  g1: GladiatorStats,
  g2: GladiatorStats
): FightResult {
  let hp1 = STARTING_HP;
  let hp2 = STARTING_HP;
  const log: RoundLog[] = [];

  // Seed from Math.random() — client-side only, no chain required
  let seed = (Math.random() * 0xffffffff) >>> 0;

  let rounds = 0;

  for (let round = 0; round < NUM_ROUNDS; round++) {
    if (hp1 <= 0 || hp2 <= 0) {
      rounds = round;
      break;
    }

    // Higher speed attacks first; tie -> g1 goes first (matches contract)
    const g1First = g1.speed >= g2.speed;

    if (g1First) {
      // g1 attacks g2
      const r1 = calcDamage(g1, g2, seed);
      seed = r1.nextSeedVal;
      hp2 -= r1.damage;
      log.push({
        round: round + 1,
        attacker: "p1",
        damage: r1.damage,
        isCrit: r1.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
      });

      if (hp2 > 0) {
        // g2 retaliates
        const r2 = calcDamage(g2, g1, seed);
        seed = r2.nextSeedVal;
        hp1 -= r2.damage;
        log.push({
          round: round + 1,
          attacker: "p2",
          damage: r2.damage,
          isCrit: r2.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
        });
      }
    } else {
      // g2 attacks g1
      const r1 = calcDamage(g2, g1, seed);
      seed = r1.nextSeedVal;
      hp1 -= r1.damage;
      log.push({
        round: round + 1,
        attacker: "p2",
        damage: r1.damage,
        isCrit: r1.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
      });

      if (hp1 > 0) {
        // g1 retaliates
        const r2 = calcDamage(g1, g2, seed);
        seed = r2.nextSeedVal;
        hp2 -= r2.damage;
        log.push({
          round: round + 1,
          attacker: "p1",
          damage: r2.damage,
          isCrit: r2.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
        });
      }
    }

    rounds = round + 1;
  }

  // Determine winner
  const totalStats1 =
    g1.strength + g1.speed + g1.defense + g1.intel + g1.luck;
  const totalStats2 =
    g2.strength + g2.speed + g2.defense + g2.intel + g2.luck;

  let winner: "p1" | "p2";

  if (hp1 <= 0 && hp2 <= 0) {
    winner = totalStats1 >= totalStats2 ? "p1" : "p2";
  } else if (hp2 <= 0) {
    winner = "p1";
  } else if (hp1 <= 0) {
    winner = "p2";
  } else {
    // Time ran out — compare remaining HP then stats
    if (hp1 !== hp2) {
      winner = hp1 > hp2 ? "p1" : "p2";
    } else {
      winner = totalStats1 >= totalStats2 ? "p1" : "p2";
    }
  }

  return {
    winner,
    rounds,
    hp1Final: Math.max(hp1, 0),
    hp2Final: Math.max(hp2, 0),
    log,
  };
}
