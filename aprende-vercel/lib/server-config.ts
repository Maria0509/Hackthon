import { timingSafeEqual } from 'node:crypto';
export function getGeminiKey(){return (process.env.GEMINI_API_KEY||'').trim();}
export function authorize(request:Request):Response|null{
  const expected=(process.env.APP_ACCESS_CODE||'').trim();
  if(!expected)return null;
  const provided=request.headers.get('x-app-access-code')||'';
  const a=Buffer.from(expected),b=Buffer.from(provided);
  if(a.length!==b.length||!timingSafeEqual(a,b))return Response.json({error:'Código de acesso incorreto ou em falta.'},{status:401,headers:{'Cache-Control':'no-store'}});
  return null;
}
