import { database,failure,json,readBody,requireSession,validateProfile } from '../../../lib/auth';
import { validSkills } from '../../../lib/planner';
export const runtime='nodejs';
export async function GET(){try{const s=await requireSession();return json({profile:s.profile});}catch(e){return failure(e);}}
export async function PATCH(request:Request){try{const s=await requireSession(),data=validateProfile(await readBody(request));data.known_skills=data.known_skills.filter(s=>validSkills.has(s as string));const profiles=await database(s,'profiles?id=eq.'+s.user.id,{method:'PATCH',body:data});return json({profile:profiles[0]});}catch(e){return failure(e);}}
