import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

// No wallet connectors registered here — MiniKitProvider handles autoConnect
// via @farcaster/miniapp-wagmi-connector when running inside Warpcast/Farcaster.
// Contract reads/writes still go through wagmi, just no generic wallet UI.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
