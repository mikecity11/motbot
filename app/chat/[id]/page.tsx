import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {getGeneration,sessionHash} from '@/lib/mot/ai-storage';
export const dynamic='force-dynamic';
export default async function SavedConversation({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const token=(await cookies()).get('mot.ai.session')?.value;
 if(!/^[a-f0-9-]{36}$/i.test(id)||!token||!/^[A-Za-z0-9_-]{43}$/.test(token))notFound();
 let generation;try{generation=await getGeneration(id,sessionHash(token));}catch{notFound();}if(!generation)notFound();
 return <main className="saved-conversation"><a href="/#trade">← Back to MOTBOT</a><h1>Saved MOT response</h1><p>Private to this browser session · {generation.model}</p><article className="saved-reply">{generation.status==='complete'?generation.result:'This response is not available yet.'}</article><p>Conversation only. No trade was submitted. Saved quotes are historical, not current prices.</p></main>;
}
