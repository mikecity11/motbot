import {neon} from '@neondatabase/serverless';
import {createHmac} from 'node:crypto';
export function sessionHash(value:string){const secret=process.env.MOT_AI_SESSION_SECRET;if(!secret||secret.length<32)throw Error('AI session configuration missing');return createHmac('sha256',secret).update(value).digest('hex');}
function database(){if(!process.env.MOT_AI_DATABASE_URL)throw Error('AI storage missing');return neon(process.env.MOT_AI_DATABASE_URL,{fetchOptions:{signal:AbortSignal.timeout(8000)}});}
export async function reserveGeneration(id:string,ownerHash:string,ipHash:string,model:string,prompt:unknown){
 const sql=database();
 const results=await sql.transaction([
  sql.query('SELECT pg_advisory_xact_lock(14310143)'),
  sql.query(`INSERT INTO mot_ai_generations(id,owner_hash,ip_hash,model,prompt,status)
    SELECT $1,$2,$3,$4,$5::jsonb,'pending'
    WHERE (SELECT count(*) FROM mot_ai_generations WHERE created_at>now()-interval '24 hours')<50
    AND (SELECT count(*) FROM mot_ai_generations WHERE owner_hash=$2 AND created_at>now()-interval '1 minute')<5
    AND (SELECT count(*) FROM mot_ai_generations WHERE ip_hash=$3 AND created_at>now()-interval '1 minute')<5
    RETURNING id`,[id,ownerHash,ipHash,model,JSON.stringify(prompt)]),
 ],{isolationLevel:'ReadCommitted'});
 return results[1].length===1;
}
export async function completeGeneration(id:string,result:string,output:unknown,usage:unknown,cost:number|null){await database().query("UPDATE mot_ai_generations SET result=$2,model_output=$3::jsonb,usage=$4::jsonb,estimated_cost_usd=$5,status='complete' WHERE id=$1",[id,result,JSON.stringify(output),JSON.stringify(usage),cost]);}
export async function failGeneration(id:string){await database().query("UPDATE mot_ai_generations SET status='error' WHERE id=$1 AND status='pending'",[id]);}
export async function getGeneration(id:string,ownerHash:string){const rows=await database().query('SELECT id,result,model,status,created_at FROM mot_ai_generations WHERE id=$1 AND owner_hash=$2',[id,ownerHash]);return rows[0]??null;}
