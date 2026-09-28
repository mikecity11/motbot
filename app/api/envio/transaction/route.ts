import {NextResponse} from 'next/server';
import {envioConfigured,getEnvioTransactionStatus} from '@/lib/mot/envio';

export async function GET(request:Request){
 const hash=new URL(request.url).searchParams.get('hash')??'';
 if(!/^0x[a-fA-F0-9]{64}$/.test(hash))return NextResponse.json({error:'A valid transaction hash is required.'},{status:400});
 if(!envioConfigured())return NextResponse.json({error:'Envio monitoring is awaiting server configuration.',configured:false},{status:503});
 try{return NextResponse.json({...await getEnvioTransactionStatus(hash),configured:true},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Envio could not read this Monad transaction yet.',configured:true},{status:502,headers:{'Cache-Control':'no-store'}});}
}
