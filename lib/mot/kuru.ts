import {createPublicClient,http} from 'viem';

export const KURU_MON_USDC_MARKET='0x065C9d28E428A0db40191a54d33d5b7c71a9C394';
const KURU_RPC=process.env.MONAD_RPC_URL||'https://rpc.monad.xyz';

export type KuruMarketSnapshot={market:string;marketAddress:string;bestBid:number;bestAsk:number;midpoint:number;spreadPercent:number;blockNumber:number;source:'Kuru onchain order book';observedAt:string};

const orderBookAbi=[
 {type:'function',name:'getL2Book',stateMutability:'view',inputs:[],outputs:[{type:'bytes'}]},
 {type:'function',name:'getMarketParams',stateMutability:'view',inputs:[],outputs:[{type:'uint32'},{type:'uint96'},{type:'address'},{type:'uint256'},{type:'address'},{type:'uint256'},{type:'uint32'},{type:'uint96'},{type:'uint96'},{type:'uint32'},{type:'uint32'}]},
] as const;

function decodeManualBook(data:`0x${string}`,pricePrecision:bigint){
 const words=data.slice(2).match(/.{64}/g)||[];if(!words.length)throw Error('Empty Kuru order book');
 const blockNumber=Number(BigInt(`0x${words[0]}`));const bids:number[]=[];const asks:number[]=[];let side=bids;
 for(let index=1;index+1<words.length;index+=2){const price=BigInt(`0x${words[index]}`);if(price===BigInt(0)){if(side===asks)break;side=asks;index-=1;continue;}side.push(Number(price)/Number(pricePrecision));}
 return {blockNumber,bids,asks};
}

export async function getKuruMonUsdc():Promise<KuruMarketSnapshot>{
 const client=createPublicClient({transport:http(KURU_RPC,{timeout:8000})});
 const [params,data]=await Promise.all([
  client.readContract({address:KURU_MON_USDC_MARKET,abi:orderBookAbi,functionName:'getMarketParams'}),
  client.readContract({address:KURU_MON_USDC_MARKET,abi:orderBookAbi,functionName:'getL2Book'}),
 ]);
 const book=decodeManualBook(data,BigInt(params[0]));const bids=book.bids.filter(price=>Number.isFinite(price)&&price>0);const asks=book.asks.filter(price=>Number.isFinite(price)&&price>0);
 const bestBid=Math.max(...bids);const bestAsk=Math.min(...asks);
 if(!Number.isFinite(bestBid)||!Number.isFinite(bestAsk)||bestBid<=0||bestAsk<=0||bestAsk<bestBid)throw Error('Kuru order book unavailable');
 const midpoint=(bestBid+bestAsk)/2;
 return {market:'MON-USDC',marketAddress:KURU_MON_USDC_MARKET,bestBid,bestAsk,midpoint,spreadPercent:((bestAsk-bestBid)/midpoint)*100,blockNumber:book.blockNumber,source:'Kuru onchain order book',observedAt:new Date().toISOString()};
}
