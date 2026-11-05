import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'assets/capture-manifest.json'),'utf8'));
const timeline=JSON.parse(await readFile(path.join(root,'timeline.json'),'utf8'));
const edits=JSON.parse(await readFile(path.join(root,'edit-decisions.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error;}));
assert.equal(manifest.status,'passed','Only a completed genuine workflow may enter the demo.');
assert.equal(manifest.chainId,31337);assert.equal(manifest.publicRoundsAfterRecording,0);
assert.ok(manifest.rewardHash&&manifest.settlementHash);
const duration=file=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file],{encoding:'utf8'}).trim());
const metadata={source:'actual recorded Flat League browser workflow',network:'Local Anvil ONLY',token:'MockWIF',editorOverlay:{purpose:'Cover the Next development indicator with a LOCAL TEST label',x:15,y:555,width:127,height:48},clips:[]};
for(const scene of timeline){
  const segment=manifest.segments.find(s=>s.id===scene.id);assert.ok(segment,scene.id);
  const recorder=manifest.recorders.find(r=>r.name===segment.recorder);
  const file=path.join(root,'assets',recorder.file);
  const offset=Math.max(0,duration(file)-recorder.capturedSeconds);
  let ranges=[{start:offset+segment.start,seconds:segment.capturedSeconds}];
  if(edits.competitionId===manifest.competitionId&&edits.scenes?.[scene.id]){
    let previousEnd=0;
    ranges=edits.scenes[scene.id].map(range=>{
      assert.ok(range.start>=previousEnd&&range.seconds>0&&range.start+range.seconds<=segment.capturedSeconds+.001,'Source edit must remain chronological and inside its capture.');
      previousEnd=range.start+range.seconds;
      return {start:offset+segment.start+range.start,seconds:range.seconds};
    });
  }
  // A locator wait in the results capture is not story content. Retain the
  // confirmed podium and final evidence view, removing the inactive middle.
  if(scene.id==='results'&&segment.capturedSeconds>25){
    ranges=[{start:offset+segment.start,seconds:7},{start:offset+segment.end-9,seconds:9}];
  }
  const input=[];for(const range of ranges)input.push('-ss',String(range.start),'-t',String(range.seconds),'-i',file);
  const total=ranges.reduce((sum,r)=>sum+r.seconds,0);
  const output=path.join(root,'assets',scene.id+'.mp4');
  let filters;
  if(ranges.length===1)filters=`[0:v]setpts=${scene.duration/total}*(PTS-STARTPTS),fps=30,tpad=stop_mode=clone:stop_duration=1[v]`;
  else filters=ranges.map((r,i)=>`[${i}:v]setpts=PTS-STARTPTS[v${i}];`).join('')+ranges.map((r,i)=>`[v${i}]`).join('')+`concat=n=${ranges.length}:v=1:a=0,setpts=${scene.duration/total}*PTS,fps=30,tpad=stop_mode=clone:stop_duration=1[v]`;
  filters=filters.replace(/\[v\]$/,',drawbox=x=15:y=555:w=127:h=48:color=white:t=fill,drawtext=font=DejaVu Sans:text=LOCAL TEST:fontcolor=0x6350d8:fontsize=13:x=26:y=573[v]');
  execFileSync('ffmpeg',['-y','-v','error',...input,'-filter_complex',filters,'-map','[v]','-frames:v',String(Math.round(scene.duration*30)),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output]);
  assert.ok(Math.abs(duration(output)-scene.duration)<.04,scene.id+' duration');
  metadata.clips.push({id:scene.id,file:'assets/'+scene.id+'.mp4',duration:scene.duration,sourceRanges:ranges,sourceRecorder:recorder.file,playbackSpeed:total/scene.duration});
  console.log('Prepared '+scene.id+' source clip ('+scene.duration+'s).');
}
await copyFile(path.join(root,'../public/brand/flat-league.png'),path.join(root,'assets/flat-league-mark.png'));
await writeFile(path.join(root,'assets/media-manifest.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Source media prepared. No final video rendered or exported.');
