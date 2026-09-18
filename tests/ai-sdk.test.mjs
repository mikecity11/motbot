import test from 'node:test';
import assert from 'node:assert/strict';
import {generateText,Output} from 'ai';
import {MockLanguageModelV4} from 'ai/test';
import {aiResponseSchema} from '../lib/mot/chat-core.ts';
test('structured AI output works with an offline mock provider',async()=>{
 const output={intent:'conversation',reply:'Hello! What would you like to discuss?',trade:null};
 const model=new MockLanguageModelV4({doGenerate:async()=>({content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:undefined},usage:{inputTokens:{total:10,noCache:10,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:20,text:20,reasoning:undefined}},warnings:[]})});
 const result=await generateText({model,instructions:'Conversation only. No execution.',messages:[{role:'user',content:'Hello'}],output:Output.object({schema:aiResponseSchema}),maxOutputTokens:900,maxRetries:0});
 assert.deepEqual(result.output,output);assert.equal(result.usage.outputTokens,20);
});
