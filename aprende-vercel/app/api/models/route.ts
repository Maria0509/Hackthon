import { authorize, getGeminiKey } from '../../../lib/server-config';
export const runtime = 'nodejs';
export const maxDuration = 60;
import { GeminiError, listModels } from '../../../lib/gemini-models';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  const denied=authorize(request);if(denied)return denied;
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem não autorizada.'},403);
  try{
    const raw=await request.text();if(raw.length>2000)return json({error:'Pedido demasiado grande.'},413);
    JSON.parse(raw);const key=getGeminiKey();
    if(!key)return json({error:'Configura GEMINI_API_KEY nas variáveis de ambiente da Vercel e faz Redeploy.',code:'server_not_configured'},503);
    const models=await listModels(key);
    return json({models,message:models.length?'A Google aceitou a chave para listar modelos. A geração e a quota ainda precisam de ser testadas.':'A Google aceitou a consulta, mas não devolveu modelos Flash de texto compatíveis. Verifica o projeto no AI Studio.'});
  }catch(e){
    if(e instanceof GeminiError)return json({error:e.message,code:e.code,providerStatus:e.status},e.status===429?429:502);
    return json({error:'Não foi possível consultar os modelos. Verifica a ligação e tenta novamente.'},502);
  }
}
