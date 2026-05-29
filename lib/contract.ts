// PitArena contract config — deployed on Base Sepolia
// v2: pull-payment model with claimWinnings() / claimFor()
export const PIT_ARENA_ADDRESS = "0xF0FD952101E4082Bdcf3e364abFd102312d083ef" as const;

export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const HOUSE_ADDRESS = "0x96DB9B3E56b2EE4E58c21c41a1F93Ae7B7b73B2F" as const;

export const PIT_ARENA_ABI = [
  // Read
  {
    inputs: [{ internalType: "uint256", name: "matchId", type: "uint256" }],
    name: "getMatch",
    outputs: [
      { internalType: "address", name: "player1", type: "address" },
      { internalType: "address", name: "player2", type: "address" },
      { internalType: "uint256", name: "betAmount", type: "uint256" },
      { internalType: "uint8", name: "state", type: "uint8" },
      { internalType: "address", name: "winner", type: "address" },
      { internalType: "bool", name: "gladiator1Submitted", type: "bool" },
      { internalType: "bool", name: "gladiator2Submitted", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "bool", name: "isPlayer1", type: "bool" },
    ],
    name: "getGladiator",
    outputs: [
      { internalType: "uint8", name: "strength", type: "uint8" },
      { internalType: "uint8", name: "speed", type: "uint8" },
      { internalType: "uint8", name: "defense", type: "uint8" },
      { internalType: "uint8", name: "intel", type: "uint8" },
      { internalType: "uint8", name: "luck", type: "uint8" },
      { internalType: "bool", name: "submitted", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getOpenMatches",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "matchCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "pendingWithdrawals",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Write
  {
    inputs: [{ internalType: "uint256", name: "betAmount", type: "uint256" }],
    name: "createMatch",
    outputs: [{ internalType: "uint256", name: "matchId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "matchId", type: "uint256" }],
    name: "joinMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "uint8[5]", name: "stats", type: "uint8[5]" },
    ],
    name: "submitGladiator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "matchId", type: "uint256" }],
    name: "resolveFight",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    // Self-claim — winner pays their own gas
    inputs: [],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    // House-sponsored claim — only HOUSE address can call, gas paid by house
    inputs: [{ internalType: "address", name: "winner", type: "address" }],
    name: "claimFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "matchId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player1", type: "address" },
      { indexed: false, internalType: "uint256", name: "betAmount", type: "uint256" },
    ],
    name: "MatchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "matchId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player2", type: "address" },
    ],
    name: "MatchJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "matchId", type: "uint256" },
      { indexed: true, internalType: "address", name: "winner", type: "address" },
      { indexed: false, internalType: "uint8", name: "rounds", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "winnerPayout", type: "uint256" },
    ],
    name: "FightResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "winner", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "WinningsClaimed",
    type: "event",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Match state enum matching contract
export enum MatchState {
  WaitingForOpponent = 0,
  WaitingForGladiators = 1,
  Fighting = 2,
  Resolved = 3,
}

export type GladiatorStats = {
  strength: number;
  speed: number;
  defense: number;
  intel: number;
  luck: number;
};

export const STAT_LABELS: (keyof GladiatorStats)[] = [
  "strength",
  "speed",
  "defense",
  "intel",
  "luck",
];

export const STAT_DESCRIPTIONS: Record<keyof GladiatorStats, string> = {
  strength: "Attack damage",
  speed: "Attack order",
  defense: "Damage reduction",
  intel: "Bonus damage",
  luck: "Crit chance",
};

export const TOTAL_POINTS = 25;
export const MAX_STAT = 10;
export const MIN_STAT = 1;
