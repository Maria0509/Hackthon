export class GeminiError extends Error {
  constructor(public status:number, public code:string, message:string){super(message);}
}
export async function providerError(response:Response):Promise<GeminiError>{
  let info:any;try{info=await response.json();}catch{}
  const details=info?.error?.details||[];
  const reason=details.map((d:any)=>d.reason).filter((s:any)=>typeof s==='string').join(' ');
  if(/API_KEY_INVALID|API_KEY_EXPIRED/.test(reason))return new GeminiError(400,'invalid_key','A Google rejeitou a chave: é inválida ou expirou. Cria uma chave no Google AI Studio.');
  const messages:Record<number,[string,string]>={
    400:['request_rejected','A Google rejeitou o pedido. Verifica a chave e as restrições do projeto.'],
    401:['invalid_key','A chave Gemini não foi aceite pela Google.'],
    403:['permission_denied','O projeto ou a chave não tem permissão para esta operação. Verifica as restrições da chave no AI Studio.'],
    404:['model_unavailable','Este modelo não está disponível para gerar conteúdo com esta chave. Atualiza a lista de modelos e escolhe outro.'],
    429:['quota_exceeded','A Google indicou limite de utilização ou quota indisponível. Verifica os limites do projeto Free Tier no AI Studio.']
  };
  const [code,message]=messages[response.status]||['provider_unavailable','O Gemini está temporariamente indisponível. Tenta novamente.'];
  return new GeminiError(response.status,code,message);
}
export type TextModel={id:string,label:string};
export function filterModels(models:any[]):TextModel[]{
  const result=models.filter(m=>typeof m.name==='string'&&/^models\/gemini-[a-z0-9.-]+$/.test(m.name)&&Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent')&&/flash/.test(m.name)&&!/(image|audio|tts|live|robot|computer|vision|research)/.test(m.name))
    .map(m=>({id:m.name.slice(7),label:typeof m.displayName==='string'?m.displayName.slice(0,120):m.name.slice(7)}));
  // Prefer current stable Flash-Lite, then stable Flash; never select paid Pro.
  const rank=(id:string)=>(/preview|exp|latest/.test(id)?0:1000)+(/lite/.test(id)?500:0)+(Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1])||0)*10;
  return Array.from(new Map(result.map(m=>[m.id,m])).values()).sort((a,b)=>rank(b.id)-rank(a.id)||a.id.localeCompare(b.id));
}
export async function listModels(key:string):Promise<TextModel[]>{
  let token='';const models:any[]=[];
  for(let page=0;page<5;page++){
    const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');url.searchParams.set('pageSize','1000');if(token)url.searchParams.set('pageToken',token);
    const response=await fetch(url.toString(),{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw await providerError(response);
    const data:any=await response.json();
    if(!Array.isArray(data.models))throw new GeminiError(502,'invalid_model_list','A Google não devolveu uma lista de modelos utilizável.');
    models.push(...data.models);token=typeof data.nextPageToken==='string'?data.nextPageToken:'';if(!token)break;
  }
  return filterModels(models);
}
