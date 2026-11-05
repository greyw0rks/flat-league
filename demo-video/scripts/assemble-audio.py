"""Place measured narration takes on an exact 30-fps editing timeline."""
import json
import math
import re
import subprocess
import wave
from pathlib import Path

root=Path(__file__).resolve().parents[1]
directory=root/'assets/audio/elevenlabs'
manifest=json.loads((directory/'manifest.json').read_text())
scenes=json.loads((root/'scenes.json').read_text())
rate=48000
step=rate//30
film=[]
timeline=[]
captions=[]
total=0
for scene,generated in zip(scenes,manifest['scenes'],strict=True):
    assert scene['id']==generated['id']
    at=round(.35*rate)
    parts=[b'\0'*(at*2)]
    for take in generated['takes']:
        with wave.open(str(directory/take['file']),'rb') as source:
            assert source.getframerate()==rate and source.getnchannels()==1 and source.getsampwidth()==2
            data=source.readframes(source.getnframes())
        alignment=json.loads((directory/take['alignmentFile']).read_text())['alignment']
        aligned=''.join(alignment['characters'])
        words=list(re.finditer(r'\S+',aligned))
        for first in range(0,len(words),8):
            batch=words[first:first+8]
            start=alignment['character_start_times_seconds'][batch[0].start()]
            end=alignment['character_end_times_seconds'][batch[-1].end()-1]
            captions.append({'start':(total+at)/rate+start,'end':(total+at)/rate+end,'text':' '.join(w.group() for w in batch)})
        count=len(data)//2
        pause=round(.2*rate)
        parts.extend([data,b'\0'*(pause*2)])
        at+=count+pause
    frames=math.ceil(max(scene['minimum']*rate,at+.65*rate)/step)
    samples=frames*step
    if frames/30>30:raise ValueError(scene['id']+' exceeds Sequence scene limit')
    parts.append(b'\0'*((samples-at)*2))
    film.extend(parts)
    timeline.append({**scene,'start':total/rate,'duration':frames/30})
    total+=samples
assert total/rate<180,'Submission video must remain under three minutes'
raw=root/'assets/audio/narration-raw.wav'
with wave.open(str(raw),'wb') as output:
    output.setparams((1,2,rate,0,'NONE','not compressed'))
    output.writeframes(b''.join(film))
subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar',str(rate),'-ac','2',str(root/'assets/audio/narration.wav')],check=True)
(root/'timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
(root/'assets/audio/voice-manifest.json').write_text(json.dumps({**{key:manifest[key] for key in ['provider','voiceId','voiceName','model']},'duration':total/rate,'sampleRate':rate,'loudnessTargetLUFS':-16,'captions':captions},indent=2)+'\n')
def stamp(t):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(root/'output').mkdir(exist_ok=True)
(root/'output/flat-league-demo.srt').write_text('\n\n'.join(f"{i+1}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c['text']}" for i,c in enumerate(captions))+'\n')
print(f'Narration ready: {total/rate:.2f}s, {len(timeline)} scenes; no video render/export started.')
