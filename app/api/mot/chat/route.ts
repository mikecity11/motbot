import {randomBytes,randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {getMarkets} from '@/lib/mot/markets';
import {chatInputSchema,builtInReply,containsPotentialCredential,renderAiReply} from '@/lib/mot/chat-core';
import {aiConfigured,DEFAULT_AI_MODEL,generateMotReply} from '@/lib/mot/ai-model';
import {reserveGeneration,completeGeneration,failGeneration,sessionHash} from '@/lib/mot/ai-storage';
export const maxDuration=60;
const response=(reply:string,mode='preview',status=200,extra={})=>NextResponse.json({reply,executed:false,mode,...extra},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return NextResponse.json({aiConfigured:aiConfigured(),executionEnabled:false},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json'))return response('Please send a JSON message.','preview',415);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return response('Use MOTBOT’s own website to send messages.','preview',403);
 let raw:string;try{raw=await request.text();}catch{return response('Could not read the message.','preview',400);}
 if(raw.length>24000)return response('That conversation is too long. Start a shorter conversation.','preview',413);
 let data:unknown;try{data=JSON.parse(raw);}catch{return response('Please send a valid message.','preview',400);}
 const parsed=chatInputSchema.safeParse(data);if(!parsed.success)return response('Please use a message of 1–3,000 characters and valid trading preferences.','preview',400);const input=parsed.data;
 if([input.message,...input.history.map(t=>t.content)].some(containsPotentialCredential))return response('Do not share API secrets, tokens, wallet private keys, or seed phrases in chat. Use the PERPL setup panel. This message was not sent to an AI provider or saved.','preview',400);
 const builtIn=await builtInReply(input,getMarkets);if(builtIn)return response(builtIn);
 if(!aiConfigured())return response('Full AI conversation is awaiting server configuration. You can still ask for Bitcoin/Ethereum prices, ask about margin and leverage, or preview “Short BTC with $10 at 10x.” No trade will be submitted.','setup_required');
 if(!input.aiConsent)return response('Enable AI conversation consent below the chat to send messages and saved preferences to the AI provider and save responses privately. Never include credentials.','consent_required');
 const existing=(await cookies()).get('mot.ai.session')?.value;const token=existing&&/^[A-Za-z0-9_-]{43}$/.test(existing)?existing:randomBytes(32).toString('base64url');const id=randomUUID();let reserved=false;
 try{
  const model=process.env.MOT_AI_MODEL||DEFAULT_AI_MODEL;const ownerHash=sessionHash(token);const ipHash=sessionHash(`ip:${request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'}`);
  reserved=await reserveGeneration(id,ownerHash,ipHash,model,input);if(!reserved)return response('MOT’s AI request limit has been reached. Try later. Prices and previews remain available.','rate_limited',429);
  const markets=await getMarkets().catch(()=>[]);const result=await generateMotReply(input,markets,request.signal);const reply=renderAiReply(result.output,input);
  const ir=Number(process.env.MOT_AI_INPUT_USD_PER_TOKEN),or=Number(process.env.MOT_AI_OUTPUT_USD_PER_TOKEN);const cost=process.env.MOT_AI_INPUT_USD_PER_TOKEN&&process.env.MOT_AI_OUTPUT_USD_PER_TOKEN&&Number.isFinite(ir)&&Number.isFinite(or)&&ir>=0&&or>=0?(result.usage.inputTokens??0)*ir+(result.usage.outputTokens??0)*or:null;
  await completeGeneration(id,reply,result.output,result.usage,cost);
  const completed=response(reply,'ai',200,{generationId:id,generationUrl:`/chat/${id}`,model:result.model});completed.cookies.set('mot.ai.session',token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:2592000});return completed;
 }catch{if(reserved)await failGeneration(id).catch(()=>{});return response('MOT’s AI service or private response storage is unavailable. Try later. No trade was submitted.','unavailable',503);}
}
