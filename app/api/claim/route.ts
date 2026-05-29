import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// House wallet sponsors gas by calling claimFor(winner) on the contract.
// The house private key stays server-side and never touches the client.
const HOUSE_PRIVATE_KEY = process.env.HOUSE_PRIVATE_KEY as `0x${string}`;
const PIT_ARENA_ADDRESS = "0x152B456d83a20beC8aFf44e7c4f9CA4bd0f3e8a3" as const;

const CLAIM_ABI = parseAbi([
  "function claimFor(address winner) external",
  "function pendingWithdrawals(address) external view returns (uint256)",
]);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { winner } = body as { winner?: string };

    if (!winner || !/^0x[0-9a-fA-F]{40}$/.test(winner)) {
      return NextResponse.json({ error: "Invalid winner address" }, { status: 400 });
    }

    if (!HOUSE_PRIVATE_KEY) {
      return NextResponse.json({ error: "House key not configured" }, { status: 500 });
    }

    const winnerAddr = winner.toLowerCase() as `0x${string}`;

    // Check there's actually something to claim before burning gas
    const pending = await publicClient.readContract({
      address: PIT_ARENA_ADDRESS,
      abi: CLAIM_ABI,
      functionName: "pendingWithdrawals",
      args: [winnerAddr],
    });

    if (pending === 0n) {
      return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
    }

    const account = privateKeyToAccount(HOUSE_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    });

    const txHash = await walletClient.writeContract({
      address: PIT_ARENA_ADDRESS,
      abi: CLAIM_ABI,
      functionName: "claimFor",
      args: [winnerAddr],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 30_000,
    });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction reverted" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txHash,
      amount: pending.toString(),
    });
  } catch (err) {
    console.error("[/api/claim]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
