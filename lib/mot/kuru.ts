import {createPublicClient,decodeFunctionResult,encodeFunctionData,formatUnits,http,parseUnits} from 'viem';

export const KURU_MON_USDC_MARKET='0x065C9d28E428A0db40191a54d33d5b7c71a9C394';
export const MONAD_CHAIN_ID=143;
export const KURU_MIN_MON=200;
const KURU_RPC=process.env.MONAD_RPC_URL||'https://rpc.monad.xyz';

export type KuruMarketSnapshot={market:string;marketAddress:string;bestBid:number;bestAsk:number;midpoint:number;spreadPercent:number;blockNumber:number;source:'Kuru onchain order book';observedAt:string};
export type KuruSwapRequest={amountMon:number;slippageBps:number};
export type KuruSwapCandidate={chainId:143;marketAddress:string;direction:'MON_TO_USDC';amountInMon:number;expectedOutUsdc:number;minimumOutUsdc:number;slippageBps:number;data:`0x${string}`;value:`0x${string}`};

const orderBookAbi=[
 {type:'function',name:'getL2Book',stateMutability:'view',inputs:[],outputs:[{type:'bytes'}]},
 {type:'function',name:'getMarketParams',stateMutability:'view',inputs:[],outputs:[{type:'uint32'},{type:'uint96'},{type:'address'},{type:'uint256'},{type:'address'},{type:'uint256'},{type:'uint32'},{type:'uint96'},{type:'uint96'},{type:'uint32'},{type:'uint32'}]},
 {type:'function',name:'placeAndExecuteMarketSell',stateMutability:'payable',inputs:[{type:'uint96',name:'_size'},{type:'uint256',name:'_minAmountOut'},{type:'bool',name:'_isMargin'},{type:'bool',name:'_isFillOrKill'}],outputs:[{type:'uint256'}]},
] as const;

export function parseKuruSwap(message:string):KuruSwapRequest|null{
 const normalized=message.trim().replace(/,/g,'');
 if(!/\b(?:swap|sell)\b/i.test(normalized)||!/\bmon\b/i.test(normalized)||!/\busdc\b/i.test(normalized)||!/\bkuru\b/i.test(normalized))return null;
 if(/\b(?:usdc\s+(?:to|for)\s+mon|buy\s+mon)\b/i.test(normalized))return null;
 const match=normalized.match(/(?:swap|sell)\s+(\d+(?:\.\d+)?)\s+mon\b/i);if(!match)return null;
 const amountMon=Number(match[1]);if(!Number.isFinite(amountMon)||amountMon<=0)return null;
 return {amountMon,slippageBps:100};
}

export async function prepareKuruMonSell(walletAddress:`0x${string}`,request:KuruSwapRequest):Promise<KuruSwapCandidate>{
 if(request.amountMon<KURU_MIN_MON)throw Error(`Kuru currently requires at least ${KURU_MIN_MON} MON for this market.`);
 if(request.amountMon>100000)throw Error('For safety, MOT limits each Kuru preview to 100,000 MON.');
 if(!Number.isInteger(request.slippageBps)||request.slippageBps<1||request.slippageBps>500)throw Error('Invalid slippage tolerance.');
 if(!/^0x[a-fA-F0-9]{40}$/.test(walletAddress))throw Error('Connect a valid wallet first.');
 const client=createPublicClient({transport:http(KURU_RPC,{timeout:10000})});
 const amountInSizePrecision=parseUnits(String(request.amountMon),10);const value=parseUnits(String(request.amountMon),18);
 const estimateData=encodeFunctionData({abi:orderBookAbi,functionName:'placeAndExecuteMarketSell',args:[amountInSizePrecision,BigInt(0),false,false]});
 const estimateCall=await client.call({account:'0x0000000000000000000000000000000000000000',to:KURU_MON_USDC_MARKET,data:estimateData});
 if(!estimateCall.data)throw Error('Kuru did not return a swap estimate.');
 const expectedOut=decodeFunctionResult({abi:orderBookAbi,functionName:'placeAndExecuteMarketSell',data:estimateCall.data});
 const minimumOut=(expectedOut*BigInt(10000-request.slippageBps))/BigInt(10000);
 const data=encodeFunctionData({abi:orderBookAbi,functionName:'placeAndExecuteMarketSell',args:[amountInSizePrecision,minimumOut,false,false]});
 return {chainId:MONAD_CHAIN_ID,marketAddress:KURU_MON_USDC_MARKET,direction:'MON_TO_USDC',amountInMon:request.amountMon,expectedOutUsdc:Number(formatUnits(expectedOut,6)),minimumOutUsdc:Number(formatUnits(minimumOut,6)),slippageBps:request.slippageBps,data,value:`0x${value.toString(16)}`};
}

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
