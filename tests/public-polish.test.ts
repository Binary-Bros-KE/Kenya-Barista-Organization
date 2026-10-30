import {applicationReturnPath,authDestination} from "../src/lib/auth-destination";

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PathnameContext} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {publicPhoto,publicArticleHtml} from "../src/lib/public-photo";
import manifest from "../src/content/optimized-photos.json";
import NotFound from "../src/app/not-found";
import AccessDenied from "../src/app/access-denied/page";
test("web photo variants exist, are WebP, and reduce delivery bytes while originals remain intact",()=>{let before=0,after=0;for(const [original,item]of Object.entries(manifest)){const source=resolve(process.cwd(),'public'+original);assert.ok(existsSync(source));assert.equal(statSync(source).size,item.originalBytes);before+=item.originalBytes;for(const [variant,bytes] of [[item.large,item.largeBytes],[item.small,item.smallBytes]] as const){assert.ok(variant.startsWith('/optimized/'));const file=readFileSync(resolve(process.cwd(),'public'+variant));assert.equal(file.length,bytes);assert.equal(file.toString('ascii',0,4),'RIFF');assert.equal(file.toString('ascii',8,12),'WEBP');assert.ok(bytes<item.originalBytes,original);}assert.equal(publicPhoto(original),item.large);assert.equal(publicPhoto(original,'small'),item.small);after+=item.largeBytes;}assert.ok(Object.keys(manifest).length>20);assert.ok(after<before*.2);});
test("unmapped photos retain their original source, including missing asset fallbacks",()=>{for(const src of ['/brand-logo.png','/legacy/unmapped.jpg',''])assert.equal(publicPhoto(src),src);});
test("article optimization changes only mapped image sources and preserves reviewed article content",()=>{const [src,item]=Object.entries(manifest)[0];const html='<div><h3>Coffee craft</h3><p>'+src+'</p><img src="'+src+'" alt="Coffee photo"/><a href="'+src+'">Original</a><img src="/legacy/unmapped.jpg"/></div>';assert.equal(publicArticleHtml(html),html.replace('<img src="'+src+'"','<img src="'+item.large+'"'));assert.equal(publicArticleHtml(publicArticleHtml(html)),publicArticleHtml(html));});
test("not-found and access-denied provide branded, accessible recovery without changing access gates",()=>{for(const Component of [NotFound,AccessDenied]){const html=renderToStaticMarkup(createElement(PathnameContext.Provider,{value:'/missing'},createElement(Component)));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/id="main-content"/g)||[]).length,1);assert.ok(html.includes('site-navigation'));assert.ok(html.includes('site-footer'));assert.ok(html.includes('href="/jobs"'));}const denied=renderToStaticMarkup(createElement(PathnameContext.Provider,{value:'/access-denied'},createElement(AccessDenied)));assert.ok(denied.includes('href="/dashboard"'));});

test("application sign-in destinations preserve only local job paths and reject redirect injection",()=>{for(const bad of [null,undefined,'https://evil.test','//evil.test','/admin','/jobs/a/apply?next=//evil.test','/jobs/../apply','/jobs/a%2F..%2Fadmin/apply','/jobs/a/apply#x'])assert.equal(applicationReturnPath(bad),'/dashboard');const next='/jobs/head-barista/apply';assert.equal(applicationReturnPath(next),next);for(const route of ['/sign-in','/register','/two-factor','/verify-email','/reset-password','/sign-in?verified=1']){const url=new URL(authDestination(route,next),'https://example.test');assert.equal(url.searchParams.get('next'),next);assert.equal(url.origin,'https://example.test');}assert.equal(authDestination('/sign-in','/dashboard'),'/sign-in');});
