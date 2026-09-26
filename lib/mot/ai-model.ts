import {generateText,Output} from 'ai';
import {groq} from '@ai-sdk/groq';
import {aiResponseSchema,buildInstructions,type ChatInput,type MarketQuote} from '@/lib/mot/chat-core';
export const DEFAULT_AI_MODEL='google/gemini-3.8-flash'; // Live catalog verified 2026-09-18.
export const DEFAULT_GROQ_MODEL='openai/gpt-oss-20b';
export function aiConfigured(){return process.env.MOT_AI_ENABLED!=='false'&&!!(process.env.GROQ_API_KEY||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN);}
export function aiPersistenceConfigured(){return !!process.env.MOT_AI_DATABASE_URL&&(process.env.MOT_AI_SESSION_SECRET?.length??0)>=32;}
export async function generateMotReply(input:ChatInput,markets:MarketQuote[],signal:AbortSignal){
 const useGroq=!!process.env.GROQ_API_KEY;
 const modelId=useGroq?(process.env.MOT_GROQ_MODEL||DEFAULT_GROQ_MODEL):(process.env.MOT_AI_MODEL||DEFAULT_AI_MODEL);
 const model=useGroq?groq(modelId):modelId;
 const result=await generateText({model,instructions:buildInstructions(input,markets),messages:[...input.history,{role:'user' as const,content:input.message}],output:Output.object({schema:aiResponseSchema}),maxOutputTokens:900,maxRetries:0,abortSignal:AbortSignal.any([signal,AbortSignal.timeout(25000)])});
 return {output:aiResponseSchema.parse(result.output),usage:result.usage,model:modelId};
}
