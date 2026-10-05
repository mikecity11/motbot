"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  DynamicContextProvider,
  useDynamicContext,
  type EvmNetwork,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";

type SendRequest = {
  chainId: number;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
};
type MotWalletContextValue = {
  configured: boolean;
  address: string;
  source: "dynamic" | "browser" | null;
  open: () => void;
  disconnect: () => Promise<void>;
  sendTransaction: (request: SendRequest) => Promise<`0x${string}`>;
};
const unavailable: MotWalletContextValue = {
  configured: false,
  address: "",
  source: null,
  open: () => {},
  disconnect: async () => {},
  sendTransaction: async () => {
    throw Error("Dynamic wallet is not configured.");
  },
};
const MotWalletContext = createContext<MotWalletContextValue>(unavailable);

const monadMainnet: EvmNetwork = {
  chainId: 143,
  networkId: 143,
  name: "Monad Mainnet",
  vanityName: "Monad",
  iconUrls: [],
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://rpc.monad.xyz"],
  blockExplorerUrls: ["https://monadscan.com"],
};

type DashboardEvmNetwork = Omit<EvmNetwork, "chainId"> & {
  chainId: number | string;
};

const includeMonadMainnet = (networks: DashboardEvmNetwork[]) => [
  ...networks.filter((network) => Number(network.chainId) !== 143),
  monadMainnet,
];

function DynamicWalletBridge({ children }: { children: ReactNode }) {
  const { primaryWallet, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const sendTransaction = useCallback(
    async (request: SendRequest) => {
      if (!primaryWallet) throw Error("Sign in with Dynamic first.");
      if (primaryWallet.chain !== "EVM")
        throw Error("Select an EVM wallet in Dynamic.");
      await primaryWallet.connector.switchNetwork({
        networkChainId: request.chainId,
      });
      const client: any = await (
        primaryWallet.connector as any
      ).getWalletClient();
      const hash = await client.sendTransaction({
        account: primaryWallet.address as `0x${string}`,
        to: request.to,
        data: request.data,
        value: request.value,
      });
      if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash))
        throw Error("Dynamic did not return a transaction hash.");
      return hash as `0x${string}`;
    },
    [primaryWallet],
  );
  const disconnect = useCallback(async () => {
    await handleLogOut();
  }, [handleLogOut]);
  const value = useMemo<MotWalletContextValue>(
    () => ({
      configured: true,
      address: primaryWallet?.address ?? "",
      source: primaryWallet ? "dynamic" : null,
      open: () => setShowAuthFlow(true),
      disconnect,
      sendTransaction,
    }),
    [primaryWallet, setShowAuthFlow, disconnect, sendTransaction],
  );
  return (
    <MotWalletContext.Provider value={value}>
      {children}
    </MotWalletContext.Provider>
  );
}

export function MotWalletProvider({ children }: { children: ReactNode }) {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
  if (!environmentId)
    return (
      <MotWalletContext.Provider value={unavailable}>
        {children}
      </MotWalletContext.Provider>
    );
  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        appName: "MOTBOT",
        walletConnectors: [EthereumWalletConnectors],
        initialAuthenticationMode: "connect-and-sign",
        overrides: { evmNetworks: includeMonadMainnet },
        siweStatement:
          "Sign in to use MOTBOT across Monad. Every on-chain action still requires your confirmation.",
      }}
    >
      <DynamicWalletBridge>{children}</DynamicWalletBridge>
    </DynamicContextProvider>
  );
}

export const useMotWallet = () => useContext(MotWalletContext);
