import { AppError,database,failure,json,requireHR,requireSession } from '../../../lib/auth';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const s=await requireSession();requireHR(s);
 const id=new URL(request.url).searchParams.get('id');
 if(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw new AppError(400,'Colaborador inválido.');const users=await database(s,'profiles?id=eq.'+id+'&role=eq.colaborador&select=*');if(!users.length)throw new AppError(404,'Colaborador não encontrado.');const plans=await database(s,'learning_plans?user_id=eq.'+id+'&select=*&order=created_at.desc&limit=100');return json({employee:users[0],plans});}
 // Fetch all rows with pagination, rather than silently truncating Supabase's 1000-row limit.
 const employees:any[]=[];const plans:any[]=[];
 for(const [table,target,select]of [['profiles',employees,'id,email,full_name,role,job_title,department,created_at'],['learning_plans',plans,'id,user_id,goal,status,total_minutes,pending_minutes,created_at']] as const){
  for(let offset=0;;offset+=500){const rows=await database(s,table+'?select='+select+(table==='profiles'?'&role=eq.colaborador':'')+'&order=created_at.desc,id.desc&limit=500&offset='+offset);target.push(...rows);if(rows.length<500)break;if(offset>=49500)throw new AppError(422,'O relatório excede o limite desta versão.');}
 }
 const rows=employees.map(employee=>{const own=plans.filter(p=>p.user_id===employee.id);return {...employee,plan_count:own.length,latest_plan:own[0]||null};});
 return json({employees:rows,summary:{total:rows.length,with_plan:rows.filter(e=>e.plan_count>0).length,without_plan:rows.filter(e=>!e.plan_count).length,completed:rows.filter(e=>e.latest_plan?.status==='completed').length,active:rows.filter(e=>e.latest_plan?.status==='active').length}});
 }catch(e){return failure(e);}}
