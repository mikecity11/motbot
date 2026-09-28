const HASH=/^0x[a-fA-F0-9]{64}$/;
type RpcReply<T>={result?:T;error?:{message?:string}};
type RpcReceipt={status?:string;blockNumber?:string;gasUsed?:string;from?:string;to?:string|null;transactionHash?:string};

export type EnvioTransactionStatus={source:'Envio HyperRPC';hash:string;state:'pending'|'confirmed'|'reverted';blockNumber:number|null;gasUsed:string|null;from:string|null;to:string|null;observedAt:string};

export function envioConfigured(){return Boolean(process.env.ENVIO_API_TOKEN);}

export async function getEnvioTransactionStatus(hash:string):Promise<EnvioTransactionStatus>{
 if(!HASH.test(hash))throw Error('A valid transaction hash is required.');
 const token=process.env.ENVIO_API_TOKEN;if(!token)throw Error('Envio is not configured.');
 const response=await fetch(`https://monad.rpc.hypersync.xyz/${encodeURIComponent(token)}`,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getTransactionReceipt',params:[hash]})});
 if(!response.ok)throw Error('Envio HyperRPC is unavailable.');
 const data=await response.json() as RpcReply<RpcReceipt|null>;
 if(data.error)throw Error(data.error.message||'Envio HyperRPC rejected the request.');
 const receipt=data.result;
 return {source:'Envio HyperRPC',hash,state:!receipt?'pending':receipt.status==='0x1'?'confirmed':'reverted',blockNumber:receipt?.blockNumber?Number.parseInt(receipt.blockNumber,16):null,gasUsed:receipt?.gasUsed?BigInt(receipt.gasUsed).toString():null,from:receipt?.from??null,to:receipt?.to??null,observedAt:new Date().toISOString()};
}
