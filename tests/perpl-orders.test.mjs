import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTradingContext, planMarketOrders } from '../lib/mot/perpl-orders.ts';

const rawContext = { chain: { gas: { h: 1000 } }, markets: [{
  id: 16, symbol: 'BTC', order_ttl_blocks: 20, order_max_market_slippage_bps: 1000,
  config: { price_decimals: 1, size_decimals: 5, initial_margin: 1500 }, state: { mrk: 900000 },
}] };

test('decodes live PERPL trading limits', () => {
  const context = decodeTradingContext(rawContext);
  assert.equal(context.head, 1000); assert.equal(context.markets[0].symbol, 'BTC');
  assert.throws(() => decodeTradingContext({ markets: [] }));
});

test('plans a market opening plus linked stop loss with no builder fee', () => {
  const { head, markets: [market] } = decodeTradingContext(rawContext);
  const orders = planMarketOrders({ trade: { market: 'BTC', side: 'short', marginUSD: 10, leverage: 5 }, preferences: { slOn: true, sl: 50, tpOn: false, tp: 100 }, market, accountId: 639, firstRequestId: 20, firstCorrelationId: 50, head });
  assert.equal(orders.length, 2);
  assert.deepEqual(orders[0], { mt:22,rq:20,sn:50,mkt:16,acc:639,t:2,p:0,s:55,ms:50,fl:4,lv:500,lb:1020 });
  assert.equal(orders[1].t, 4); assert.equal(orders[1].tpc, 3); assert.equal(orders[1].tr, 20); assert.equal(orders[1].tp, 990000);
  assert.ok(orders.every(order => !('bf' in order)));
});

test('uses both protections and rejects leverage above the live market maximum', () => {
  const { head, markets: [market] } = decodeTradingContext(rawContext);
  const base = { trade: { market: 'BTC', side: 'long', marginUSD: 10, leverage: 5 }, preferences: { slOn: true, sl: 50, tpOn: true, tp: 100 }, market, accountId: 1, firstRequestId: 1, firstCorrelationId: 1, head };
  const orders = planMarketOrders(base);
  assert.equal(orders.length, 3); assert.equal(orders[1].tpc, 4); assert.equal(orders[2].tpc, 3);
  assert.throws(() => planMarketOrders({ ...base, trade: { ...base.trade, leverage: 10 } }), /at most 6.66x/);
});
