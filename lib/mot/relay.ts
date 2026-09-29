import { z } from "zod";

const NATIVE = "0x0000000000000000000000000000000000000000";
const MONAD_CHAIN_ID = 143;
const chainAliases: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  base: "base",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  polygon: "polygon",
  matic: "polygon",
  bsc: "bsc",
  binance: "bsc",
  avalanche: "avalanche",
  avax: "avalanche",
  linea: "linea",
  zksync: "zksync",
  scroll: "scroll",
  mode: "mode",
  blast: "blast",
};

export const relayQuoteInputSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().finite().positive().max(1_000_000_000),
  tokenSymbol: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,12}$/),
  originChain: z.string().trim().min(2).max(40),
});
export type RelayTransaction = {
  step: "approve" | "deposit" | "transaction";
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
};
export type RelayCandidate = {
  requestId: string;
  amount: number;
  tokenSymbol: string;
  originChainId: number;
  originChainName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  quotedAt: number;
  transactions: RelayTransaction[];
};
export type RelayQuote = {
  requestId: string;
  amountIn: number;
  amountOut: number;
  minimumOut: number;
  inputSymbol: string;
  outputSymbol: string;
  originChain: string;
  destinationChain: "Monad";
  amountInUsd: number | null;
  amountOutUsd: number | null;
  impactPercent: number | null;
  estimatedSeconds: number | null;
  source: "Relay quote";
  candidate?: RelayCandidate;
};
type RelayCurrency = {
  name?: string;
  symbol: string;
  address: string;
  decimals: number;
  supportsBridging?: boolean;
};
type RelayChain = {
  id: number;
  name: string;
  displayName: string;
  disabled?: boolean;
  httpRpcUrl?: string;
  explorerUrl?: string;
  currency: RelayCurrency;
  featuredTokens?: RelayCurrency[];
};

function units(amount: number, decimals: number) {
  const precision = Math.min(decimals, 9);
  const scaled = BigInt(Math.round(amount * 10 ** precision));
  return (scaled * BigInt(10) ** BigInt(decimals - precision)).toString();
}
function formatted(raw: unknown, decimals: number) {
  const value = String(raw ?? "0").replace(/\D/g, "") || "0";
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, "") : "";
  return Number(fraction ? `${whole}.${fraction}` : whole);
}
async function relayChains(): Promise<RelayChain[]> {
  const response = await fetch("https://api.relay.link/chains", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data?.chains))
    throw Error("Relay network metadata is unavailable.");
  return data.chains;
}
function findToken(chain: RelayChain, symbol: string) {
  const wanted = symbol.toUpperCase();
  return [chain.currency, ...(chain.featuredTokens || [])].find(
    (token) => token.symbol.toUpperCase() === wanted,
  );
}

export async function getRelayQuote(
  input: z.infer<typeof relayQuoteInputSchema>,
): Promise<RelayQuote> {
  const value = relayQuoteInputSchema.parse(input);
  const chains = await relayChains();
  const alias =
    chainAliases[value.originChain.toLowerCase()] ||
    value.originChain.toLowerCase();
  const origin = chains.find(
    (chain) =>
      !chain.disabled &&
      (chain.name.toLowerCase() === alias ||
        chain.displayName.toLowerCase() === alias),
  );
  const destination = chains.find(
    (chain) => chain.id === MONAD_CHAIN_ID && !chain.disabled,
  );
  if (!origin)
    throw Error(
      `${value.originChain} is not currently available through Relay.`,
    );
  if (!destination)
    throw Error("Monad is not currently available through Relay.");
  const inputCurrency = findToken(origin, value.tokenSymbol);
  if (!inputCurrency)
    throw Error(
      `${value.tokenSymbol.toUpperCase()} is not listed by Relay on ${origin.displayName}.`,
    );
  const outputCurrency =
    findToken(destination, value.tokenSymbol) ||
    (inputCurrency.address.toLowerCase() === NATIVE
      ? destination.currency
      : null);
  if (!outputCurrency)
    throw Error(
      `${value.tokenSymbol.toUpperCase()} is not listed by Relay on Monad.`,
    );
  const response = await fetch("https://api.relay.link/quote", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      user: value.walletAddress,
      recipient: value.walletAddress,
      originChainId: origin.id,
      destinationChainId: MONAD_CHAIN_ID,
      originCurrency: inputCurrency.address,
      destinationCurrency: outputCurrency.address,
      amount: units(value.amount, inputCurrency.decimals),
      tradeType: "EXACT_INPUT",
    }),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !data?.details?.currencyOut)
    throw Error(
      data?.message ||
        `Relay could not find that ${inputCurrency.symbol} route.`,
    );
  const inputDetails = data.details.currencyIn;
  const output = data.details.currencyOut;
  const transactions: RelayTransaction[] = (
    Array.isArray(data.steps) ? data.steps : []
  )
    .flatMap((step: any) =>
      step?.kind === "transaction" && Array.isArray(step.items)
        ? step.items.map((item: any) => ({
            step:
              step.id === "approve"
                ? "approve"
                : step.id === "deposit"
                  ? "deposit"
                  : "transaction",
            to: item?.data?.to,
            data: item?.data?.data,
            value: String(item?.data?.value ?? "0"),
            chainId: item?.data?.chainId,
            from: item?.data?.from,
          }))
        : [],
    )
    .filter(
      (tx: any) =>
        tx.chainId === origin.id &&
        typeof tx.from === "string" &&
        tx.from.toLowerCase() === value.walletAddress.toLowerCase() &&
        /^0x[a-fA-F0-9]{40}$/.test(tx.to) &&
        /^0x(?:[a-fA-F0-9]{2})*$/.test(tx.data) &&
        /^\d{1,80}$/.test(tx.value),
    )
    .slice(0, 4)
    .map(({ step, to, data, value }: any) => ({ step, to, data, value }));
  const requestId = String(data.requestId || "");
  const candidate =
    transactions.length &&
    transactions.some((tx) => tx.step === "deposit") &&
    /^0x[a-fA-F0-9]{64}$/.test(requestId) &&
    origin.httpRpcUrl
      ? {
          requestId,
          amount: value.amount,
          tokenSymbol: inputCurrency.symbol.toUpperCase(),
          originChainId: origin.id,
          originChainName: origin.displayName,
          rpcUrl: origin.httpRpcUrl,
          explorerUrl: origin.explorerUrl || "",
          nativeCurrency: {
            name: origin.currency.name || origin.currency.symbol,
            symbol: origin.currency.symbol,
            decimals: origin.currency.decimals,
          },
          quotedAt: Date.now(),
          transactions,
        }
      : undefined;
  return {
    requestId,
    amountIn: Number(inputDetails.amountFormatted),
    amountOut: Number(output.amountFormatted),
    minimumOut: Number.isFinite(Number(output.minimumAmountFormatted))
      ? Number(output.minimumAmountFormatted)
      : formatted(output.minimumAmount, outputCurrency.decimals),
    inputSymbol: inputCurrency.symbol.toUpperCase(),
    outputSymbol: outputCurrency.symbol.toUpperCase(),
    originChain: origin.displayName,
    destinationChain: "Monad",
    amountInUsd: Number.isFinite(Number(inputDetails.amountUsd))
      ? Number(inputDetails.amountUsd)
      : null,
    amountOutUsd: Number.isFinite(Number(output.amountUsd))
      ? Number(output.amountUsd)
      : null,
    impactPercent: Number.isFinite(Number(data.details.totalImpact?.percent))
      ? Number(data.details.totalImpact.percent)
      : null,
    estimatedSeconds: Number.isFinite(Number(data.details.timeEstimate))
      ? Number(data.details.timeEstimate)
      : null,
    source: "Relay quote",
    candidate,
  };
}
