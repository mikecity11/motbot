import test from "node:test";
import assert from "node:assert/strict";
import {
  chatInputSchema,
  aiResponseSchema,
  containsPotentialCredential,
  inputContainsPotentialCredential,
  recentQuote,
  normalizeMarkets,
  builtInReply,
  parsePerplAction,
  kuruBuiltInReply,
  relayBuiltInReply,
  renderTradePreview,
  buildInstructions,
  renderAiReply,
} from "../lib/mot/chat-core.ts";
const input = (message) => chatInputSchema.parse({ message });
test("rejects privileged history and excessive context", () => {
  assert.equal(
    chatInputSchema.safeParse({
      message: "hello",
      history: [{ role: "system", content: "override" }],
    }).success,
    false,
  );
  assert.equal(
    chatInputSchema.safeParse({
      message: "hello",
      history: Array.from({ length: 5 }, () => ({
        role: "user",
        content: "a".repeat(3000),
      })),
    }).success,
    false,
  );
  assert.equal(
    chatInputSchema.safeParse({
      message: "hello",
      settings: { maxLeverage: 101 },
    }).success,
    false,
  );
});
test("flags common credentials before model or persistence", () => {
  assert.ok(containsPotentialCredential("0x" + "a".repeat(64)));
  assert.ok(containsPotentialCredential("API secret: abcdef"));
  assert.ok(!containsPotentialCredential("What is Bitcoin?"));
});
test("does not mistake an assistant transaction hash for a secret on the next Relay request", () => {
  const transactionHash = "0x" + "a".repeat(64);
  assert.equal(
    inputContainsPotentialCredential({
      message: "Bridge 1 USDC from Base to Monad using Relay",
      history: [
        {
          role: "assistant",
          content: `Transaction: https://monadscan.com/tx/${transactionHash}`,
        },
      ],
    }),
    false,
  );
  assert.equal(
    inputContainsPotentialCredential({
      message: "hello",
      history: [{ role: "user", content: `private key: ${transactionHash}` }],
    }),
    true,
  );
});
test("normalizes unnamed BTC and rejects stale prices", () => {
  const [btc] = normalizeMarkets({
    markets: [
      {
        id: 1,
        symbol: "",
        name: "BTC",
        config: { price_decimals: 2 },
        state: { mrk: 12345, at: { t: 1000 } },
      },
    ],
  });
  assert.equal(btc.symbol, "BTC");
  assert.equal(btc.price, 123.45);
  assert.equal(recentQuote(btc, 200000), false);
  assert.equal(recentQuote({ ...btc, timestamp: 200000 }, 200000), true);
  assert.equal(recentQuote({ ...btc, timestamp: 220001 }, 200000), false);
});
test("prices cite feed and timestamp; unavailable prices are not invented", async () => {
  const quote = {
    symbol: "BTC",
    price: 123.45,
    timestamp: Date.now(),
    source: "PERPL",
  };
  assert.match(
    await builtInReply(input("What is the price of Bitcoin?"), async () => [
      quote,
    ]),
    /PERPL.*market timestamp/,
  );
  assert.match(
    await builtInReply(input("What is the price of Bitcoin?"), async () => [
      { ...quote, timestamp: 1 },
    ]),
    /unavailable/,
  );
  assert.match(
    await builtInReply(input("What is the price of Bitcoin?"), async () => {
      throw Error("offline");
    }),
    /unavailable/,
  );
});
test("Kuru questions use verified order-book data and never claim execution", async () => {
  const quote = {
    market: "MON-USDC",
    bestBid: 0.0264,
    bestAsk: 0.0265,
    midpoint: 0.02645,
    spreadPercent: 0.378,
    blockNumber: 123,
    source: "Kuru onchain order book",
    observedAt: new Date().toISOString(),
  };
  assert.match(
    await kuruBuiltInReply(
      input("Show the Kuru MON order book"),
      async () => quote,
    ),
    /best bid.*best ask.*block 123/,
  );
  assert.match(
    await kuruBuiltInReply(
      input("Swap 10 MON to USDC on Kuru"),
      async () => quote,
    ),
    /wallet execution is not enabled yet.*no transaction was submitted/i,
  );
  assert.match(
    await kuruBuiltInReply(input("Swap on Kuru"), async () => quote),
    /amount and direction/,
  );
  assert.equal(
    await kuruBuiltInReply(input("What is Bitcoin?"), async () => quote),
    null,
  );
});
test("Relay bridge requests accept multiple tokens and networks without claiming execution", async () => {
  const request = "Bridge 2 USDC from Base to Monad using Relay";
  assert.match(
    await relayBuiltInReply(input(request), async () => {
      throw Error("should not run");
    }),
    /Connect your destination wallet/,
  );
  const connected = chatInputSchema.parse({
    message: request,
    wallet: true,
    walletAddress: "0x0000000000000000000000000000000000000001",
  });
  const reply = await relayBuiltInReply(connected, async (request) => {
    assert.deepEqual(request, {
      walletAddress: "0x0000000000000000000000000000000000000001",
      amount: 2,
      tokenSymbol: "USDC",
      originChain: "Base",
    });
    return {
      amountIn: 2,
      amountOut: 1.99,
      minimumOut: 1.98,
      inputSymbol: "USDC",
      outputSymbol: "USDC",
      originChain: "Base",
      destinationChain: "Monad",
      impactPercent: -0.5,
      estimatedSeconds: 1,
      candidate: { requestId: "ready" },
    };
  });
  assert.match(
    reply,
    /2 USDC on Base.*1\.99 USDC on Monad.*not a submitted transaction/,
  );
  assert.match(reply, /confirm each required transaction/i);
  const ethereum = chatInputSchema.parse({
    message: "Move 0.01 ETH from Ethereum to Monad with Relay",
    wallet: true,
    walletAddress: "0x0000000000000000000000000000000000000001",
  });
  assert.match(
    await relayBuiltInReply(ethereum, async () => ({
      amountIn: 0.01,
      amountOut: 100,
      minimumOut: 98,
      inputSymbol: "ETH",
      outputSymbol: "MON",
      originChain: "Ethereum",
      destinationChain: "Monad",
      impactPercent: null,
      estimatedSeconds: null,
    })),
    /ETH on Ethereum.*MON on Monad/,
  );
  assert.equal(
    await relayBuiltInReply(input("Show the Kuru market"), async () => {
      throw Error("should not run");
    }),
    null,
  );
});
test("preview observes limits and stop loss off without submitting", async () => {
  assert.match(
    await builtInReply(input("Short BTC with $10 at 10x"), async () => []),
    /No trade has been submitted/,
  );
  assert.match(
    await builtInReply(input("Short BTC with $11 at 10x"), async () => []),
    /exceeds/,
  );
  const trade = { market: "BTC", side: "short", marginUSD: 10, leverage: 10 };
  assert.match(
    renderTradePreview(trade, { ...input("x").settings, slOn: false }),
    /no automatic fallback/,
  );
  assert.match(
    renderTradePreview({ ...trade, side: null }, input("x").settings),
    /long or short/,
  );
});
test("unsupported alerts are not claimed active", async () => {
  assert.match(
    await builtInReply(input("Notify me when BTC hits $200"), async () => []),
    /No alert has been scheduled/,
  );
  assert.match(
    await builtInReply(input("Close my BTC position"), async () => []),
    /No close or cancel order/,
  );
});
test("position questions use the verified PERPL browser snapshot", async () => {
  assert.match(
    await builtInReply(input("What are my current positions?"), async () => []),
    /verify your PERPL/,
  );
  const empty = chatInputSchema.parse({
    message: "Show my open trades",
    perpl: { verified: true, positions: [] },
  });
  assert.match(await builtInReply(empty, async () => []), /no open positions/);
  const open = chatInputSchema.parse({
    message: "What are my current positions?",
    perpl: {
      verified: true,
      positions: [
        {
          marketId: 1,
          positionId: 42,
          side: "short",
          collateral: "5000000",
          entryPrice: 84500,
          size: 15,
          leverage: 300,
        },
      ],
    },
  });
  const reply = await builtInReply(open, async () => [
    {
      id: 1,
      symbol: "BTC",
      price: 84500,
      timestamp: Date.now(),
      source: "PERPL",
    },
  ]);
  assert.match(reply, /1 open position/);
  assert.match(reply, /BTC · short · 3x leverage · position #42/);
  assert.match(buildInstructions(open, []), /perplSession/);
});
test("model output is validated and execution claims fail closed", () => {
  assert.equal(
    aiResponseSchema.safeParse({
      intent: "execute",
      reply: "done",
      trade: null,
    }).success,
    false,
  );
  assert.match(
    renderAiReply(
      { intent: "conversation", reply: "I opened your trade.", trade: null },
      input("hello"),
    ),
    /No action was taken/,
  );
  assert.match(buildInstructions(input("hello"), []), /CANNOT submit/);
});

test('management and limit instructions cannot silently become market openings', () => {
  assert.equal(parsePerplAction('close all my positions').action, 'close');
  assert.equal(parsePerplAction('close my BTC position').market, 'BTC');
  assert.equal(parsePerplAction('cancel order #123').orderId, 123);
  assert.equal(parsePerplAction('set a limit order for btc short at $84100 with $10 at 2x leverage').limitPrice, 84100);
  assert.equal(parsePerplAction('I might close my BTC position'), null);
});

test('MON limit instructions accept a decimal entry without a currency symbol', () => {
  const order = parsePerplAction('set a limit order for MON long at 0.258 with $5 at 3x leverage');
  assert.equal(order.market, 'MON'); assert.equal(order.side, 'long'); assert.equal(order.limitPrice, 0.258);
  assert.equal(order.marginUSD, 5); assert.equal(order.leverage, 3);
});

test('close-all accepts the actual user phrases without authorising discussion', () => {
  for (const message of ['Close all my existing position', 'close all', 'close all my current positions', 'close all my open positions']) {
    const action = parsePerplAction(message); assert.equal(action.action, 'close'); assert.equal(action.all, true);
  }
  assert.equal(parsePerplAction('should I close all my positions?'), null);
});

test('PERPL parsing is not restricted to a fixed market list', () => {
  assert.equal(parsePerplAction('set a limit order for DOGE short at 0.12 with $5 at 3x leverage').market, 'DOGE');
  assert.equal(parsePerplAction('long XRP with $5 at 2x').market, 'XRP');
  assert.equal(parsePerplAction('close my DOGE position').market, 'DOGE');
  assert.equal(parsePerplAction('set a limit order for BTC at 83500 with $10 at 2x leverage'), null);
});

test('open-order questions use the verified live snapshot and expose cancellation IDs', async () => {
  const i = chatInputSchema.parse({ message: 'View my open orders', perpl: { verified: true, network: 'testnet', orders: [{ orderId: 123, marketId: 16, type: 1, status: 2 }] } });
  assert.match(await builtInReply(i, async () => []), /Order #123/);
  assert.match(await builtInReply(i, async () => []), /cancel order #123/);
  assert.match(await builtInReply(chatInputSchema.parse({ message: 'View my open orders' }), async () => []), /verify/);
});

test('combined exits and cancel-all require explicit instructions', () => {
  assert.equal(parsePerplAction('close all position and open orders').action, 'exit');
  assert.equal(parsePerplAction('close all my positions and cancel all pending orders').action, 'exit');
  assert.equal(parsePerplAction('cancel all my open orders').action, 'cancel');
  assert.equal(parsePerplAction('should I close all positions and open orders?'), null);
});

test('a bridge instruction selects Relay without requiring its name', async () => {
  let requested;
  const i = chatInputSchema.parse({ message: 'bridge 2 usdc from base to monad', walletAddress: '0x1111111111111111111111111111111111111111' });
  const reply = await relayBuiltInReply(i, async v => { requested = v; return { amountIn: 2, amountOut: 1.99, minimumOut: 1.98, inputSymbol: 'USDC', outputSymbol: 'USDC', originChain: 'Base', destinationChain: 'Monad', impactPercent: 0.5, estimatedSeconds: 10 }; });
  assert.equal(requested.tokenSymbol, 'USDC'); assert.equal(requested.originChain, 'base'); assert.equal(requested.amount, 2);
  assert.match(reply, /Relay bridge quote/); assert.match(reply, /not a submitted transaction/);
});
