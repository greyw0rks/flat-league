import { readFile } from 'node:fs/promises';
const candidates=[...new Set([...((await readFile('/home/greyw0rks/keys.txt','utf8')).matchAll(/\bsk_[A-Za-z0-9_-]+/g))].map(m=>m[0]))];
if(candidates.length!==1)throw new Error('Ambiguous ElevenLabs credential.');
for(const endpoint of ['/v1/voices/7EzWGsX10sAS4c9m9cPf','/v1/shared-voices?search=Jack%20John&page_size=100']){
  const r=await fetch('https://api.elevenlabs.io'+endpoint,{headers:{'xi-api-key':candidates[0]},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error('Voice metadata request failed: HTTP '+r.status);
  const data=await r.json();
  const voices=data.voices||[data];
  console.log(JSON.stringify({endpoint,voices:voices.map(v=>({name:v.name,voiceId:v.voice_id,description:v.description,originalVoiceId:v.sharing?.original_voice_id,publicOwnerId:v.public_owner_id||v.sharing?.public_owner_id}))},null,2));
}
