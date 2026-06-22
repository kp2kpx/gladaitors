import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { farcasterMiniAppAsync } from "./farcaster-connector";

// Custom Farcaster connector registered here. MiniKitProvider has autoConnect=false;
// useFarcasterAuth calls connect() explicitly after MiniKit context resolves.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [farcasterMiniAppAsync()],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});