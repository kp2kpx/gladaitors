// TypeScript port of PitArena._simulateFight
// Mirrors the updated Solidity logic: 25-pt stats, new damage formula, speed-gap double-attacks.

export interface GladiatorStats {
  strength: number;
  speed: number;
  defense: number;
  intel: number;
  luck: number;
}

export interface RoundLog {
  round: number;
  // Which gladiator attacked
  attacker: "p1" | "p2";
  damage: number;
  isCrit: boolean;
  hp1After: number;
  hp2After: number;
  // New fields for replay
  attackedFirst: boolean;     // was this the first attack of the round?
  isDoubleAttack: boolean;    // was this the second hit from the faster gladiator?
  speedGap: number;           // absolute speed difference this round
}

export interface FightResult {
  winner: "p1" | "p2";
  rounds: number;
  hp1Final: number;
  hp2Final: number;
  log: RoundLog[];
  // Summary stats for post-fight display
  totalDamageByP1: number;
  totalDamageByP2: number;
  critsP1: number;
  critsP2: number;
}

const STARTING_HP = 100;

// Simple deterministic hash-like mixer using xorshift — good enough for client-side sim
function nextSeed(seed: number): number {
  seed ^= seed << 13;
  seed ^= seed >> 7;
  seed ^= seed << 17;
  return seed >>> 0;
}

function calcDamage(
  attacker: GladiatorStats,
  defender: GladiatorStats,
  seed: number
): { damage: number; isCrit: boolean; nextSeedVal: number } {
  const nextSeedVal = nextSeed(seed);

  // Effective DEF = max(0, defender.DEF - attacker.INT)
  const effectiveDef = Math.max(0, defender.defense - attacker.intel);

  // Damage = max(1, STR - effectiveDef)
  let base = Math.max(1, attacker.strength - effectiveDef);

  // Crit chance = floor(LCK / 2) * 10%
  const critChancePct = Math.floor(attacker.luck / 2) * 10;
  const roll = nextSeedVal % 100;
  const isCrit = roll < critChancePct;
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

  let seed = (Math.random() * 0xffffffff) >>> 0;

  let rounds = 0;
  let totalDamageByP1 = 0;
  let totalDamageByP2 = 0;
  let critsP1 = 0;
  let critsP2 = 0;

  const speedGap = Math.abs(g1.speed - g2.speed);
  const g1Faster = g1.speed > g2.speed;
  const tied = g1.speed === g2.speed;
  const doubleAttack = speedGap >= 3;

  let round = 0;
  // Fight runs until one (or both) gladiators reach 0 HP — no turn cap.
  while (hp1 > 0 && hp2 > 0) {
    round++;

    if (tied) {
      // Simultaneous — both take damage this exchange.
      // Track raw HP after damage (before clamping) for tiebreak.
      const r1 = calcDamage(g1, g2, seed);
      seed = r1.nextSeedVal;
      const r2 = calcDamage(g2, g1, seed);
      seed = r2.nextSeedVal;

      hp2 -= r1.damage;
      hp1 -= r2.damage;

      totalDamageByP1 += r1.damage;
      totalDamageByP2 += r2.damage;
      if (r1.isCrit) critsP1++;
      if (r2.isCrit) critsP2++;

      log.push({
        round,
        attacker: "p1",
        damage: r1.damage,
        isCrit: r1.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
        attackedFirst: true,
        isDoubleAttack: false,
        speedGap,
      });
      log.push({
        round,
        attacker: "p2",
        damage: r2.damage,
        isCrit: r2.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
        attackedFirst: true,
        isDoubleAttack: false,
        speedGap,
      });
    } else if (g1Faster) {
      // g1 strikes first
      const r1 = calcDamage(g1, g2, seed);
      seed = r1.nextSeedVal;
      hp2 -= r1.damage;
      totalDamageByP1 += r1.damage;
      if (r1.isCrit) critsP1++;

      log.push({
        round,
        attacker: "p1",
        damage: r1.damage,
        isCrit: r1.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
        attackedFirst: true,
        isDoubleAttack: false,
        speedGap,
      });

      if (hp2 > 0) {
        // g2 retaliates
        const r2 = calcDamage(g2, g1, seed);
        seed = r2.nextSeedVal;
        hp1 -= r2.damage;
        totalDamageByP2 += r2.damage;
        if (r2.isCrit) critsP2++;

        log.push({
          round,
          attacker: "p2",
          damage: r2.damage,
          isCrit: r2.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
          attackedFirst: false,
          isDoubleAttack: false,
          speedGap,
        });

        if (doubleAttack && hp1 > 0) {
          // g1 strikes again (double attack bonus)
          const r3 = calcDamage(g1, g2, seed);
          seed = r3.nextSeedVal;
          hp2 -= r3.damage;
          totalDamageByP1 += r3.damage;
          if (r3.isCrit) critsP1++;

          log.push({
            round,
            attacker: "p1",
            damage: r3.damage,
            isCrit: r3.isCrit,
            hp1After: Math.max(hp1, 0),
            hp2After: Math.max(hp2, 0),
            attackedFirst: false,
            isDoubleAttack: true,
            speedGap,
          });
        }
      }
    } else {
      // g2 is faster (g2Faster is true — covered by while condition eliminating tied)
      const r1 = calcDamage(g2, g1, seed);
      seed = r1.nextSeedVal;
      hp1 -= r1.damage;
      totalDamageByP2 += r1.damage;
      if (r1.isCrit) critsP2++;

      log.push({
        round,
        attacker: "p2",
        damage: r1.damage,
        isCrit: r1.isCrit,
        hp1After: Math.max(hp1, 0),
        hp2After: Math.max(hp2, 0),
        attackedFirst: true,
        isDoubleAttack: false,
        speedGap,
      });

      if (hp1 > 0) {
        // g1 retaliates
        const r2 = calcDamage(g1, g2, seed);
        seed = r2.nextSeedVal;
        hp2 -= r2.damage;
        totalDamageByP1 += r2.damage;
        if (r2.isCrit) critsP1++;

        log.push({
          round,
          attacker: "p1",
          damage: r2.damage,
          isCrit: r2.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
          attackedFirst: false,
          isDoubleAttack: false,
          speedGap,
        });

        if (doubleAttack && hp2 > 0) {
          // g2 strikes again (double attack bonus)
          const r3 = calcDamage(g2, g1, seed);
          seed = r3.nextSeedVal;
          hp1 -= r3.damage;
          totalDamageByP2 += r3.damage;
          if (r3.isCrit) critsP2++;

          log.push({
            round,
            attacker: "p2",
            damage: r3.damage,
            isCrit: r3.isCrit,
            hp1After: Math.max(hp1, 0),
            hp2After: Math.max(hp2, 0),
            attackedFirst: false,
            isDoubleAttack: true,
            speedGap,
          });
        }
      }
    }
  }

  rounds = round;

  // Determine winner.
  // Both can reach 0 on the same exchange (simultaneous speed-tied hits).
  // Tiebreak: lower raw HP (more negative) loses. Exact tie → p1 (attacker/initiator) loses.
  let winner: "p1" | "p2";

  if (hp1 <= 0 && hp2 <= 0) {
    // Both dead this exchange — whoever has lower HP (more overkill) is the loser.
    // If exactly equal, p1 loses (consistent tiebreak: initiator loses the draw).
    winner = hp2 < hp1 ? "p1" : "p2";
  } else if (hp2 <= 0) {
    winner = "p1";
  } else {
    // hp1 <= 0, hp2 > 0
    winner = "p2";
  }

  return {
    winner,
    rounds,
    hp1Final: Math.max(hp1, 0),
    hp2Final: Math.max(hp2, 0),
    log,
    totalDamageByP1,
    totalDamageByP2,
    critsP1,
    critsP2,
  };
}
