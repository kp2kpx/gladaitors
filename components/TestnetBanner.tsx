import { isMainnet } from "@/lib/chain";

export default function TestnetBanner() {
  if (isMainnet) return null;

  return (
    <div
      role="status"
      className="w-full text-center text-xs font-bold uppercase tracking-widest py-2 px-4 shrink-0"
      style={{
        background: "#8b1a1a",
        color: "#fff",
        borderBottom: "1px solid #5c1010",
      }}
    >
      Base Sepolia Testnet only. No real funds.
    </div>
  );
}