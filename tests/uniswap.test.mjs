import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUniswapSwap,UNISWAP_MIN_MON,UNISWAP_MIN_USDC} from '../lib/mot/uniswap.ts';

test('Uniswap MON to USDC commands are parsed conservatively',()=>{
 assert.deepEqual(parseUniswapSwap('Swap 0.01 MON to USDC on Uniswap'),{direction:'MON_TO_USDC',amountMon:0.01,slippageBps:100});
 assert.deepEqual(parseUniswapSwap('sell 1,250 MON for USDC using Uniswap'),{direction:'MON_TO_USDC',amountMon:1250,slippageBps:100});
 assert.deepEqual(parseUniswapSwap('Swap 20 USDC to MON on Uniswap'),{direction:'USDC_TO_MON',amountUsdc:20,slippageBps:100});
 assert.deepEqual(parseUniswapSwap('sell 0.1 usdc for mon using uniswap'),{direction:'USDC_TO_MON',amountUsdc:0.1,slippageBps:100});
 assert.equal(parseUniswapSwap('Swap 0.01 MON to USDC on Kuru'),null);
 assert.equal(UNISWAP_MIN_MON,0.01);
 assert.equal(UNISWAP_MIN_USDC,0.01);
});
