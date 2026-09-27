import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUniswapSwap,UNISWAP_MIN_MON} from '../lib/mot/uniswap.ts';

test('Uniswap MON to USDC commands are parsed conservatively',()=>{
 assert.deepEqual(parseUniswapSwap('Swap 0.01 MON to USDC on Uniswap'),{amountMon:0.01,slippageBps:100});
 assert.deepEqual(parseUniswapSwap('sell 1,250 MON for USDC using Uniswap'),{amountMon:1250,slippageBps:100});
 assert.equal(parseUniswapSwap('Swap 20 USDC to MON on Uniswap'),null);
 assert.equal(parseUniswapSwap('Swap 0.01 MON to USDC on Kuru'),null);
 assert.equal(UNISWAP_MIN_MON,0.01);
});
