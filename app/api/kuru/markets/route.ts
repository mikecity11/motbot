import {getKuruMonUsdc} from '@/lib/mot/kuru';

export async function GET(){
 try{return Response.json({markets:[await getKuruMonUsdc()]},{headers:{'Cache-Control':'public, s-maxage=10, stale-while-revalidate=20'}});}
 catch{return Response.json({error:'Kuru market data unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
