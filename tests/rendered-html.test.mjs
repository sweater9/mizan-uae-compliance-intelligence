import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import worker from '../dist/server/index.js';
const ctx={waitUntil(){},passThroughOnException(){}};
test('production HTML renders Mizan without development metadata or provider branding',async()=>{
 const response=await worker.fetch(new Request('http://localhost/',{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('',{status:404})}},ctx);
 assert.equal(response.status,200);const html=await response.text();assert.match(html,/Mizan/);assert.doesNotMatch(html,/NVIDIA|nemotron|codex-preview/i);
});
test('compiled Worker supports Node undefined env and explicit Worker bindings',async()=>{
 const saved=process.env.NVIDIA_API_KEY;
 try{
  delete process.env.NVIDIA_API_KEY;
  const req=()=>new Request('http://localhost/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'General question'})});
  assert.equal((await worker.fetch(req(),undefined,ctx)).status,503);
  process.env.NVIDIA_API_KEY='runtime-only-sentinel';
  assert.equal((await worker.fetch(new Request('http://localhost/api/ready'),undefined,ctx)).status,200);
  assert.equal((await worker.fetch(req(),{},ctx)).status,503);
  assert.equal((await worker.fetch(new Request('http://localhost/api/ready'),{NVIDIA_API_KEY:'worker-key'},ctx)).status,200);
 }finally{if(saved===undefined)delete process.env.NVIDIA_API_KEY;else process.env.NVIDIA_API_KEY=saved;}
});
test('client artifacts exclude server configuration and infrastructure branding',async()=>{
 for(const entry of await readdir(new URL('../dist/client/',import.meta.url),{recursive:true})){
  if(!/\.(js|html)$/.test(entry))continue;
  const text=await readFile(new URL('../dist/client/'+entry,import.meta.url),'utf8');
  assert.doesNotMatch(text,/NVIDIA_API_KEY|NVIDIA_NIM|integrate\.api\.nvidia|qa-build-secret-sentinel|NVIDIA-backed/);
 }
});
