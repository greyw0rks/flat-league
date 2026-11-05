import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire('/home/greyw0rks/sequence-studio/package.json')('@playwright/test');
const project=JSON.parse(await readFile(path.join(root,'sequence-project.json'),'utf8'));
const voice=JSON.parse(await readFile(path.join(root,'assets/audio/voice-manifest.json'),'utf8'));
const capture=JSON.parse(await readFile(path.join(root,'assets/capture-manifest.json'),'utf8'));
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const frames=project.scenes.reduce((n,s)=>n+Math.round(s.duration*30),0);
assert.equal(frames,Math.round(voice.duration*30));assert.ok(frames/30<180);
assert.equal(voice.voiceId,'7EzWGsX10sAS4c9m9cPf');assert.equal(voice.voiceName,'Jack John - Conversational and Upbeat');
assert.equal(capture.status,'passed');assert.equal(capture.publicRoundsAfterRecording,0);assert.equal(capture.mainnetWifProof,false);
assert.ok(capture.rewardHash&&capture.settlementHash);assert.deepEqual(capture.browserErrors,[]);
for(const scene of project.scenes){
  const media=probe(path.join(root,'sequence-media',path.basename(scene.media)));
  assert.ok(Math.abs(Number(media.format.duration)-scene.duration)<.05,scene.id+' duration');
  assert.ok(media.streams.some(s=>s.codec_name==='h264'&&s.width===1440&&s.height===616),scene.id+' source format');
}
const audio=probe(path.join(root,'sequence-media',path.basename(project.audio.src)));
assert.ok(Math.abs(Number(audio.format.duration)-frames/30)<.05);
assert.ok(audio.streams.some(s=>s.codec_type==='audio'&&s.channels===2));
await mkdir(path.join(root,'output/review'),{recursive:true});
const report={verifiedAt:new Date().toISOString(),duration:frames/30,frames,voice:voice.voiceName,source:'Local Anvil/MockWIF recorded workflow',scenes:[],browserErrors:[],agentRenderRequests:[],exportedByAgent:false};
const browser=await chromium.launch({headless:true,executablePath:'/home/greyw0rks/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  page.on('pageerror',e=>report.browserErrors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/render')report.agentRenderRequests.push(r.url());});
  assert.deepEqual(await(await page.request.get('http://127.0.0.1:4311/api/projects/'+project.id)).json(),project);
  const jobs=await(await page.request.get('http://127.0.0.1:4311/api/jobs')).json();
  report.existingRenderJobs=jobs.map(j=>({id:j.id,name:j.name,status:j.status}));
  await page.goto('http://127.0.0.1:4310',{waitUntil:'networkidle',timeout:60_000});
  await page.getByRole('textbox',{name:'Headline',exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'output/review/studio.png'),fullPage:true});
  for(const scene of project.scenes){
    await page.getByRole('button',{name:'Seek to '+scene.name,exact:true}).click();
    assert.equal(await page.getByRole('textbox',{name:'Headline',exact:true}).inputValue(),scene.title);
    await page.getByRole('button',{name:'Play preview',exact:true}).click();
    await page.waitForTimeout(2200);
    await page.getByRole('button',{name:'Pause preview',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.preview-stage video')].some(v=>v.readyState>=2&&!v.seeking),undefined,{timeout:20_000});
    const readiness=await page.locator('.preview-stage').evaluate(stage=>[...stage.querySelectorAll('video')].map(v=>({ready:v.readyState,time:v.currentTime,error:v.error?.message||null})));
    assert.ok(readiness.some(v=>v.ready>=2&&v.time>0&&!v.error),scene.id+' playback');
    await page.locator('.preview-stage').evaluate(stage=>Object.assign(stage.style,{position:'fixed',inset:'0',width:'1920px',height:'1080px',maxHeight:'none',minHeight:'1080px',margin:'0',padding:'0',border:'0',zIndex:'999999'}));
    await page.waitForTimeout(350);
    const file='output/review/'+scene.id+'.png';
    await page.locator('.preview-stage').screenshot({path:path.join(root,file)});
    report.scenes.push({id:scene.id,file,readiness});
    await page.locator('.preview-stage').evaluate(stage=>stage.removeAttribute('style'));
    console.log('Checked '+scene.id+' live preview.');
  }
  await page.getByRole('button',{name:'Seek to '+project.scenes[0].name,exact:true}).click();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.getByRole('textbox',{name:'Headline',exact:true}).inputValue(),project.scenes[0].title);
  const persisted=await(await page.request.get('http://127.0.0.1:4311/api/project')).json();assert.deepEqual(persisted,project);
  assert.deepEqual(report.browserErrors,[]);
  assert.deepEqual(report.agentRenderRequests,[],'Verification must not request a render.');
  report.renderJobsAfterCheck=(await(await page.request.get('http://127.0.0.1:4311/api/jobs')).json()).map(j=>({id:j.id,name:j.name,status:j.status}));
  report.persistence='passed';report.status='passed';
  const panels=await Promise.all(report.scenes.map(async(s,i)=>'<figure><figcaption>'+project.scenes[i].name+'</figcaption><img src="data:image/png;base64,'+(await readFile(path.join(root,s.file))).toString('base64')+'"></figure>'));
  await page.setViewportSize({width:1280,height:1544});
  await page.setContent('<style>body{margin:0;background:#ede7fc;font:16px sans-serif;color:#211d36;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;box-sizing:border-box}figure{margin:0}figcaption{height:22px}img{display:block;width:100%}</style>'+panels.join(''));
  await page.screenshot({path:path.join(root,'output/review/contact-sheet.png'),fullPage:true});
  console.log('PASS: '+frames+' frames, '+project.scenes.length+' moving source previews, Jack John stereo narration, persistence, zero browser errors, zero agent render requests.');
}finally{
  await writeFile(path.join(root,'output/verification.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
