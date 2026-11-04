# Game UI update

Flat League now follows the Arcadia GoodBuilders game interface: warm light surfaces, lavender game areas, floating trophy/question/chest artwork, Manrope headings, clear play buttons and a compact sidebar/mobile navigation. The landing, discovery lobby, challenge cards, round details, rankings, results, forms and quiz share this visual language.

The lobby features an actual live/upcoming round when one exists and otherwise shows the honest first-round state. Counts and prize pools come from server data. The art is decorative; no new XP, streak, reward or participant data is fabricated.

Seeded local challenges and browser verification rounds are marked by exact IDs in private `fl_state` entries with a `demo-round:` prefix. Public discovery and rankings omit marked rounds, and profile reward totals omit their rewards. Retained funding/result evidence stays available by its original direct URL. Local deployment and the lifecycle check mark new fixtures automatically. `pnpm exec tsx scripts/hide-local-demo-rounds.ts` identifies and marks the historical local fixtures; it refuses non-Anvil networks. The hosted API returned no rounds during this review.

Validation includes type checking, backend tests, responsive browser checks at 1440/768/390/360px, keyboard wallet focus restoration, filters/search, reduced motion and result podium layout. Three-player result screenshots are browser-only fixtures using retained local evidence and do not enter the public list. No new funding, play, settlement or reward transaction was sent for this redesign.

The final production build and standalone typecheck pass. Backend tests: 14 pass, with the optional PostgreSQL integration suite skipped because no isolated test database URL was supplied. The responsive review passes with zero browser runtime errors, an actual retained result, and a labelled three-player fixture. The build retains nonfatal optional wallet dependency warnings.

[Complete submission copy](SUBMISSION.md), an original orbital square logo, and a shorter README are included in this source update. Demo video and mainnet $WIF transaction proof remain pending. Check the hosted deployment before using the live app for recording.

Preview the working edit at `http://127.0.0.1:3020/discover`. The legacy WebGL orbital scene is no longer mounted in the new game layout; artwork has no GPU dependency.
