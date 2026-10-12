import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decodeTradingContext } from "@/lib/mot/perpl-orders";
import { PERPL_NETWORKS } from "@/lib/mot/perpl-session";
import { getMarkets } from "@/lib/mot/markets";
import {
  getKuruMonUsdc,
  parseKuruSwap,
  prepareKuruMonSell,
} from "@/lib/mot/kuru";
import { parseUniswapSwap, prepareUniswapMonSell } from "@/lib/mot/uniswap";
import { getRelayQuote } from "@/lib/mot/relay";
import {
  chatInputSchema,
  builtInReply,
  kuruBuiltInReply,
  relayBuiltInReply,
  inputContainsPotentialCredential,
  executableTradeCandidate,
  parseExplicitOpening,
  parsePerplAction,
  renderAiReply,
} from "@/lib/mot/chat-core";
import {
  aiConfigured,
  aiPersistenceConfigured,
  DEFAULT_AI_MODEL,
  generateMotReply,
} from "@/lib/mot/ai-model";
import {
  reserveGeneration,
  completeGeneration,
  failGeneration,
  sessionHash,
} from "@/lib/mot/ai-storage";
import { envioConfigured } from "@/lib/mot/envio";
import {
  asksWalletBalance,
  getMonadWalletBalances,
  walletBalanceReply,
} from "@/lib/mot/wallet-balances";
export const maxDuration = 60;
const response = (reply: string, mode = "preview", status = 200, extra = {}) =>
  NextResponse.json(
    { reply, executed: false, mode, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function GET() {
  return NextResponse.json(
    {
      aiConfigured: aiConfigured(),
      envioConfigured: envioConfigured(),
      dynamicConfigured: Boolean(
        process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
      ),
      executionEnabled: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return response("Please send a JSON message.", "preview", 415);
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return response(
      "Use MOTBOT’s own website to send messages.",
      "preview",
      403,
    );
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return response("Could not read the message.", "preview", 400);
  }
  if (raw.length > 24000)
    return response(
      "That conversation is too long. Start a shorter conversation.",
      "preview",
      413,
    );
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return response("Please send a valid message.", "preview", 400);
  }
  const parsed = chatInputSchema.safeParse(data);
  if (!parsed.success)
    return response(
      "Please use a message of 1–3,000 characters and valid trading preferences.",
      "preview",
      400,
    );
  const input = parsed.data;
  if (inputContainsPotentialCredential(input))
    return response(
      "Do not share API secrets, tokens, wallet private keys, or seed phrases in chat. Use the PERPL setup panel. This message was not sent to an AI provider or saved.",
      "preview",
      400,
    );
  if (asksWalletBalance(input.message)) {
    if (!input.walletAddress)
      return response(
        "Connect your wallet first so MOT can read its public balances on Monad. No approval or signature is required.",
        "wallet_balances",
      );
    try {
      const balances = await getMonadWalletBalances(input.walletAddress);
      return response(
        walletBalanceReply(input.message, balances),
        "wallet_balances",
        200,
        { walletBalances: balances },
      );
    } catch {
      return response(
        "Monad wallet balances are temporarily unavailable. No balance was estimated.",
        "wallet_balances",
        503,
      );
    }
  }
  const uniswapSwap = parseUniswapSwap(input.message);
  if (uniswapSwap) {
    if (!input.walletAddress)
      return response(
        "Connect your wallet first so MOT can prepare the Uniswap swap for your address. No transaction was created.",
        "uniswap_swap",
      );
    try {
      const candidate = await prepareUniswapMonSell(
        input.walletAddress as `0x${string}`,
        uniswapSwap,
      );
      const summary=candidate.direction==='MON_TO_USDC'
        ? `${candidate.amountInMon.toLocaleString()} MON → approximately ${candidate.expectedOutUsdc.toFixed(6)} USDC. Minimum received: ${candidate.minimumOutUsdc.toFixed(6)} USDC`
        : `${candidate.amountInUsdc.toLocaleString()} USDC → approximately ${candidate.expectedOutMon.toFixed(6)} MON. Minimum received: ${candidate.minimumOutMon.toFixed(6)} MON. This direction requires one exact USDC approval followed by the swap`;
      return response(
        `Uniswap swap ready: ${summary} with ${(candidate.slippageBps / 100).toFixed(2)}% slippage. This quote expires in 10 minutes. Review and confirm in your wallet; this uses Monad mainnet and real funds.`,
        "uniswap_swap",
        200,
        { uniswapCandidate: candidate },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Uniswap could not prepare this swap.";
      return response(
        `${message} No transaction was submitted.`,
        "uniswap_swap",
        400,
      );
    }
  }
  const kuruSwap = parseKuruSwap(input.message);
  if (kuruSwap) {
    if (!input.walletAddress)
      return response(
        "Connect your wallet first so MOT can simulate the Kuru swap for your address. No transaction was created.",
        "kuru_swap",
      );
    try {
      const candidate = await prepareKuruMonSell(
        input.walletAddress as `0x${string}`,
        kuruSwap,
      );
      return response(
        `Kuru swap ready: ${candidate.amountInMon.toLocaleString()} MON → approximately ${candidate.expectedOutUsdc.toFixed(6)} USDC. Minimum received: ${candidate.minimumOutUsdc.toFixed(6)} USDC with ${(candidate.slippageBps / 100).toFixed(2)}% slippage. Review and confirm in your wallet; this uses Monad mainnet and real funds.`,
        "kuru_swap",
        200,
        { kuruCandidate: candidate },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kuru could not prepare this swap.";
      return response(
        `${message} No transaction was submitted.`,
        "kuru_swap",
        400,
      );
    }
  }
  const kuruReply = await kuruBuiltInReply(input, getKuruMonUsdc);
  if (kuruReply) return response(kuruReply, "kuru_data");
  let relayQuote: Awaited<ReturnType<typeof getRelayQuote>> | undefined;
  const relayReply = await relayBuiltInReply(
    input,
    async (value) => (relayQuote = await getRelayQuote(value)),
  );
  if (relayReply)
    return response(relayReply, "relay_quote", 200, {
      relayCandidate: relayQuote?.candidate,
    });
  const missingSide = input.message.trim().match(/^(?:set|place|open) (?:a )?limit order (?:for )?([A-Za-z0-9._-]{1,24}) at \$?([\d,]+(?:\.\d+)?) (?:with|using) \$(\d+(?:\.\d+)?) at (\d+(?:\.\d+)?)x(?: leverage)?[.!?]?$/i);
  if (missingSide) return response(`Do you want a long or short ${missingSide[1].toUpperCase()} limit order? Please resend with the direction, for example: “set a limit order for ${missingSide[1].toUpperCase()} long at ${missingSide[2]} with $${missingSide[3]} at ${missingSide[4]}x leverage”. No order was submitted.`, 'preview');
  const action = parsePerplAction(input.message);
  if (action) {
    if (!input.perpl.verified) return response('Connect and verify your PERPL API session first. No order was submitted.', 'preview');
    if (!action.action && ((action.limitPrice !== undefined && (!Number.isFinite(action.limitPrice) || action.limitPrice <= 0)) || action.marginUSD <= 0 || action.leverage <= 0 || action.marginUSD > Math.min(input.settings.maxMargin, input.settings.totalMargin) || action.leverage > input.settings.maxLeverage)) return response('This limit instruction is invalid or exceeds your saved trading limits. No order was submitted.', 'preview');
    if (action.market) {
      const aliases: Record<string, string> = { BITCOIN: 'BTC', ETHEREUM: 'ETH', SOLANA: 'SOL', MONAD: 'MON' };
      const symbol = aliases[action.market] ?? action.market;
      try {
        const marketResponse = await fetch(PERPL_NETWORKS[input.perpl.network].contextUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!marketResponse.ok) throw new Error('Unavailable');
        const context = decodeTradingContext(await marketResponse.json());
        const market = context.markets.find(m => m.symbol.toUpperCase() === symbol);
        if (!market) return response(`${symbol} is not an available PERPL ${input.perpl.network} market. Available markets: ${context.markets.map(m => m.symbol).join(', ')}. No order was submitted.`, 'preview');
        action.market = market.symbol;
      } catch { return response('PERPL’s live market list could not be verified. Please try again when market data is available. No order was submitted.', 'preview'); }
    }
    const description = action.action === 'close' ? `Close ${action.all ? 'all' : action.market || 'your single'} open position${action.all ? 's' : ''}` : action.action === 'cancel' ? `Cancel pending order #${action.orderId}` : `${action.market} ${action.side} ${action.limitPrice === undefined ? 'market order' : `limit at $${action.limitPrice}`} · $${action.marginUSD} margin · ${action.leverage}x`;
    return response(`${description} on PERPL ${input.perpl.network}. Review and confirm below. A limit order may remain pending until its price is reached. No order has been submitted.`, 'preview', 200, { tradeCandidate: { ...action, network: input.perpl.network } });
  }
  if (/\b(limit|close|cancel|stop|conditional)\b/i.test(input.message) && /\b(orders?|positions?|trades?|btc|eth|sol|mon)\b/i.test(input.message)) return response('Please specify “close my BTC position”, “close all my positions”, “cancel order #123”, or “set a limit order for BTC short at $84100 with $10 at 2x leverage”. No order was submitted.', 'preview');
  const builtIn = await builtInReply(input, getMarkets);
  if (builtIn)
    return response(builtIn, "preview", 200, {
      tradeCandidate: executableTradeCandidate(
        parseExplicitOpening(input.message),
        input.settings,
      ),
    });
  if (!aiConfigured())
    return response(
      "Full AI conversation is awaiting server configuration. You can still ask for Bitcoin/Ethereum prices, ask about margin and leverage, or preview “Short BTC with $10 at 10x.” No trade will be submitted.",
      "setup_required",
    );
  if (!input.aiConsent)
    return response(
      "Enable AI conversation consent below the chat to send this conversation and trading preferences to the AI provider. Never include credentials.",
      "consent_required",
    );
  if (!aiPersistenceConfigured()) {
    try {
      const markets = await getMarkets().catch(() => []);
      const result = await generateMotReply(input, markets, request.signal);
      const reply = renderAiReply(result.output, input);
      return response(reply, "ai", 200, {
        model: result.model,
        tradeCandidate:
          result.output.intent === "trade_preview"
            ? executableTradeCandidate(result.output.trade, input.settings)
            : null,
      });
    } catch (error) {
      console.error("MOT AI generation failed", error);
      return response(
        "MOT’s AI service is temporarily unavailable. Try again shortly. No trade was submitted.",
        "unavailable",
        503,
      );
    }
  }
  const existing = (await cookies()).get("mot.ai.session")?.value;
  const token =
    existing && /^[A-Za-z0-9_-]{43}$/.test(existing)
      ? existing
      : randomBytes(32).toString("base64url");
  const id = randomUUID();
  let reserved = false;
  try {
    const model = process.env.MOT_AI_MODEL || DEFAULT_AI_MODEL;
    const ownerHash = sessionHash(token);
    const ipHash = sessionHash(
      `ip:${request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`,
    );
    reserved = await reserveGeneration(id, ownerHash, ipHash, model, input);
    if (!reserved)
      return response(
        "MOT’s AI request limit has been reached. Try later. Prices and previews remain available.",
        "rate_limited",
        429,
      );
    const markets = await getMarkets().catch(() => []);
    const result = await generateMotReply(input, markets, request.signal);
    const reply = renderAiReply(result.output, input);
    const ir = Number(process.env.MOT_AI_INPUT_USD_PER_TOKEN),
      or = Number(process.env.MOT_AI_OUTPUT_USD_PER_TOKEN);
    const cost =
      process.env.MOT_AI_INPUT_USD_PER_TOKEN &&
      process.env.MOT_AI_OUTPUT_USD_PER_TOKEN &&
      Number.isFinite(ir) &&
      Number.isFinite(or) &&
      ir >= 0 &&
      or >= 0
        ? (result.usage.inputTokens ?? 0) * ir +
          (result.usage.outputTokens ?? 0) * or
        : null;
    await completeGeneration(id, reply, result.output, result.usage, cost);
    const completed = response(reply, "ai", 200, {
      generationId: id,
      generationUrl: `/chat/${id}`,
      model: result.model,
      tradeCandidate:
        result.output.intent === "trade_preview"
          ? executableTradeCandidate(result.output.trade, input.settings)
          : null,
    });
    completed.cookies.set("mot.ai.session", token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 2592000,
    });
    return completed;
  } catch {
    if (reserved) await failGeneration(id).catch(() => {});
    return response(
      "MOT’s AI service or private response storage is unavailable. Try later. No trade was submitted.",
      "unavailable",
      503,
    );
  }
}
