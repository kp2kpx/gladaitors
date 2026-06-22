// Custom Farcaster Mini App wagmi connector.
//
// WHY THIS EXISTS:
// @farcaster/miniapp-wagmi-connector v1.1.1 has getProvider() hardcoded to
// MiniAppSDK.wallet.ethProvider — a deprecated static getter that returns
// undefined on farcaster.xyz web browser (GitHub issue #534). When wagmi
// calls connect() it hits this broken getter → eth_requestAccounts fails →
// no wallet address.
//
// The async replacement is sdk.wallet.getEthereumProvider() which properly
// capability-checks the host and resolves the provider. This connector is
// structurally identical to the package version but uses the async getter
// and caches the result so repeat calls are cheap.
//
// ISSUE #570 HANDLING:
// On farcaster.xyz desktop, eth_requestAccounts triggers a modal that
// auto-dismisses in ~1-2s. We do NOT auto-trigger eth_requestAccounts on
// mount. Instead our useFarcasterAuth hook calls connect() explicitly after
// sdk.context resolves — triggered promptly but on context resolution, not
// an arbitrary mount. If Farcaster fixes #570, no changes needed here.

/* eslint-disable @typescript-eslint/no-explicit-any */

import sdk from "@farcaster/miniapp-sdk";
import { ChainNotConfiguredError, createConnector } from "@wagmi/core";
import { fromHex, getAddress, numberToHex, SwitchChainError } from "viem";

// Typed as any — ox/Provider version differs between miniapp-sdk and
// miniapp-wagmi-connector, causing irreconcilable generic conflicts if typed
// strictly. The provider is effectively a JSON-RPC call surface.
type AnyProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
};

// Cached provider — resolved once per session, reused on repeat calls.
let _cachedProvider: AnyProvider | null = null;

async function resolveProvider(): Promise<AnyProvider> {
  if (_cachedProvider) return _cachedProvider;
  const raw = await sdk.wallet.getEthereumProvider();
  if (!raw) throw new Error("[gladaitors] host does not support wallet.getEthereumProvider");
  _cachedProvider = raw as unknown as AnyProvider;
  return _cachedProvider;
}

// Module-level event handler refs (mirrors the package connector pattern).
let accountsChangedHandler: ((accounts: string[]) => void) | undefined;
let chainChangedHandler: ((chain: string) => void) | undefined;
let disconnectHandler: (() => void) | undefined;

export const FARCASTER_CONNECTOR_TYPE = "farcasterMiniApp";

export function farcasterMiniAppAsync() {
  return createConnector((config) => ({
    id: "farcaster",
    name: "Farcaster",
    rdns: "xyz.farcaster.MiniAppWallet",
    icon: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/055c25d6-7fe7-4a49-abf9-49772021cf00/original",
    type: FARCASTER_CONNECTOR_TYPE,

    // getProvider() must be present for wagmi but we delegate to resolveProvider().
    // Return type `any` avoids ox/Provider version mismatch errors.
    async getProvider(): Promise<any> {
      return resolveProvider();
    },

    async connect(parameters?: { chainId?: number; isReconnecting?: boolean }) {
      const provider = await resolveProvider();
      const chainId = parameters?.chainId;

      console.log("[gladaitors] farcasterMiniAppAsync: calling eth_requestAccounts");
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });

      let targetChainId = chainId;
      if (!targetChainId) {
        const state = ((await (config.storage as any)?.getItem("state")) ?? {}) as { chainId?: number };
        const isChainSupported = config.chains.some((x) => x.id === state.chainId);
        if (isChainSupported) targetChainId = state.chainId;
        else targetChainId = config.chains[0]?.id;
      }
      if (!targetChainId) throw new Error("No chains found on connector.");

      if (!accountsChangedHandler) {
        accountsChangedHandler = (a: string[]) => this.onAccountsChanged(a);
        provider.on("accountsChanged", accountsChangedHandler);
      }
      if (!chainChangedHandler) {
        chainChangedHandler = (c: string) => this.onChainChanged(c);
        provider.on("chainChanged", chainChangedHandler);
      }
      if (!disconnectHandler) {
        disconnectHandler = () => this.onDisconnect();
        provider.on("disconnect", disconnectHandler);
      }

      let currentChainId = await this.getChainId();
      if (targetChainId && currentChainId !== targetChainId) {
        const chain = await this.switchChain({ chainId: targetChainId });
        currentChainId = chain.id;
      }

      return {
        accounts: accounts.map((x) => getAddress(x)) as readonly `0x${string}`[],
        chainId: currentChainId,
      } as any; // satisfies withCapabilities generic constraint
    },

    async disconnect() {
      const provider = await resolveProvider().catch(() => null);
      if (provider) {
        if (accountsChangedHandler) {
          provider.removeListener("accountsChanged", accountsChangedHandler);
          accountsChangedHandler = undefined;
        }
        if (chainChangedHandler) {
          provider.removeListener("chainChanged", chainChangedHandler);
          chainChangedHandler = undefined;
        }
        if (disconnectHandler) {
          provider.removeListener("disconnect", disconnectHandler);
          disconnectHandler = undefined;
        }
      }
      _cachedProvider = null;
    },

    async getAccounts(): Promise<readonly `0x${string}`[]> {
      const provider = await resolveProvider();
      const accounts: string[] = await provider.request({ method: "eth_accounts" });
      return accounts.map((x) => getAddress(x));
    },

    async getChainId(): Promise<number> {
      const provider = await resolveProvider();
      const hexChainId: string = await provider.request({ method: "eth_chainId" });
      return fromHex(hexChainId as `0x${string}`, "number");
    },

    async isAuthorized(): Promise<boolean> {
      try {
        const accounts = await this.getAccounts();
        return !!accounts.length;
      } catch {
        return false;
      }
    },

    async switchChain({ chainId }: { chainId: number }) {
      const provider = await resolveProvider();
      const chain = config.chains.find((x) => x.id === chainId);
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(chainId) }],
      });
      // Explicitly emit change event — providers on some hosts don't emit events yet.
      config.emitter.emit("change", { chainId });
      return chain;
    },

    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        this.onDisconnect();
      } else {
        config.emitter.emit("change", {
          accounts: accounts.map((x) => getAddress(x)),
        });
      }
    },

    onChainChanged(chain: string) {
      const chainId = Number(chain);
      config.emitter.emit("change", { chainId });
    },

    async onDisconnect() {
      config.emitter.emit("disconnect");
    },
  }));
}

// Same type string as the package connector — MiniKitProvider's AutoConnect
// looks for this type when scanning connectors.
farcasterMiniAppAsync.type = FARCASTER_CONNECTOR_TYPE;
