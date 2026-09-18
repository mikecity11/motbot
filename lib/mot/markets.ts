import {normalizeMarkets} from '@/lib/mot/chat-core';
export async function getMarkets(){
 const r=await fetch('https://app.perpl.xyz/api/v1/pub/context',{cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('PERPL market data unavailable');
 return normalizeMarkets(await r.json());
}
