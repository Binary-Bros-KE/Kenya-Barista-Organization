import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const base='/home/evans/barista-platform', release=fs.realpathSync(process.cwd());
function requireThat(condition,message){if(!condition)throw new Error(message);}
try {
  requireThat(release.startsWith(base+'/releases/'),'Run from a dedicated Barista release directory');
  requireThat(process.versions.node.split('.')[0]==='24','Use the isolated Node 24 runtime');
  const config=parseEnv(fs.readFileSync(base+'/shared/app.env','utf8'));
  requireThat(config.APP_URL==='https://barista-staging.tanzhotelms.com','Unexpected staging origin');
  const db=new URL(config.DATABASE_URL);
  requireThat(db.hostname==='127.0.0.1'&&db.port==='5432'&&db.pathname==='/barista_staging'&&db.username==='barista_staging','Only the dedicated staging database is allowed');
  requireThat(/^[a-f0-9]{64}$/.test(config.PAYMENT_ENCRYPTION_KEY||'')&&(config.AUTH_SECRET||'').length>=32,'Private application secrets are missing');
  requireThat(config.PRIVATE_UPLOAD_DIR===base+'/shared/cvs','Unexpected private CV directory');
  const env={HOME:'/home/evans',USER:'evans',PATH:base+'/runtime/node/bin:/usr/bin:/bin',TZ:'Africa/Nairobi',...config,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'};
  delete env.NEXT_DIST_DIR; delete env.SHADOW_DATABASE_URL;
  const mode=process.argv[2];
  function run(args){const result=spawnSync(base+'/runtime/node/bin/npm',args,{cwd:release,env,stdio:'inherit'});requireThat(result.status===0,'Release command failed; current release was not selected');}
  if(mode==='build'){
    run(['ci','--include=dev']);
    // Deployment migrations are restricted to this empty/separate staging database.
    run(['run','db:deploy']); run(['run','build']);
    fs.writeFileSync('.barista-built.json',JSON.stringify({origin:config.APP_URL,node:process.version,builtAt:new Date().toISOString()}));
    console.log('Release built. No application process or current-release pointer changed.');
  }else if(mode==='select'||mode==='check'){
    requireThat(config.EMAIL_MODE==='smtp'&&!!config.SMTP_HOST&&!!config.SMTP_FROM,'Configure real SMTP before selecting the release');
    requireThat(Boolean(config.SMTP_USER)===Boolean(config.SMTP_PASSWORD),'SMTP authentication fields must be configured together');
    requireThat(fs.existsSync('.next/BUILD_ID')&&fs.existsSync('.barista-built.json'),'Build the release first');
    if(mode==='check'){console.log('Staging release configuration checks passed.');process.exit(0);}
    const current=path.join(base,'current');
    if(fs.existsSync(current)){requireThat(fs.lstatSync(current).isSymbolicLink(),'Refusing to replace a real current directory');fs.writeFileSync(base+'/shared/previous-release',fs.realpathSync(current)+'\n',{mode:0o600});}
    const temporary=path.join(base,'current-'+process.pid);fs.symlinkSync(release,temporary);fs.renameSync(temporary,current);
    console.log('Release selected. A privileged activation step must start the new services.');
  }else throw new Error('Choose build, select or check');
}catch(error){console.error(error instanceof Error?error.message:'Staging release preparation failed');process.exitCode=1;}
