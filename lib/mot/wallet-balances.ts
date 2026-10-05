import { createPublicClient, formatUnits, http } from "viem";

const MONAD_RPC = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
const NATIVE = "0x0000000000000000000000000000000000000000";
const MAX_TOKENS = 12;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

type RegistryToken = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
};

export type WalletBalance = RegistryToken & {
  raw: string;
  formatted: string;
  value: number;
  native: boolean;
};

function validToken(value: any): RegistryToken | null {
  if (
    !value ||
    typeof value.symbol !== "string" ||
    !/^[A-Za-z0-9]{2,12}$/.test(value.symbol) ||
    typeof value.name !== "string" ||
    value.name.length > 80 ||
    !/^0x[a-fA-F0-9]{40}$/.test(value.address) ||
    !Number.isInteger(value.decimals) ||
    value.decimals < 0 ||
    value.decimals > 36
  )
    return null;
  return {
    symbol: value.symbol.toUpperCase(),
    name: value.name,
    address: value.address,
    decimals: value.decimals,
  };
}

async function relayTokens(): Promise<RegistryToken[]> {
  const response = await fetch("https://api.relay.link/chains", {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data?.chains)) return [];
  const chain = data.chains.find((item: any) => item?.id === 143);
  return [chain?.currency, ...(chain?.featuredTokens || [])]
    .map(validToken)
    .filter((token: RegistryToken | null): token is RegistryToken => !!token);
}

async function kuruTokens(): Promise<RegistryToken[]> {
  const response = await fetch("https://exchange.kuru.io/api/v3/exchangeInfo", {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data?.symbols)) return [];
  return data.symbols
    .filter((market: any) => market?.status === "TRADING")
    .flatMap((market: any) => [
      {
        symbol: market.baseAsset,
        name: market.baseAsset,
        address: market.baseAssetAddress,
        decimals: market.baseAssetPrecision,
      },
      {
        symbol: market.quoteAsset,
        name: market.quoteAsset,
        address: market.quoteAssetAddress,
        decimals: market.quoteAssetPrecision,
      },
    ])
    .map(validToken)
    .filter((token: RegistryToken | null): token is RegistryToken => !!token);
}

async function registry(): Promise<RegistryToken[]> {
  const fallback = validToken({
    symbol: "USDC",
    name: "USD Coin",
    address: "0x754704bc059f8c67012fed69bc8a327a5aafb603",
    decimals: 6,
  })!;
  const [relay, kuru] = await Promise.all([
    relayTokens().catch(() => []),
    kuruTokens().catch(() => []),
  ]);
  const tokens = new Map<string, RegistryToken>();
  for (const token of [...relay, ...kuru, fallback])
    if (token.address.toLowerCase() !== NATIVE)
      tokens.set(token.address.toLowerCase(), token);
  return [...tokens.values()].slice(0, MAX_TOKENS);
}

function display(raw: bigint, decimals: number) {
  const formatted = formatUnits(raw, decimals);
  const value = Number(formatted);
  return {
    raw: raw.toString(),
    formatted,
    value: Number.isFinite(value) ? value : 0,
  };
}

export async function getMonadWalletBalances(
  walletAddress: string,
): Promise<WalletBalance[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress))
    throw Error("Connect a valid wallet first.");
  const account = walletAddress as `0x${string}`;
  const client = createPublicClient({
    transport: http(MONAD_RPC, { timeout: 10000 }),
  });
  const tokens = await registry();
  const [native, tokenResults] = await Promise.all([
    client.getBalance({ address: account }),
    Promise.allSettled(
      tokens.map((token) =>
        client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [account] as const,
        }),
      ),
    ),
  ]);
  const balances: WalletBalance[] = [
    {
      symbol: "MON",
      name: "Monad",
      address: NATIVE,
      decimals: 18,
      ...display(native, 18),
      native: true,
    },
  ];
  tokenResults.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    balances.push({
      ...tokens[index],
      ...display(result.value, tokens[index].decimals),
      native: false,
    });
  });
  return balances;
}

export function asksWalletBalance(message: string) {
  return (
    /\b(balance|balances|hold|holding|assets?|tokens?|have in my wallet)\b/i.test(
      message,
    ) &&
    /\b(my|wallet|mon|monad|usdc|wmon|weth|wbtc|cbbtc|ausd|xaut)\b/i.test(
      message,
    )
  ) || /\bhow much\s+(?:mon|usdc|wmon|weth|wbtc|cbbtc|ausd|xaut)\s+do i have\b/i.test(message);
}

export function walletBalanceReply(
  message: string,
  balances: WalletBalance[],
) {
  const requested = balances.find(
    (balance) =>
      new RegExp(`\\b${balance.symbol.toLowerCase()}\\b`, "i").test(message) &&
      !/\b(all|tokens|assets|everything)\b/i.test(message),
  );
  if (requested)
    return `Your connected wallet has ${Number(requested.formatted).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${requested.symbol} on Monad mainnet. Source: Monad RPC.`;
  const visible = balances.filter((balance) => balance.native || balance.value > 0);
  return `Your connected wallet balances on Monad mainnet:\n${visible
    .map(
      (balance) =>
        `• ${balance.symbol}: ${Number(balance.formatted).toLocaleString("en-US", { maximumFractionDigits: 8 })}`,
    )
    .join("\n")}\nSource: Monad RPC. Zero-balance tokens are hidden.`;
}
