import {getMarkets} from '@/lib/mot/markets';
export async function GET(){try{return Response.json({markets:await getMarkets()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'PERPL market data unavailable'},{status:503});}}
