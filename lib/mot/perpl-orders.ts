export type TradeCandidate = { market: string; side: 'long' | 'short'; marginUSD: number; leverage: number };

export type PerplMarket = {
  id: number;
  symbol: string;
  orderTtlBlocks: number;
  maxSlippageBps: number;
  priceDecimals: number;
  sizeDecimals: number;
  initialMargin: number;
  markPriceScaled: number;
};

export type ProtectionPreferences = { slOn: boolean; sl: number; tpOn: boolean; tp: number };

export type PlannedOrder = {
  mt: 22; rq: number; sn: number; mkt: number; acc: number; t: number; p: number;
  s: number; ms: number; fl: 4; lv: number; lb: number; tp?: number; tpc?: number; tr?: number;
};

const safePositive = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function decodeTradingContext(value: unknown): { head: number; markets: PerplMarket[] } {
  if (!value || typeof value !== 'object') throw new Error('PERPL market configuration is unavailable.');
  const raw = value as Record<string, any>;
  const head = raw.chain?.gas?.h;
  if (!safePositive(head) || !Array.isArray(raw.markets)) throw new Error('PERPL returned an invalid market configuration.');
  const markets = raw.markets.map((market: any): PerplMarket | null => {
    const config = market?.config;
    const decoded = {
      id: market?.id, symbol: market?.symbol, orderTtlBlocks: market?.order_ttl_blocks,
      maxSlippageBps: market?.order_max_market_slippage_bps,
      priceDecimals: config?.price_decimals, sizeDecimals: config?.size_decimals,
      initialMargin: config?.initial_margin, markPriceScaled: market?.state?.mrk,
    };
    return safePositive(decoded.id) && typeof decoded.symbol === 'string' && safePositive(decoded.orderTtlBlocks)
      && safePositive(decoded.maxSlippageBps) && Number.isSafeInteger(decoded.priceDecimals) && decoded.priceDecimals >= 0 && decoded.priceDecimals <= 12
      && Number.isSafeInteger(decoded.sizeDecimals) && decoded.sizeDecimals >= 0 && decoded.sizeDecimals <= 12
      && safePositive(decoded.initialMargin) && safePositive(decoded.markPriceScaled) ? decoded as PerplMarket : null;
  }).filter(Boolean) as PerplMarket[];
  if (!markets.length) throw new Error('PERPL has no valid testnet markets available.');
  return { head, markets };
}

export function planMarketOrders(args: {
  trade: TradeCandidate; preferences: ProtectionPreferences; market: PerplMarket;
  accountId: number; firstRequestId: number; firstCorrelationId: number; head: number;
}): PlannedOrder[] {
  const { trade, preferences, market, accountId, firstRequestId, firstCorrelationId, head } = args;
  if (!safePositive(accountId) || !safePositive(firstRequestId) || !safePositive(firstCorrelationId) || !safePositive(head)) throw new Error('The PERPL session is missing current account state.');
  if (trade.market.toUpperCase() !== market.symbol.toUpperCase()) throw new Error('The selected PERPL market does not match the instruction.');
  if (!Number.isFinite(trade.marginUSD) || trade.marginUSD <= 0 || !Number.isFinite(trade.leverage) || trade.leverage <= 0) throw new Error('Margin and leverage must be positive.');
  const leverageHundredths = Math.round(trade.leverage * 100);
  const maxLeverageHundredths = Math.floor(1_000_000 / market.initialMargin);
  if (leverageHundredths > maxLeverageHundredths) throw new Error(`${market.symbol} currently allows at most ${(maxLeverageHundredths / 100).toFixed(2)}x leverage on PERPL testnet.`);
  const mark = market.markPriceScaled / 10 ** market.priceDecimals;
  const size = Math.floor((trade.marginUSD * trade.leverage / mark) * 10 ** market.sizeDecimals);
  if (!safePositive(size)) throw new Error(`This order is too small for ${market.symbol}'s current size precision.`);
  const expiry = head + Math.min(20, market.orderTtlBlocks);
  const opening: PlannedOrder = {
    mt: 22, rq: firstRequestId, sn: firstCorrelationId, mkt: market.id, acc: accountId,
    t: trade.side === 'long' ? 1 : 2, p: 0, s: size, ms: Math.min(50, market.maxSlippageBps),
    fl: 4, lv: leverageHundredths, lb: expiry,
  };
  const orders = [opening];
  const closeType = trade.side === 'long' ? 3 : 4;
  const addTrigger = (percent: number, kind: 'sl' | 'tp') => {
    if (!Number.isFinite(percent) || percent <= 0) throw new Error(`The ${kind === 'sl' ? 'stop-loss' : 'take-profit'} percentage is invalid.`);
    const move = percent / 100 / trade.leverage;
    const multiplier = kind === 'sl' ? (trade.side === 'long' ? 1 - move : 1 + move) : (trade.side === 'long' ? 1 + move : 1 - move);
    const trigger = Math.round(market.markPriceScaled * multiplier);
    if (!safePositive(trigger)) throw new Error('The calculated protection trigger is invalid.');
    const isGreater = kind === 'sl' ? trade.side === 'short' : trade.side === 'long';
    orders.push({ mt: 22, rq: firstRequestId + orders.length, sn: firstCorrelationId + orders.length,
      mkt: market.id, acc: accountId, t: closeType, p: 0, s: size, ms: Math.min(50, market.maxSlippageBps),
      fl: 4, lv: leverageHundredths, lb: 0, tp: trigger, tpc: isGreater ? 3 : 4, tr: firstRequestId });
  };
  if (preferences.slOn) addTrigger(preferences.sl, 'sl');
  if (preferences.tpOn) addTrigger(preferences.tp, 'tp');
  return orders;
}
