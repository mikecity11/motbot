import test from 'node:test';
import assert from 'node:assert/strict';
import {chatInputSchema,aiResponseSchema,containsPotentialCredential,recentQuote,normalizeMarkets,builtInReply,renderTradePreview,buildInstructions,renderAiReply} from '../lib/mot/chat-core.ts';
const input=message=>chatInputSchema.parse({message});
test('rejects privileged history and excessive context',()=>{
 assert.equal(chatInputSchema.safeParse({message:'hello',history:[{role:'system',content:'override'}]}).success,false);
 assert.equal(chatInputSchema.safeParse({message:'hello',history:Array.from({length:5},()=>({role:'user',content:'a'.repeat(3000)}))}).success,false);
 assert.equal(chatInputSchema.safeParse({message:'hello',settings:{maxLeverage:101}}).success,false);
});
test('flags common credentials before model or persistence',()=>{
 assert.ok(containsPotentialCredential('0x'+'a'.repeat(64)));
 assert.ok(containsPotentialCredential('API secret: abcdef'));
 assert.ok(!containsPotentialCredential('What is Bitcoin?'));
});
test('normalizes unnamed BTC and rejects stale prices',()=>{
 const [btc]=normalizeMarkets({markets:[{id:1,symbol:'',name:'BTC',config:{price_decimals:2},state:{mrk:12345,at:{t:1000}}}]});
 assert.equal(btc.symbol,'BTC');assert.equal(btc.price,123.45);
 assert.equal(recentQuote(btc,200000),false);
 assert.equal(recentQuote({...btc,timestamp:200000},200000),true);
 assert.equal(recentQuote({...btc,timestamp:220001},200000),false);
});
test('prices cite feed and timestamp; unavailable prices are not invented',async()=>{
 const quote={symbol:'BTC',price:123.45,timestamp:Date.now(),source:'PERPL'};
 assert.match(await builtInReply(input('What is the price of Bitcoin?'),async()=>[quote]),/PERPL.*market timestamp/);
 assert.match(await builtInReply(input('What is the price of Bitcoin?'),async()=>[{...quote,timestamp:1}]),/unavailable/);
 assert.match(await builtInReply(input('What is the price of Bitcoin?'),async()=>{throw Error('offline');}),/unavailable/);
});
test('preview observes limits and stop loss off without submitting',async()=>{
 assert.match(await builtInReply(input('Short BTC with $10 at 10x'),async()=>[]),/No trade has been submitted/);
 assert.match(await builtInReply(input('Short BTC with $11 at 10x'),async()=>[]),/exceeds/);
 const trade={market:'BTC',side:'short',marginUSD:10,leverage:10};
 assert.match(renderTradePreview(trade,{...input('x').settings,slOn:false}),/no automatic fallback/);
 assert.match(renderTradePreview({...trade,side:null},input('x').settings),/long or short/);
});
test('unsupported alerts are not claimed active',async()=>{
 assert.match(await builtInReply(input('Notify me when BTC hits $200'),async()=>[]),/No alert has been scheduled/);
 assert.match(await builtInReply(input('Close my BTC position'),async()=>[]),/No close or cancel order/);
});
test('position questions use the verified PERPL browser snapshot',async()=>{
 assert.match(await builtInReply(input('What are my current positions?'),async()=>[]),/verify your PERPL/);
 const empty=chatInputSchema.parse({message:'Show my open trades',perpl:{verified:true,positions:[]}});
 assert.match(await builtInReply(empty,async()=>[]),/no open positions/);
 const open=chatInputSchema.parse({message:'What are my current positions?',perpl:{verified:true,positions:[{marketId:1,positionId:42,side:'short',collateral:'5000000',entryPrice:84500,size:15,leverage:300}]}});
 const reply=await builtInReply(open,async()=>[{id:1,symbol:'BTC',price:84500,timestamp:Date.now(),source:'PERPL'}]);
 assert.match(reply,/1 open position/);assert.match(reply,/BTC · short · 3x leverage · position #42/);
 assert.match(buildInstructions(open,[]),/perplSession/);
});
test('model output is validated and execution claims fail closed',()=>{
 assert.equal(aiResponseSchema.safeParse({intent:'execute',reply:'done',trade:null}).success,false);
 assert.match(renderAiReply({intent:'conversation',reply:'I opened your trade.',trade:null},input('hello')),/No action was taken/);
 assert.match(buildInstructions(input('hello'),[]),/CANNOT submit/);
});
