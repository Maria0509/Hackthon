import catalog from './catalogo.json';
export const courses = Object.fromEntries(catalog.formacoes.map(c => [c.id,c]));
export const validSkills = new Set(catalog.formacoes.flatMap(c=>c.competencias));
export function prepareSelection(ids:string[], known:string[]) {
  const selected:string[]=[], visiting=new Set<string>();
  function add(id:string){
    const c=courses[id];
    if(!c)throw new Error('A IA devolveu uma formação que não existe no catálogo.');
    if(c.competencias.every(s=>known.includes(s)) || selected.includes(id))return;
    if(visiting.has(id))throw new Error('Dependência circular no catálogo.');
    visiting.add(id);
    for(const skill of c.pre_requisitos){
      if(!known.includes(skill)){
        const pre=Object.values(courses).find(x=>x.competencias.includes(skill));
        if(!pre)throw new Error('Pré-requisito indisponível.');
        add(pre.id);
      }
    }
    visiting.delete(id);selected.push(id);
  }
  for(const id of ids)add(id);
  return selected;
}
export function schedule(ids:string[], known:string[], limit:number, weeks:number){
  if(!Number.isInteger(limit)||limit<15||limit>240||!Number.isInteger(weeks)||weeks<1||weeks>12)throw new Error('Tempo ou duração inválidos.');
  const remaining=Object.fromEntries(ids.map(id=>[id,courses[id].duracao_minutos])),learned=new Set(known);
  const rows:{week:number,id:string,minutes:number,start:number,end:number,complete:boolean}[]=[];
  for(let week=1;week<=weeks;week++){
    let available=limit;
    while(available>0){
      let added=false;
      for(const id of ids){
        const c=courses[id],r=remaining[id];
        if(!r||!c.pre_requisitos.every(s=>learned.has(s)))continue;
        let n=c.divisivel?Math.min(r,available):(r<=available?r:0);
        if(c.divisivel&&r-n>0&&r-n<c.bloco_minimo_minutos)n=r-c.bloco_minimo_minutos;
        if(n<c.bloco_minimo_minutos)continue;
        const start=c.duracao_minutos-r;
        remaining[id]-=n;available-=n;
        rows.push({week,id,minutes:n,start,end:start+n,complete:remaining[id]===0});
        if(!remaining[id])c.competencias.forEach(s=>learned.add(s));
        added=true;break;
      }
      if(!added)break;
    }
  }
  // Independent replay validates prerequisites, complete durations and limits.
  const checked=new Set(known),sum=Object.fromEntries(ids.map(id=>[id,0]));
  for(const r of rows){
    const c=courses[r.id];
    if(!c.pre_requisitos.every(s=>checked.has(s))||r.minutes<c.bloco_minimo_minutos||(!c.divisivel&&r.minutes!==c.duracao_minutos))throw new Error('Plano inválido.');
    sum[r.id]+=r.minutes;
    if(sum[r.id]>c.duracao_minutos)throw new Error('Duração excedida.');
    if(sum[r.id]===c.duracao_minutos)c.competencias.forEach(s=>checked.add(s));
  }
  const totals=Array.from({length:weeks},(_,i)=>rows.filter(r=>r.week===i+1).reduce((a,r)=>a+r.minutes,0));
  if(totals.some(n=>n>limit)||ids.some(id=>sum[id]+remaining[id]!==courses[id].duracao_minutos))throw new Error('Carga horária inválida.');
  return {rows,remaining,totals};
}
