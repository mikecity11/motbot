export async function getMarkets(){
 const r=await fetch('https://app.perpl.xyz/api/v1/pub/context',{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('PERPL market data unavailable');
 const d:any=await r.json();if(!Array.isArray(d.markets))throw Error('Unexpected PERPL response');
 return d.markets.map((m:any)=>{const decimals=Number(m.config?.price_decimals);const scaled=Number(m.state?.mrk);return {symbol:m.symbol,id:m.id,price:Number.isFinite(decimals)&&Number.isFinite(scaled)&&scaled>0?scaled/10**decimals:null,timestamp:m.state?.at?.t||null,source:'PERPL mark price'};});
}
