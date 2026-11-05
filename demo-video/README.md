# Flat League demo

An editable Sequence Studio walkthrough of the working app, with ElevenLabs **Jack John – Conversational and Upbeat** narration. Eight scenes, 103.5 seconds, 16:9, 1920 × 1080, 30 fps.

## Open and export

Open **http://127.0.0.1:4310** and choose **Flat League** in the project picker. The footage and narration are already imported. Play the preview and adjust any scene text or duration before exporting.

You own the render and export. In **Exports**, select **Full resolution · high quality**, then **Render MP4**. Download the finished MP4 from render history. Upload it as a public or unlisted video and paste that URL into the submission form. The agent has not started a render job or exported a final video.

If the editor is stopped, run `pnpm dev` in `/home/greyw0rks/sequence-studio`. Ports 4310 and 4311 are the editor and its API. The captured footage works without the app or chain running.

## What is shown

Actual recorded app footage: illustrated landing/lobby, creator authoring and sample question selection, creator approval/funding, a separate wallet with no tokens or gas, sponsored registration, a timed quiz and reload recovery, signed settlement, a confirmed ten-token payout, and a closing invitation.

The persistent footer labels the footage **LOCAL PLAYGROUND · MOCKWIF TEST REWARDS · RECORDED & EDITED WORKFLOW**. It was recorded on Anvil chain 31337 and uses MockWIF, not mainnet $WIF. The hosted MVP is Robinhood Chain testnet with MockWIF. The recorded round is excluded from public challenge lists, rankings and profile totals; its direct results and genuine local receipts are retained in `assets/capture-manifest.json`. A single eligible winner receives the whole pool under the implemented allocation rules.

The wallet provider is an automated local test bridge using public Anvil creator credentials and a fresh player wallet. The recording makes no claim of independent-user adoption or unique-human verification. Answers come from the disclosed public sample question pack. No live mainnet or Robinhood testnet financial transaction was sent for this recording.

The source clips cover the lower-left Next development indicator with a small **LOCAL TEST** label. Source cuts and the overlay rectangle are documented in the media manifest; the raw recordings remain available locally.

For this recording, the existing worker runs with `--once` in fresh processes. SQLite locks encountered during preparation led to a native SQLite connection, a shared queue for clients in one process, and schema-version checks that skip unchanged startup migrations. Sixteen backend tests pass, including startup reads while another process holds a write transaction. Continuous worker operation is not established by this demo. The hosted app uses PostgreSQL. All registration, settlement and payout effects shown are actual worker jobs and confirmed local receipts.

## Files

- `sequence-project.json`: complete editable project.
- `sequence-media/`: imported videos, stereo narration and original logo, with the media names referenced by the project.
- `timeline.json`, `scenes.json`: scene timing, script and notes.
- `edit-decisions.json`: reviewed source cuts tied to this exact recording. They remove inactive registration waits; fresh captures use their full ranges until reviewed.
- `assets/capture-manifest.json`: actual round, receipts, recording ranges and checks.
- `assets/audio/voice-manifest.json`: confirmed voice ID, narration timing and caption cues.
- `output/flat-league-demo.srt`: optional subtitle sidecar for the upload.
- `output/review/` and `output/verification.json`: reviewed live previews and verification evidence.

The portable ZIP contains the project, `sequence-media`, narration/subtitles and review evidence. On another Sequence installation, copy `sequence-media` into that studio's `.data/media` directory without renaming its files, then choose **Exports → Import project JSON** and select `sequence-project.json`. Keep the media with the JSON.

## Reproduce preparation

Run from the Flat League repository. Narration uses the configured ElevenLabs credential outside the project. Recording refuses non-local chains and preserves the existing playground.

```sh
node demo-video/scripts/elevenlabs.mjs
python3 demo-video/scripts/assemble-audio.py
pnpm exec tsx demo-video/scripts/capture.ts
node demo-video/scripts/prepare-media.mjs
node demo-video/scripts/assemble.mjs
node demo-video/scripts/verify.mjs
python3 demo-video/scripts/package.py
```

These commands prepare source media and an editable project. They do not render/export the final film. To record, the app's configured SIWE domain must match the browser URL; the current local configuration uses `http://localhost:3020`. Sequence uses the numeric address above.

Stop any separate persistent local worker before rerunning capture. The capture script runs the one-shot worker itself, marks fixtures through a short-lived SQLite connection, and retains the recorded competition's state. The recorded preview uses `FLAT_BUILD_DIR=.next-video pnpm dev`, with dynamic routes warmed before scheduling a five-minute event. The player still has a real two-minute quiz timer. Failed preparation rounds and their receipts remain preserved as hidden fixtures.

Local test-wallet recovery state is kept under ignored `assets/runtime/`, with private key/session files restricted to their owner. It is excluded from the portable ZIP and source publication.

## Credits

Interface and original orbital logo: Flat League. Game-world artwork: the builder's Arcadia GoodBuilders project; see `public/world/README.md` in the app repository. Typeface in the recorded interface: Manrope, with its OFL license included in the repository. Editor: Sequence Studio with Remotion. Narration: ElevenLabs Jack John – Conversational and Upbeat, voice `7EzWGsX10sAS4c9m9cPf`, model `eleven_multilingual_v2`. ElevenLabs exposes the same voice under the account alias “Jack John – Natural Customer Support Agent”; the shared-library entry confirms the requested voice name and identical ID.
