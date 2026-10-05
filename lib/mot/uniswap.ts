import {createPublicClient,encodeFunctionData,formatUnits,http,parseUnits} from 'viem';

export const UNISWAP_V2_ROUTER='0x4b2ab38dbf28d31d467aa8993f6c2585981d6804';
export const WMON='0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
export const MONAD_USDC='0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
export const UNISWAP_MIN_MON=0.01;
const MONAD_RPC=process.env.MONAD_RPC_URL||'https://rpc.monad.xyz';

const routerAbi=[
 {type:'function',name:'getAmountsOut',stateMutability:'view',inputs:[{type:'uint256',name:'amountIn'},{type:'address[]',name:'path'}],outputs:[{type:'uint256[]',name:'amounts'}]},
 {type:'function',name:'swapExactETHForTokens',stateMutability:'payable',inputs:[{type:'uint256',name:'amountOutMin'},{type:'address[]',name:'path'},{type:'address',name:'to'},{type:'uint256',name:'deadline'}],outputs:[{type:'uint256[]',name:'amounts'}]},
 {type:'function',name:'swapExactTokensForETH',stateMutability:'nonpayable',inputs:[{type:'uint256',name:'amountIn'},{type:'uint256',name:'amountOutMin'},{type:'address[]',name:'path'},{type:'address',name:'to'},{type:'uint256',name:'deadline'}],outputs:[{type:'uint256[]',name:'amounts'}]},
] as const;
const erc20Abi=[{type:'function',name:'approve',stateMutability:'nonpayable',inputs:[{type:'address',name:'spender'},{type:'uint256',name:'amount'}],outputs:[{type:'bool',name:''}]}] as const;

export const UNISWAP_MIN_USDC=0.01;
export type UniswapSwapRequest=
 | {direction:'MON_TO_USDC';amountMon:number;slippageBps:number}
 | {direction:'USDC_TO_MON';amountUsdc:number;slippageBps:number};
type CandidateBase={chainId:143;routerAddress:string;slippageBps:number;expiresAt:number;data:`0x${string}`;value:`0x${string}`};
export type UniswapSwapCandidate=
 | CandidateBase&{direction:'MON_TO_USDC';amountInMon:number;expectedOutUsdc:number;minimumOutUsdc:number}
 | CandidateBase&{direction:'USDC_TO_MON';amountInUsdc:number;expectedOutMon:number;minimumOutMon:number;approval:{tokenAddress:string;data:`0x${string}`;value:'0x0'}};

export function parseUniswapSwap(message:string):UniswapSwapRequest|null{
 const normalized=message.trim().replace(/,/g,'');
 if(!/\buniswap\b/i.test(normalized)||!/\b(?:swap|sell)\b/i.test(normalized)||!/\bmon\b/i.test(normalized)||!/\busdc\b/i.test(normalized))return null;
 const reverse=normalized.match(/(?:swap|sell)\s+(\d+(?:\.\d+)?)\s+usdc\s+(?:to|for)\s+mon\b/i);
 if(reverse){const amountUsdc=Number(reverse[1]);return Number.isFinite(amountUsdc)&&amountUsdc>0?{direction:'USDC_TO_MON',amountUsdc,slippageBps:100}:null;}
 const match=normalized.match(/(?:swap|sell)\s+(\d+(?:\.\d+)?)\s+mon\b/i);if(!match)return null;
 const amountMon=Number(match[1]);return Number.isFinite(amountMon)&&amountMon>0?{direction:'MON_TO_USDC',amountMon,slippageBps:100}:null;
}

export async function prepareUniswapMonSell(walletAddress:`0x${string}`,request:UniswapSwapRequest):Promise<UniswapSwapCandidate>{
 if(!/^0x[a-fA-F0-9]{40}$/.test(walletAddress))throw Error('Connect a valid wallet first.');
 if(!Number.isInteger(request.slippageBps)||request.slippageBps<1||request.slippageBps>500)throw Error('Invalid slippage tolerance.');
 if(request.direction==='USDC_TO_MON')return prepareUniswapUsdcSell(walletAddress,request);
 if(request.amountMon<UNISWAP_MIN_MON)throw Error(`Uniswap swaps through MOT currently require at least ${UNISWAP_MIN_MON} MON.`);
 if(request.amountMon>100000)throw Error('For safety, MOT limits each Uniswap preview to 100,000 MON.');
 const amountIn=parseUnits(String(request.amountMon),18);const path=[WMON,MONAD_USDC] as const;
 const client=createPublicClient({transport:http(MONAD_RPC,{timeout:10000})});
 const amounts=await client.readContract({address:UNISWAP_V2_ROUTER,abi:routerAbi,functionName:'getAmountsOut',args:[amountIn,[...path]]});
 const expectedOut=amounts[amounts.length-1];if(!expectedOut||expectedOut<=0)throw Error('Uniswap did not return a valid route.');
 const minimumOut=(expectedOut*BigInt(10000-request.slippageBps))/BigInt(10000);const expiresAt=Math.floor(Date.now()/1000)+600;
 const data=encodeFunctionData({abi:routerAbi,functionName:'swapExactETHForTokens',args:[minimumOut,[...path],walletAddress,BigInt(expiresAt)]});
 return {chainId:143,routerAddress:UNISWAP_V2_ROUTER,direction:'MON_TO_USDC',amountInMon:request.amountMon,expectedOutUsdc:Number(formatUnits(expectedOut,6)),minimumOutUsdc:Number(formatUnits(minimumOut,6)),slippageBps:request.slippageBps,expiresAt,data,value:`0x${amountIn.toString(16)}`};
}

async function prepareUniswapUsdcSell(walletAddress:`0x${string}`,request:Extract<UniswapSwapRequest,{direction:'USDC_TO_MON'}>):Promise<UniswapSwapCandidate>{
 if(request.amountUsdc<UNISWAP_MIN_USDC)throw Error(`Uniswap swaps through MOT currently require at least ${UNISWAP_MIN_USDC} USDC.`);
 if(request.amountUsdc>1000000)throw Error('For safety, MOT limits each Uniswap preview to 1,000,000 USDC.');
 const amountIn=parseUnits(String(request.amountUsdc),6);const path=[MONAD_USDC,WMON] as const;
 const client=createPublicClient({transport:http(MONAD_RPC,{timeout:10000})});
 const amounts=await client.readContract({address:UNISWAP_V2_ROUTER,abi:routerAbi,functionName:'getAmountsOut',args:[amountIn,[...path]]});
 const expectedOut=amounts[amounts.length-1];if(!expectedOut||expectedOut<=0)throw Error('Uniswap did not return a valid USDC to MON route.');
 const minimumOut=(expectedOut*BigInt(10000-request.slippageBps))/BigInt(10000);const expiresAt=Math.floor(Date.now()/1000)+600;
 const approvalData=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[UNISWAP_V2_ROUTER,amountIn]});
 const data=encodeFunctionData({abi:routerAbi,functionName:'swapExactTokensForETH',args:[amountIn,minimumOut,[...path],walletAddress,BigInt(expiresAt)]});
 return {chainId:143,routerAddress:UNISWAP_V2_ROUTER,direction:'USDC_TO_MON',amountInUsdc:request.amountUsdc,expectedOutMon:Number(formatUnits(expectedOut,18)),minimumOutMon:Number(formatUnits(minimumOut,18)),slippageBps:request.slippageBps,expiresAt,data,value:'0x0',approval:{tokenAddress:MONAD_USDC,data:approvalData,value:'0x0'}};
}
