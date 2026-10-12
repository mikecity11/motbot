import assert from 'node:assert/strict';
import test from 'node:test';
import {walletSubmissionError,relaySubmissionError} from '../lib/mot/wallet-error.ts';

test('explains wallet rejection',()=>assert.match(walletSubmissionError({code:4001}),/declined/i));
test('explains unsupported Monad network',()=>assert.match(walletSubmissionError(new Error('Unrecognized chain ID')),/Monad mainnet/i));
test('explains insufficient gas balance',()=>assert.match(walletSubmissionError(new Error('insufficient funds for gas * price + value')),/swap amount plus network gas/i));
test('keeps a short unknown wallet reason',()=>assert.equal(walletSubmissionError(new Error('Provider is unavailable')),'The wallet could not submit the swap: Provider is unavailable'));

test('bridge errors preserve the failed step and partial submission evidence', () => {
  const hash = '0x' + '1'.repeat(64);
  const message = relaySubmissionError(new Error('RPC receipt timeout'), 'waiting for approval receipt on Base', [hash]);
  assert.match(message, /approval receipt on Base/); assert.match(message, /RPC receipt timeout/); assert.match(message, /Already submitted/); assert.ok(message.includes(hash));
  assert.doesNotMatch(message, /enough MON/);
});
