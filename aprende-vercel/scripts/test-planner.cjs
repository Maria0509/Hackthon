const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,deps={}){const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,require:p=>deps[p]||require(p),Response,Request,URL,AbortSignal,Buffer,process,fetch:(...a)=>global.fetch(...a),Set,Map,Error,SyntaxError,console});return module.exports;}
const planner=load('lib/planner.ts',{'./catalogo.json':JSON.parse(fs.readFileSync('lib/catalogo.json'))});
for(const [limit,total,pending]of [[120,270,0],[60,240,30]]){const p=planner.schedule(planner.prepareSelection(['F02','F03','F04'],['excel_basico']),['excel_basico'],limit,4);assert.equal(p.totals.reduce((a,b)=>a+b,0),total);assert.equal(Object.values(p.remaining).reduce((a,b)=>a+b,0),pending);}
assert.throws(()=>planner.prepareSelection(['inventado'],[]));assert.equal(planner.prepareSelection(['F04'],[]).join(','),'F01,F02,F04');assert.equal(planner.schedule(['F15'],['feedback'],30,4).remaining.F15,60);
const gemini=load('lib/gemini-models.ts');
const serverConfig=load('lib/server-config.ts');
const fakeAccount={token:'test-user-token',user:{id:'11111111-1111-1111-1111-111111111111'},profile:{role:'colaborador'}};
const authMock={requireSession:async()=>fakeAccount,database:async()=>[{id:'test-plan-id'}],failure:e=>Response.json({error:e.message},{status:e.status||500})};
const deps={'../../../lib/auth':authMock,'../../../lib/planner':planner,'../../../lib/gemini-models':gemini,'../../../lib/server-config':serverConfig};
const {POST}=load('app/api/recommend/route.ts',deps),{POST:modelsPOST}=load('app/api/models/route.ts',deps);
process.env.GEMINI_API_KEY='test-only-no-real-credential';
const payload={apiKey:'test-only-no-real-credential',role:'Assistente',goal:'Analisar dados',known:['excel_basico'],details:'Não sei limpar dados ou criar dashboards',limit:60,weeks:4};
const req=(body=payload)=>new Request('https://example.test/api/recommend',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.test'},body:JSON.stringify(body)});
const model=id=>({name:'models/'+id,displayName:id,supportedGenerationMethods:['generateContent']});
const success=(recommendations=['F02','F03','F04'].map(id=>({id,reason:'Objetivo de dados'})))=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:true,alternatives:[],message:'Percurso de análise',gaps:['Limpeza'],questions:[],recommendations})}]}}]});
function mock(generate){global.fetch=async(url,opts)=>{assert.equal(opts.headers['x-goog-api-key'],payload.apiKey);assert(!String(url).includes(payload.apiKey));if(!String(url).includes(':generateContent'))return Response.json({models:[model('gemini-3.1-flash-lite'),model('gemini-2.5-flash-lite'),model('gemini-3.1-pro'),model('gemini-3.1-flash-image')]});return generate(url,opts);};}
(async()=>{
  assert.equal(gemini.filterModels([model('gemini-3.1-flash-lite'),model('gemini-2.5-flash-lite'),model('gemini-3.1-pro'),model('gemini-3.1-flash-image')]).map(m=>m.id).join(','),'gemini-3.1-flash-lite,gemini-2.5-flash-lite');
  let calls=0;mock(async(url,opts)=>{calls++;assert(String(url).includes('gemini-3.1-flash-lite:'));assert(JSON.parse(opts.body).systemInstruction.parts[0].text.includes('F15'));return success();});
  const result=await POST(req());assert.equal(result.status,200);const p=await result.json();assert.equal(p.remaining.F04,30);assert.equal(p.model,'gemini-3.1-flash-lite');assert(!JSON.stringify(p).includes(payload.apiKey));
  assert.equal((await POST(req({...payload,known:['inventado']}))).status,400);assert.equal(calls,1);
  const listed=await(await modelsPOST(req({apiKey:payload.apiKey}))).json();assert.equal(listed.models.length,2);assert(!JSON.stringify(listed).includes(payload.apiKey));
  mock(async()=>success());assert.equal((await POST(req({...payload,model:'gemini-removed-flash'}))).status,422);
  mock(async()=>Response.json({error:{}},{status:404}));const absent=await(await POST(req())).json();assert.equal(absent.code,'model_unavailable');assert(!absent.error.includes('inválida'));
  mock(async()=>Response.json({error:{}},{status:429}));assert.equal((await POST(req())).status,429);
  global.fetch=async()=>Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400});const badKey=await(await modelsPOST(req({apiKey:payload.apiKey}))).json();assert.equal(badKey.code,'invalid_key');
  mock(async()=>success([{id:'inventado',reason:'x'}]));assert.equal((await POST(req())).status,502);
  mock(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:false,alternatives:[],message:'Tema ausente',gaps:[],questions:[],recommendations:[]})}]}}]}));assert.equal((await(await POST(req())).json()).ids.length,0);
  assert.equal((await POST(new Request('https://example.test/api/recommend',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'}))).status,403);
  let pages=0;global.fetch=async(url)=>{pages++;return Response.json(pages===1?{models:[model('gemini-2.5-flash')],nextPageToken:'page-two'}:{models:[model('gemini-3.1-flash-lite')]});};assert.equal((await gemini.listModels(payload.apiKey)).length,2);assert.equal(pages,2);
  mock(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:false,message:'Não existe Power BI.',gaps:[],questions:[],recommendations:[],alternatives:[{id:'F04',similarity:'Visualização de dados e dashboards',limitations:'Usa Excel, não ensina Power BI'}]})}]}}]}));
  const alternative=await(await POST(req({...payload,goal:'Aprender Power BI'}))).json();assert.equal(alternative.analysis.alternatives[0].id,'F04');assert.equal(alternative.ids.length,0);assert.equal(alternative.rows.length,0);
  mock(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:false,message:'Ausente',gaps:[],questions:[],recommendations:[],alternatives:[{id:'inventado',similarity:'x',limitations:'x'}]})}]}}]}));assert.equal((await POST(req())).status,502);
  const saved=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;assert.equal((await POST(req())).status,503);process.env.GEMINI_API_KEY=saved;const validAuth=authMock.requireSession;authMock.requireSession=async()=>{const e=new Error('Inicia sessão');e.name='AppError';e.status=401;throw e;};assert.equal((await modelsPOST(req())).status,401);assert.equal((await POST(req())).status,401);authMock.requireSession=validAuth;
  console.log('PASS: model discovery/ranking/filtering/pagination; removed model; invalid key distinct from 404 and 429; endpoint success; catalog rejection; schedules; no credential disclosure.');
})().catch(e=>{console.error(e);process.exitCode=1;});

