import { cookies } from 'next/headers';
export class AppError extends Error {constructor(public status:number,message:string){super(message);this.name='AppError';}}
export type Profile={id:string;email:string;full_name:string;role:'colaborador'|'rh';job_title:string;department:string;career_goal:string;known_skills:string[];weekly_minutes:number;created_at:string};
export type Session={token:string;user:{id:string;email?:string};profile:Profile};
export function configuration(){
 const url=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');const key=(process.env.SUPABASE_ANON_KEY||'').trim();
 if(!url||!key)throw new AppError(503,'O login ainda não está configurado. Define SUPABASE_URL e SUPABASE_ANON_KEY na Vercel e executa supabase/schema.sql.');
 if(!/^https:\/\/[^/]+$/.test(url))throw new AppError(503,'SUPABASE_URL deve ser o endereço HTTPS do projeto.');
 return {url,key};
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError(403,'Origem não autorizada.');}
export async function readBody(request:Request,max=16000){sameOrigin(request);const raw=await request.text();if(raw.length>max)throw new AppError(413,'Pedido demasiado grande.');try{return JSON.parse(raw);}catch{throw new AppError(400,'Pedido JSON inválido.');}}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function failure(e:unknown){return json({error:e instanceof AppError?e.message:'Não foi possível concluir o pedido. Tenta novamente.'},e instanceof AppError?e.status:500);}
export async function authRequest(path:string,body?:unknown,token?:string){
 const {url,key}=configuration();return fetch(url+'/auth/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(15000)});
}
export async function setSession(data:any){
 if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string')throw new AppError(502,'A autenticação não devolveu uma sessão válida.');
 const store=await cookies();const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
 store.set('aprende_access',data.access_token,{...options,maxAge:Math.max(60,Math.min(Number(data.expires_in)||3600,86400))});
 store.set('aprende_refresh',data.refresh_token,{...options,maxAge:60*60*24*30});
}
export async function clearSession(){const store=await cookies();store.delete('aprende_access');store.delete('aprende_refresh');}
export async function database(session:Pick<Session,'token'>,path:string,options:{method?:string;body?:unknown;prefer?:string}={}){
 const {url,key}=configuration();const response=await fetch(url+'/rest/v1/'+path,{method:options.method||'GET',headers:{apikey:key,Authorization:'Bearer '+session.token,'Content-Type':'application/json',Prefer:options.prefer||'return=representation'},...(options.body===undefined?{}:{body:JSON.stringify(options.body)}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok){if(response.status===401)throw new AppError(401,'A sessão expirou. Inicia sessão novamente.');if(response.status===403)throw new AppError(403,'Não tens permissão para esta operação.');throw new AppError(503,'Não foi possível aceder aos dados. Confirma que executaste supabase/schema.sql no projeto correto.');}
 return response.status===204?null:response.json();
}
export async function requireSession(allowRefresh=true):Promise<Session>{
 configuration();const store=await cookies();let token=store.get('aprende_access')?.value;let user:any;
 if(token){const r=await authRequest('user',undefined,token);if(r.ok)user=await r.json();else if(r.status!==401&&r.status!==403)throw new AppError(503,'O serviço de autenticação está indisponível.');}
 if(!user&&allowRefresh){const refresh=store.get('aprende_refresh')?.value;if(refresh){const r=await authRequest('token?grant_type=refresh_token',{refresh_token:refresh});if(r.ok){const data=await r.json();await setSession(data);token=data.access_token;user=data.user;}}}
 if(!token||!user?.id)throw new AppError(401,'Inicia sessão para continuar.');
 const profiles=await database({token},'profiles?id=eq.'+encodeURIComponent(user.id)+'&select=*');const profile=profiles?.[0];
 if(!profile||!['colaborador','rh'].includes(profile.role))throw new AppError(403,'O perfil ainda não está disponível. Contacta o administrador.');
 return {token,user,profile};
}
export function requireHR(session:Session){if(session.profile.role!=='rh')throw new AppError(403,'Esta área é exclusiva de Recursos Humanos.');}
export function validateProfile(body:any){
 const text=(key:string,max:number)=>typeof body[key]==='string'?body[key].trim().slice(0,max):'';
 const minutes=Number(body.weekly_minutes);if(!Number.isInteger(minutes)||minutes<15||minutes>240)throw new AppError(400,'Escolhe entre 15 e 240 minutos semanais.');
 const name=text('full_name',120);if(name.length<2)throw new AppError(400,'Indica o teu nome.');
 if(!Array.isArray(body.known_skills)||body.known_skills.some((s:any)=>typeof s!=='string'))throw new AppError(400,'Competências inválidas.');
 return {full_name:name,job_title:text('job_title',200),department:text('department',120),career_goal:text('career_goal',2000),known_skills:[...new Set(body.known_skills)].slice(0,30),weekly_minutes:minutes};
}
