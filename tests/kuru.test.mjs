import test from 'node:test';
import assert from 'node:assert/strict';
import {KURU_MIN_MON,parseKuruSwap} from '../lib/mot/kuru.ts';

test('Kuru MON to USDC commands are parsed conservatively',()=>{
 assert.deepEqual(parseKuruSwap('Swap 200 MON to USDC on Kuru'),{amountMon:200,slippageBps:100});
 assert.deepEqual(parseKuruSwap('sell 1,250.5 MON for USDC using Kuru'),{amountMon:1250.5,slippageBps:100});
 assert.equal(parseKuruSwap('Swap 20 USDC to MON on Kuru'),null);
 assert.equal(parseKuruSwap('Swap MON on Kuru'),null);
 assert.equal(KURU_MIN_MON,200);
});
