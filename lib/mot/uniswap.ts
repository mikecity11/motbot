import {createPublicClient,encodeFunctionData,formatUnits,http,parseUnits} from 'viem';

export const UNISWAP_V2_ROUTER='0x4b2ab38dbf28d31d467aa8993f6c2585981d6804';
export const WMON='0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
export const MONAD_USDC='0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
export const UNISWAP_MIN_MON=0.01;
const MONAD_RPC=process.env.MONAD_RPC_URL||'https://rpc.monad.xyz';

const routerAbi=[
 {type:'function',name:'getAmountsOut',stateMutability:'view',inputs:[{type:'uint256',name:'amountIn'},{type:'address[]',name:'path'}],outputs:[{type:'uint256[]',name:'amounts'}]},
 {type:'function',name:'swapExactETHForTokens',stateMutability:'payable',inputs:[{type:'uint256',name:'amountOutMin'},{type:'address[]',name:'path'},{type:'address',name:'to'},{type:'uint256',name:'deadline'}],outputs:[{type:'uint256[]',name:'amounts'}]},
] as const;

export type UniswapSwapRequest={amountMon:number;slippageBps:number};
export type UniswapSwapCandidate={chainId:143;routerAddress:string;direction:'MON_TO_USDC';amountInMon:number;expectedOutUsdc:number;minimumOutUsdc:number;slippageBps:number;expiresAt:number;data:`0x${string}`;value:`0x${string}`};

export function parseUniswapSwap(message:string):UniswapSwapRequest|null{
 const normalized=message.trim().replace(/,/g,'');
 if(!/\buniswap\b/i.test(normalized)||!/\b(?:swap|sell)\b/i.test(normalized)||!/\bmon\b/i.test(normalized)||!/\busdc\b/i.test(normalized))return null;
 if(/\b(?:usdc\s+(?:to|for)\s+mon|buy\s+mon)\b/i.test(normalized))return null;
 const match=normalized.match(/(?:swap|sell)\s+(\d+(?:\.\d+)?)\s+mon\b/i);if(!match)return null;
 const amountMon=Number(match[1]);return Number.isFinite(amountMon)&&amountMon>0?{amountMon,slippageBps:100}:null;
}

export async function prepareUniswapMonSell(walletAddress:`0x${string}`,request:UniswapSwapRequest):Promise<UniswapSwapCandidate>{
 if(!/^0x[a-fA-F0-9]{40}$/.test(walletAddress))throw Error('Connect a valid wallet first.');
 if(request.amountMon<UNISWAP_MIN_MON)throw Error(`Uniswap swaps through MOT currently require at least ${UNISWAP_MIN_MON} MON.`);
 if(request.amountMon>100000)throw Error('For safety, MOT limits each Uniswap preview to 100,000 MON.');
 if(!Number.isInteger(request.slippageBps)||request.slippageBps<1||request.slippageBps>500)throw Error('Invalid slippage tolerance.');
 const amountIn=parseUnits(String(request.amountMon),18);const path=[WMON,MONAD_USDC] as const;
 const client=createPublicClient({transport:http(MONAD_RPC,{timeout:10000})});
 const amounts=await client.readContract({address:UNISWAP_V2_ROUTER,abi:routerAbi,functionName:'getAmountsOut',args:[amountIn,[...path]]});
 const expectedOut=amounts[amounts.length-1];if(!expectedOut||expectedOut<=0)throw Error('Uniswap did not return a valid route.');
 const minimumOut=(expectedOut*BigInt(10000-request.slippageBps))/BigInt(10000);const expiresAt=Math.floor(Date.now()/1000)+600;
 const data=encodeFunctionData({abi:routerAbi,functionName:'swapExactETHForTokens',args:[minimumOut,[...path],walletAddress,BigInt(expiresAt)]});
 return {chainId:143,routerAddress:UNISWAP_V2_ROUTER,direction:'MON_TO_USDC',amountInMon:request.amountMon,expectedOutUsdc:Number(formatUnits(expectedOut,6)),minimumOutUsdc:Number(formatUnits(minimumOut,6)),slippageBps:request.slippageBps,expiresAt,data,value:`0x${amountIn.toString(16)}`};
}
