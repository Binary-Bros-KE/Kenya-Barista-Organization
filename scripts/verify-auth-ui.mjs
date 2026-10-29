import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const base='/home/evans/barista-platform',release=process.cwd();
const origin='http://127.0.0.1:3220';
const child=spawn(base+'/runtime/node/bin/node',[release+'/node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3220'],{cwd:release,env:{...process.env,PORT:'3220'},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',data=>{log+=data;});child.stderr.on('data',data=>{log+=data;});
try{
 let ready=false;for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error('Preview exited');try{const response=await fetch(origin+'/api/ready');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 assert.ok(ready,'Preview readiness');
 const routes=['/sign-in','/register','/forgot-password','/reset-password','/verify-email','/two-factor','/invitations/accept'];
 let stylesheet='';
 for(const route of routes){const response=await fetch(origin+route);assert.equal(response.status,200,route);const html=await response.text();assert.ok(html.includes('aria-label="Main navigation"'),route+' navigation');assert.ok(html.includes('class="legacy-footer"'),route+' footer');assert.ok(html.includes('legacy-header-compact'),route+' compact header');assert.ok(html.includes('class="legacy-auth-content"'),route+' website form content');assert.ok(html.includes('class="legacy-brand-logo"'),route+' logo navigation');assert.ok(html.includes('src="/brand-logo.png"'),route+' existing logo');assert.ok(!html.includes('class="card mt-12"'),route+' removed isolated card');if(route==='/sign-in'){assert.ok(html.includes('name="email"'));assert.ok(html.includes('name="password"'));assert.ok(html.includes('href="/forgot-password"'));stylesheet=[...html.matchAll(/href="([^" ]+\.css[^" ]*)"/g)].map(match=>match[1]);}console.log('PASS '+route+' shared website layout');}
 let css='';for(const url of stylesheet){const response=await fetch(origin+url);assert.equal(response.status,200);css+=await response.text();}assert.ok(css.includes('.legacy-auth-content'));assert.ok(css.includes('.legacy-header-compact'));console.log('PASS compiled account-page CSS');
 for(const route of ['/','/jobs','/gallery']){const response=await fetch(origin+route);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('class="legacy-brand-logo"'));assert.ok(!html.includes('<header class="legacy-header legacy-header-compact"'));console.log('PASS '+route+' public layout retained');}
 for(const asset of ['/brand-logo.png','/legacy/roboto-condensed.ttf']){const response=await fetch(origin+asset);assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>0);console.log('PASS '+asset);}
 fs.writeFileSync('.ui-verified.json',JSON.stringify({verifiedAt:new Date().toISOString(),authRoutes:routes,publicRoutes:['/','/jobs','/gallery'],assets:true,compiledCss:true,browserVisualQa:false},null,2));
 console.log('HTTP/layout checks passed. Browser-controlled visual QA unavailable.');
}finally{child.kill('SIGTERM');if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},5000))]);}
