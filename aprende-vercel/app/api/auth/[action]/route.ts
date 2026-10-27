import { AppError,authRequest,clearSession,failure,json,readBody,requireSession,setSession } from '../../../../lib/auth';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;if(action!=='me')return json({error:'Não encontrado.'},404);
 try{const session=await requireSession();return json({profile:session.profile});}catch(e){return failure(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 try{
  const {action}=await params;const body=await readBody(request,6000);
  if(action==='logout'){try{const s=await requireSession();await authRequest('logout',{},s.token);}catch{}await clearSession();return json({ok:true});}
  if(!['login','register'].includes(action))throw new AppError(404,'Não encontrado.');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';const password=typeof body.password==='string'?body.password:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>128)throw new AppError(400,'Indica um email válido e uma palavra-passe entre 8 e 128 caracteres.');
  let r:Response;
  if(action==='register'){
   const registration=(process.env.REGISTRATION_CODE||'').trim();if(registration&&body.registration_code!==registration)throw new AppError(403,'Código de registo incorreto. Pede o código à tua equipa.');
   const name=typeof body.full_name==='string'?body.full_name.trim().slice(0,120):'';if(name.length<2)throw new AppError(400,'Indica o teu nome.');
   // role is NEVER taken from the browser or user metadata.
   r=await authRequest('signup',{email,password,data:{full_name:name}});
  }else r=await authRequest('token?grant_type=password',{email,password});
  if(!r.ok){if(r.status===429)throw new AppError(429,'Demasiadas tentativas. Aguarda antes de tentar novamente.');throw new AppError(400,action==='login'?'Email ou palavra-passe incorretos, ou email ainda por confirmar.':'Não foi possível criar a conta. Verifica o email, a palavra-passe e as definições de registo no Supabase.');}
  const data=await r.json();
  if(!data.access_token)return json({confirmation_required:true,message:'Se o registo foi aceite, receberás um email de confirmação. Confirma-o e volta a iniciar sessão.'});
  await setSession(data);const session=await requireSession();return json({profile:session.profile,redirect:session.profile.role==='rh'?'/rh':'/'});
 }catch(e){return failure(e);}
}
