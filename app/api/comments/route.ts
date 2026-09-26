import {db} from '@/lib/db';
export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get('id');const {results}=await db().prepare('SELECT id,name,body,date FROM comments WHERE post=? ORDER BY date DESC LIMIT 100').bind(id).all();return Response.json(results);}catch{return Response.json({error:'Comments unavailable'},{status:503});}}
