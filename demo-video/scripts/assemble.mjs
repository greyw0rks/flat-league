import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const api='http://127.0.0.1:4311';
const timeline=JSON.parse(await readFile(path.join(root,'timeline.json'),'utf8'));
const voiceMeta=JSON.parse(await readFile(path.join(root,'assets/audio/voice-manifest.json'),'utf8'));
assert.equal(voiceMeta.voiceId,'7EzWGsX10sAS4c9m9cPf');
const backup=await(await fetch(api+'/api/project')).json();
await mkdir(path.join(root,'output'),{recursive:true});
if(backup.id!=='flat-league-workflow-demo')await writeFile(path.join(root,'output/previous-active-project.json'),JSON.stringify(backup,null,2)+'\n');
await mkdir(path.join(root,'sequence-media'),{recursive:true});
const imports=[];
async function importAsset(file){
  const form=new FormData();form.append('file',new Blob([await readFile(file)]),path.basename(file));
  const response=await fetch(api+'/api/assets',{method:'POST',body:form});
  if(!response.ok)throw new Error('Sequence asset import failed: HTTP '+response.status);
  const asset=await response.json();
  await copyFile(file,path.join(root,'sequence-media',path.basename(asset.src)));
  imports.push(asset);return asset;
}
const clips={};
for(const scene of timeline)clips[scene.id]=await importAsset(path.join(root,'assets',scene.id+'.mp4'));
const voice=await importAsset(path.join(root,'assets/audio/narration.wav'));
const logo=await importAsset(path.join(root,'assets/flat-league-mark.png'));
const project={
  version:1,id:'flat-league-workflow-demo',name:'Flat League',fps:30,aspect:'16:9',theme:'light',
  brief:'Hackathon workflow demo, under three minutes. Recorded local Anvil/MockWIF funding, a separate zero-token/zero-gas player, sponsored registration, timed quiz, hidden live scores, actual signed settlement and confirmed ten-token payout. Public sample challenges remain excluded. Current hosted MVP is Robinhood Chain testnet/MockWIF; no mainnet WIF proof claimed. ElevenLabs Jack John – Conversational and Upbeat. User renders, exports and uploads from Sequence Studio.',
  footerLabel:'LOCAL PLAYGROUND · MOCKWIF TEST REWARDS · RECORDED & EDITED WORKFLOW',
  scenes:timeline.map(scene=>({id:scene.id,name:scene.name,title:scene.title,subtitle:scene.subtitle,duration:scene.duration,layout:'demo',color:'#6350d8',media:clips[scene.id].src,mediaType:'video',engine:'remotion',notes:scene.narration.join('\n')+'\nSource: actual Flat League interface at local Anvil chain 31337. Recorded footage; local MockWIF test rewards.'})),
  assets:imports,brandMark:logo.src,
  audio:{src:voice.src,name:'Flat League · ElevenLabs Jack John – Conversational and Upbeat',volume:1,muted:false,narration:timeline.flatMap(scene=>scene.narration).join(' ')}
};
const response=await fetch(api+'/api/project',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(project)});
if(!response.ok)throw new Error('Sequence project save failed: HTTP '+response.status);
await writeFile(path.join(root,'sequence-project.json'),JSON.stringify(project,null,2)+'\n');
assert.deepEqual(await(await fetch(api+'/api/projects/'+project.id)).json(),project);
console.log('Flat League ready in Sequence Studio: '+voiceMeta.duration+'s, '+project.scenes.length+' scenes. No render job started.');
