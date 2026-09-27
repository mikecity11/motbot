import {z} from 'zod';

const NATIVE='0x0000000000000000000000000000000000000000';
export const relayQuoteInputSchema=z.object({walletAddress:z.string().regex(/^0x[a-fA-F0-9]{40}$/),amountEth:z.number().finite().min(0.0001).max(10)});
export type RelayQuote={requestId:string;amountInEth:number;amountOutMon:number;minimumOutMon:number;amountInUsd:number|null;amountOutUsd:number|null;impactPercent:number|null;estimatedSeconds:number|null;source:'Relay quote'};

export async function getBaseToMonadQuote(input:z.infer<typeof relayQuoteInputSchema>):Promise<RelayQuote>{
 const value=relayQuoteInputSchema.parse(input);const amount=BigInt(Math.round(value.amountEth*1e9))*BigInt(1e9);
 const response=await fetch('https://api.relay.link/quote',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({user:value.walletAddress,recipient:value.walletAddress,originChainId:8453,destinationChainId:143,originCurrency:NATIVE,destinationCurrency:NATIVE,amount:amount.toString(),tradeType:'EXACT_INPUT'})});
 const data:any=await response.json().catch(()=>null);if(!response.ok||!data?.details?.currencyOut)throw Error(data?.message||'Relay quote unavailable');
 const inputDetails=data.details.currencyIn;const output=data.details.currencyOut;
 return {requestId:String(data.requestId||''),amountInEth:Number(inputDetails.amountFormatted),amountOutMon:Number(output.amountFormatted),minimumOutMon:Number(output.minimumAmount)/1e18,amountInUsd:Number.isFinite(Number(inputDetails.amountUsd))?Number(inputDetails.amountUsd):null,amountOutUsd:Number.isFinite(Number(output.amountUsd))?Number(output.amountUsd):null,impactPercent:Number.isFinite(Number(data.details.totalImpact?.percent))?Number(data.details.totalImpact.percent):null,estimatedSeconds:Number.isFinite(Number(data.details.timeEstimate))?Number(data.details.timeEstimate):null,source:'Relay quote'};
}
