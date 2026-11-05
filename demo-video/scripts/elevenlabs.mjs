import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const voiceId='7EzWGsX10sAS4c9m9cPf';
const voiceLabel='Jack John - Conversational and Upbeat';
const model='eleven_multilingual_v2';
let key=process.env.ELEVENLABS_API_KEY;
if(!key){
  const content=await readFile(process.env.ELEVENLABS_KEY_FILE||'/home/greyw0rks/keys.txt','utf8');
  const candidates=[...new Set([...content.matchAll(/\bsk_[A-Za-z0-9_-]+/g)].map(m=>m[0]))];
  if(candidates.length===1)key=candidates[0];
}
if(!key)throw new Error('ElevenLabs credential missing or ambiguous; keep it outside the project.');
const headers={'xi-api-key':key,'content-type':'application/json'};
const voiceResponse=await fetch('https://api.elevenlabs.io/v1/voices/'+voiceId,{headers,signal:AbortSignal.timeout(30_000)});
if(!voiceResponse.ok)throw new Error('Jack John voice access failed: HTTP '+voiceResponse.status+'. No credentials displayed.');
const voice=await voiceResponse.json();
console.log('ElevenLabs voice: '+voiceLabel+'; API alias: '+voice.name+'; model: '+model);
if(process.argv.includes('--check'))process.exit(0);
const scenes=JSON.parse(await readFile(path.join(root,'scenes.json'),'utf8'));
const dir=path.join(root,'assets/audio/elevenlabs');
await mkdir(dir,{recursive:true});
const manifest={provider:'elevenlabs',voiceId,voiceName:voiceLabel,apiVoiceName:voice.name,model,createdAt:new Date().toISOString(),scenes:[]};
for(const scene of scenes){
  const takes=[];
  for(const [i,text] of scene.narration.entries()){
    const identity=createHash('sha256').update(JSON.stringify({text,voiceId,model})).digest('hex');
    const file=path.join(dir,scene.id+'-'+(i+1)+'.mp3');
    let cached=false;
    try{cached=JSON.parse(await readFile(file+'.json','utf8')).identity===identity;await readFile(file);}catch{}
    if(!cached){
      const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+voiceId+'/with-timestamps?output_format=mp3_44100_128',{
        method:'POST',headers,signal:AbortSignal.timeout(120_000),
        body:JSON.stringify({text,model_id:model,voice_settings:{stability:0.5,similarity_boost:0.75,style:0.15,use_speaker_boost:true}})
      });
      if(!response.ok){
        let code='unknown';try{const error=await response.json();code=String(error.detail?.status||error.detail?.code||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);}catch{}
        throw new Error('ElevenLabs narration failed for '+scene.id+': HTTP '+response.status+', '+code+'. No credentials displayed.');
      }
      const result=await response.json();
      if(!result.audio_base64)throw new Error('ElevenLabs returned no audio.');
      await writeFile(file,Buffer.from(result.audio_base64,'base64'));
      await writeFile(file+'.alignment.json',JSON.stringify({alignment:result.alignment,normalized_alignment:result.normalized_alignment},null,2)+'\n');
      await writeFile(file+'.json',JSON.stringify({identity,text,voiceId,voiceName:voiceLabel,apiVoiceName:voice.name,model},null,2)+'\n');
    }
    const wav=file.replace(/\.mp3$/,'.wav');
    execFileSync('ffmpeg',['-y','-v','error','-i',file,'-ar','48000','-ac','1',wav]);
    const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',wav],{encoding:'utf8'}).trim());
    if(!(seconds>0))throw new Error('Generated narration has no duration.');
    takes.push({text,file:path.basename(wav),seconds,alignmentFile:path.basename(file)+'.alignment.json'});
    console.log(scene.id+': '+seconds.toFixed(2)+'s'+(cached?' (cached)':''));
  }
  manifest.scenes.push({id:scene.id,takes});
  await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log('Jack John narration ready. No video render/export started.');
