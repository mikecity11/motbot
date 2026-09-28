import test from 'node:test';
import assert from 'node:assert/strict';
import {getEnvioTransactionStatus} from '../lib/mot/envio.ts';

test('Envio transaction monitoring rejects malformed hashes before networking',async()=>{
 await assert.rejects(()=>getEnvioTransactionStatus('0x1234'),/valid transaction hash/i);
});
