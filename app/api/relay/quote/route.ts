import {getRelayQuote,relayQuoteInputSchema} from '@/lib/mot/relay';

export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Use MOTBOT’s own website.'},{status:403});
 try{const input=relayQuoteInputSchema.parse(await request.json());return Response.json({quote:await getRelayQuote(input)},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Relay quote unavailable'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
