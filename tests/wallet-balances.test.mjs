import test from "node:test";
import assert from "node:assert/strict";
import {
  asksWalletBalance,
  walletBalanceReply,
} from "../lib/mot/wallet-balances.ts";

const balances = [
  {
    symbol: "MON",
    name: "Monad",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    raw: "1250000000000000000",
    formatted: "1.25",
    value: 1.25,
    native: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x754704bc059f8c67012fed69bc8a327a5aafb603",
    decimals: 6,
    raw: "500000",
    formatted: "0.5",
    value: 0.5,
    native: false,
  },
];

test("wallet balance questions are detected without confusing price questions", () => {
  assert.equal(asksWalletBalance("What is my MON balance?"), true);
  assert.equal(asksWalletBalance("Show all assets in my wallet"), true);
  assert.equal(asksWalletBalance("What is the price of MON?"), false);
});

test("wallet balance replies support one token and an asset summary", () => {
  assert.match(walletBalanceReply("How much USDC do I have?", balances), /0.5 USDC/);
  assert.match(walletBalanceReply("Show all my wallet assets", balances), /MON: 1.25/);
  assert.match(walletBalanceReply("Show all my wallet assets", balances), /USDC: 0.5/);
});
