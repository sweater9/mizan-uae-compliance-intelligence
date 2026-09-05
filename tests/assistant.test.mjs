import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAssistant } from '../server/assistant.mjs';
import { serverConfig } from '../server/config.mjs';
import { health } from '../server/health.mjs';
const bindings = { NVIDIA_API_KEY: 'test-only-secret', CORS_ORIGIN: 'https://example.com' };
const request = (body = { question: 'Explain generally' }, headers = {}, method = 'POST') => new Request('https://mizan.test/api/assistant', { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
const success = async () => Response.json({ choices: [{ message: { content: 'Please confirm with the relevant authority.' } }] });
test('Node fallback, explicit binding isolation and late runtime values', () => {
 const previous = process.env.NVIDIA_API_KEY;
 try {
  process.env.NVIDIA_API_KEY = 'node-one'; assert.equal(serverConfig().apiKey, 'node-one');
  process.env.NVIDIA_API_KEY = 'node-two'; assert.equal(serverConfig().apiKey, 'node-two');
  assert.equal(serverConfig({}).apiKey, ''); assert.equal(serverConfig(bindings).apiKey, bindings.NVIDIA_API_KEY);
 } finally { if(previous===undefined)delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY=previous; }
});
test('safe when global process is absent', () => {
 const saved=globalThis.process;
 try { globalThis.process=undefined; assert.equal(serverConfig().ready,false); assert.equal(serverConfig(bindings).ready,true); }
 finally { globalThis.process=saved; }
});
test('endpoint validation and model precedence', () => {
 assert.equal(serverConfig({...bindings,NVIDIA_NIM_BASE_URL:'http://unsafe.test'}).ready,false);
 assert.equal(serverConfig({...bindings,NVIDIA_NIM_MODEL:'preferred',NVIDIA_MODEL:'old'}).model,'preferred');
 assert.equal(serverConfig({...bindings,RENDER_GIT_COMMIT:'1234567890abcdef'}).revision,'1234567890ab');
});
test('validation rejects malformed, null, missing, wrong-type and oversized questions', async () => {
 for(const body of ['{',null,{},[],{question:3},{question:' '},{question:'a'.repeat(4001)}]) assert.equal((await handleAssistant(request(body),bindings,success)).status,400);
 assert.equal((await handleAssistant(request({question:'ok'},{'Content-Type':'text/plain'}),bindings,success)).status,415);
 assert.equal((await handleAssistant(request('x'.repeat(24001)),bindings,success)).status,413);
});
test('CORS preflight matches POST and rejects arbitrary origins',async()=>{
 const preflight=await handleAssistant(request(undefined,{Origin:'https://example.com'},'OPTIONS'),bindings,success);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://example.com');
 const denied=await handleAssistant(request(undefined,{Origin:'https://attacker.test'}),bindings,success);
 assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
 assert.equal((await handleAssistant(request(undefined,{},'GET'),bindings,success)).status,405);
});
test('missing configuration is a safe 503; readiness differs from liveness',async()=>{
 assert.equal((await handleAssistant(request(),{},success)).status,503);
 assert.equal(health({}).status,200);assert.equal(health({},true).status,503);assert.equal(health(bindings,true).status,200);
 assert.doesNotMatch(await health(bindings,true).text(),/test-only-secret|NVIDIA/i);
});
test('success uses runtime configuration without exposing secrets',async()=>{
 const response=await handleAssistant(request(),bindings,async(url,init)=>{
  assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer test-only-secret');assert.equal(init.redirect,'error');assert.ok(init.signal);
  return success();
 });
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).verified,false);
});
test('upstream errors, malformed shapes, huge responses, branding and exceptions are safe 502s',async()=>{
 for(const fetcher of [async()=>new Response('sensitive',{status:401}),async()=>new Response('{'),async()=>Response.json(null),async()=>Response.json({choices:[]}),async()=>new Response('x'.repeat(64001)),async()=>Response.json({choices:[{message:{content:'NVIDIA model'}}]}),async()=>{throw Error('secret');}]){
  const response=await handleAssistant(request(),bindings,fetcher);assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/secret|sensitive|NVIDIA/);
 }
});
test('upstream timeout returns 504 and releases concurrency slot',async()=>{
 const keepAlive=setTimeout(()=>{},1000);
 try {
  const response=await handleAssistant(request(),bindings,async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))),10);
  assert.equal(response.status,504);
  assert.equal((await handleAssistant(request(),bindings,success)).status,200);
 }finally{clearTimeout(keepAlive);}
});
test('concurrency cap sheds excess requests without invoking upstream',async()=>{
 const releases=[];
 const fetcher=()=>new Promise(resolve=>releases.push(()=>resolve(success())));
 const requests=Array.from({length:8},()=>handleAssistant(request(),bindings,fetcher));
 while(releases.length<8)await new Promise(resolve=>setTimeout(resolve,1));
 try { const response=await handleAssistant(request(),bindings,success);assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'20'); }
 finally { releases.forEach(release=>release());await Promise.all(requests); }
});
