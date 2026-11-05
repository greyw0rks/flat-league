"""Package editable media and review images; do not render a video."""
import json
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
project=json.loads((root/'sequence-project.json').read_text())
report=json.loads((root/'output/verification.json').read_text())
assert report['status']=='passed'
assert (root/'output/review/contact-sheet.png').is_file()
archive=root/'flat-league-sequence-kit.zip'
include=[root/'README.md',root/'BRIEF.md',root/'scenes.json',root/'timeline.json',root/'edit-decisions.json',root/'sequence-project.json',root/'output/flat-league-demo.srt',root/'output/verification.json',root/'assets/capture-manifest.json',root/'assets/media-manifest.json',root/'assets/audio/voice-manifest.json']
include+=sorted((root/'sequence-media').glob('*'))
include+=sorted((root/'output/review').glob('*'))
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as kit:
    for file in include:
        assert file.is_file(),file
        kit.write(file,str(file.relative_to(root)))
with zipfile.ZipFile(archive) as kit:
    assert kit.testzip() is None
    names=kit.namelist()
    assert 'sequence-project.json' in names
    for asset in project['assets']:
        assert 'sequence-media/'+Path(asset['src']).name in names
print(f'Portable Sequence kit: {archive}, {archive.stat().st_size/1024/1024:.1f} MB; no final video exported.')
