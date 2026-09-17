import {getMarkets} from '@/lib/mot/markets';
export async function POST(request:Request){
 let body:any;try{body=await request.json();}catch{return Response.json({reply:'Please send a valid message.'},{status:400});}
 const text=typeof body.message==='string'?body.message.trim():'';
 if(!text||text.length>3000)return Response.json({reply:'Please use a message between 1 and 3,000 characters.'},{status:400});
 const lower=text.toLowerCase();const symbol=/\b(btc|bitcoin)\b/i.test(text)?'BTC':/\b(eth|ethereum)\b/i.test(text)?'ETH':/\b(sol|solana)\b/i.test(text)?'SOL':/\b(mon|monad)\b/i.test(text)?'MON':null;
 let reply='This first version supports price questions, margin and leverage explanations, and previews of trading instructions. Full AI conversation is not connected yet. What would you like to check?';
 if(/\b(alert|notify|remind)\b/.test(lower)){reply='Price alerts and email delivery are not active yet. No alert has been scheduled. You can choose your preferred delivery channel in Trading settings.';}
 else if(/\b(short|long|open|buy|sell|close|take (?:a |this )?trade)\b/.test(lower)){
  const side=/\bshort\b/.test(lower)?'short':/\blong\b/.test(lower)?'long':null;
  const margin=text.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1];const leverage=text.match(/\b(\d+(?:\.\d+)?)\s*x\b/i)?.[1];
  if(/\b(close|cancel)\b/.test(lower))reply='No close or cancel order was submitted. Position management requires PERPL trading authorization, which is not connected in this version.';
  else{const missing=[!symbol?'market':null,!side?'long or short':null,!margin?'margin amount':null,!leverage?'leverage':null].filter(Boolean);
   if(missing.length)reply=`I need ${missing.join(', ')} to prepare that instruction. For example: “Short BTC with $10 at 10x.” No trade has been submitted.`;
   else if(+margin!<=0||+leverage!<=0)reply='Margin and leverage must be greater than zero. No trade has been submitted.';
   else{const maxMargin=Number(body.settings?.maxMargin)||10;const maxLeverage=Number(body.settings?.maxLeverage)||10;const totalMargin=Number(body.settings?.totalMargin)||50;
    if(Number(margin)>maxMargin||Number(margin)>totalMargin||Number(leverage)>maxLeverage)reply='That instruction exceeds your saved margin or leverage limit. No trade has been submitted.';
    else reply=`Instruction preview: ${symbol} ${side} · $${margin} margin · ${leverage}x leverage · approximately $${(+margin!*+leverage!).toFixed(2)} exposure before fees.\n${body.settings?.slOn?`Default stop-loss: ${body.settings.sl}% of opening margin.`:'Default stop-loss is off.'}\n${body.settings?.tpOn?`Default take-profit: ${body.settings.tp}% of opening margin.`:'Default take-profit is off.'}\n\nNo trade has been submitted. ${body.wallet?'Your wallet is connected, but PERPL trading authorization is still pending.':'Connect a wallet first; PERPL trading authorization is still pending.'}`;
   }
  }
 }
 else if(/\b(price|worth|quote)\b/.test(lower)){
  if(!symbol)reply='Which market would you like to check? For example, Bitcoin or Ethereum.';
  else try{const markets=await getMarkets();const m=markets.find((m:any)=>m.symbol===symbol);reply=m?.price&&m?.timestamp&&Date.now()-Number(m.timestamp)<=120000?`${symbol} mark price: $${m.price.toLocaleString('en-US',{maximumFractionDigits:2})}.\nSource: PERPL · market timestamp ${new Date(Number(m.timestamp)).toISOString()}. This is a reference price, not a guaranteed execution price.`:'I could not retrieve a recent verified PERPL price for that market. I will not estimate it.';}catch{reply='PERPL market data is unavailable right now. I cannot give you a verified current price.';}
 }
 else if(/\b(margin|leverage)\b/.test(lower))reply='Margin is the collateral allocated to your trade. Leverage determines the exposure it controls: $10 margin at 10x means approximately $100 exposure before fees. Profits and losses depend on that exposure. Your default TP and SL percentages use the opening margin.';
 return Response.json({reply,executed:false,mode:'preview'},{headers:{'Cache-Control':'no-store'}});
}
