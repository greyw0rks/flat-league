# Flat League design and UI/UX specification

Design direction: a cinematic competition lobby with the precision of a premium terminal. The landing page creates atmosphere; discovery encourages participation; the quiz room gives the player complete focus.

Three.js, Framer Motion and GSAP are intentional parts of the design. This document specifies their implementation; it does not claim an animated application has already been built.

Review the [static visual reference](../design/visual-reference.png) or its [editable SVG](../design/visual-reference.svg) for the proposed desktop hierarchy and palette. All displayed competition activity is sample data.

## Identity and feel

Use dark architectural surfaces, bright cobalt actions, mint live signals, large editorial typography and a signature floating arena. Give the interface physical depth through the 3D scene, layered panels and controlled motion. Keep numbers, rules and deadlines sharp and legible.

Brand: **FLAT LEAGUE**. Tagline: **Compete for something real.** Hero: **YOUR SKILLS. / REAL REWARDS.** Supporting copy: “Free-to-enter challenges. Creator-funded WIF rewards. Your performance decides the result.”

The symbol combines a tilted orbital ellipse with a short equatorial bar, readable as an arena seen in perspective. Use our own mark; project branding does not incorporate Robinhood's name or logo. Network attribution is factual metadata in the wallet/rules UI.

Personality: competitive, precise, welcoming. Avoid military imagery, casino language, guaranteed-return copy, fake live counters and decorative wallet jargon. A newcomer should understand the challenge and prize before connecting.

## Palette and semantic tokens

| Token | Hex | Use |
| --- | --- | --- |
| `background` | `#080B12` | Main canvas; roughly 70% of the viewport |
| `surface` | `#111827` | Cards, drawers and app shell panels |
| `surface-raised` | `#172238` | Hovered cards, expanded controls, selected table row |
| `border` | `#27344A` | Subtle panel edges; not the only cue for interactive controls |
| `control-border` | `#64748B` | Input/control outlines when the fill alone is insufficient |
| `text-primary` | `#F4F7FC` | Headlines and primary content |
| `text-secondary` | `#A7B4C8` | Descriptions and metadata that still need to be read |
| `action` | `#3175C6` | Primary button fill with white text |
| `action-hover` | `#2B67AF` | Darker hover fill retains white-text contrast |
| `focus` | `#75B7FF` | Focus ring and selected-control outline |
| `violet` | `#8B5CF6` | Orbital lighting, competition category and occasional chart accents |
| `live/reward` | `#2DD4BF` | Live badges, confirmed reward amounts and completion signals |
| `urgent/error` | `#FB7185` | Form errors, failed transactions and final countdown interval |
| `podium` | `#F4C97A` | First-place medal and small winner detail |

Violet is an accent, not a second full-page wash. Limit glowing edges to the primary action, live competition and 3D focal point. Rewards use mint; an unconfirmed reward uses neutral text plus a status label.

Blue button text is white. Mint/coral/violet filled controls use dark text. Do not place small blue text on graphite without a contrast check; use the lighter focus/link color instead. Essential body text targets WCAG AA 4.5:1. Controls, focus and meaningful state boundaries target 3:1. Status always includes text/icon, not color alone.

Use at most one atmospheric background gradient per screen: a blue radial bloom behind the arena with a small violet light source. No gradient text for prize amounts or running timers.

## Typography and spacing

Geist Sans for headings, body and controls. IBM Plex Mono for scores, WIF amounts, countdowns and compact wallet strings. Load through the application font pipeline; use `font-variant-numeric: tabular-nums` for numeric UI.

| Element | Desktop | Mobile | Weight / leading |
| --- | --- | --- | --- |
| Hero | 76px | 44px | 800 / 0.98, tracking -0.045em |
| Page title | 40px | 30px | 700 / 1.1 |
| Section heading | 26px | 22px | 650 / 1.2 |
| Card title | 20px | 18px | 650 / 1.25 |
| Body | 16px | 16px | 400 / 1.6 |
| Interface text | 14px | 14px | 500 / 1.4 |
| Eyebrow/metadata | 12px | 12px | 500 / 1.4, optional 0.08em tracking |
| Featured prize | 42px mono | 32px mono | 600 / 1.1 |

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px. Cards have 16px radii; controls 10px; badges pill-shaped. Use 24px card padding desktop, 20px mobile. Borders are 1px. Use depth sparingly: `0 16px 48px rgba(0,0,0,.24)` for raised panels.

Desktop layout: 12-column grid, 24px gap, max content width 1440px and 32px outer gutters. Landing content is max 1280px. App sidebar is 224px and topbar 72px. At 1024px collapse sidebar to 72px; below 768px use compact header and bottom navigation. At 390px use 16px gutters and one-column cards.

## Navigation and routes

| Route | Shell | Primary purpose |
| --- | --- | --- |
| `/` | Public top navigation | Understand and enter the league |
| `/discover` | App shell | Browse live/upcoming/completed competitions |
| `/competitions/:id` | App shell | Understand rules and join |
| `/competitions/:id/play` | Focus mode | Complete one timed run |
| `/competitions/:id/results` | App shell | Inspect finalized rankings and reward delivery |
| `/create` | App shell | Author, approve and fund a challenge |
| `/leaderboard` | App shell, P1 | Seasonal placement history |
| `/profile/:wallet` | App shell, P1 | Public confirmed competition history |

Public desktop header: mark/wordmark left, Discover and Rankings center, Create challenge text action and Connect wallet right. If Rankings is not implemented, omit that link until P1 ships.

App desktop sidebar: Discover, My competitions, Rankings when available, Create challenge; a small help/rules link and network information near the bottom. Topbar: page context, optional competition search, wallet control.

Mobile bottom navigation: Discover, Rankings when available, Create, You. Do not leave a dead route to satisfy the layout. Hide bottom navigation in focus mode. Show a reconnect control only when needed, and do not launch wallet prompts during active play.

## Screen 1 — cinematic landing

The first viewport explains free participation, skill scoring and WIF rewards. The 3D scene owns the right side; text and controls remain real HTML.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ FLAT LEAGUE         Discover   Rankings        Create   Connect wallet│
├──────────────────────────────────────────────────────────────────────┤
│  ● FREE-TO-ENTER COMPETITIONS                                         │
│                                                                      │
│  YOUR SKILLS.                  [ FLAT CORE: orbiting geometric sphere │
│  REAL REWARDS.                   above a layered arena platform ]    │
│                                                                      │
│  Free challenges. Creator-funded WIF.                                │
│  Your performance decides the result.                                │
│                                                                      │
│  [Explore competitions →]    Create a challenge                       │
│                                                                      │
│  Free entry         120-second runs         Rewards in WIF            │
├──────────────────────────────────────────────────────────────────────┤
│ FEATURED CHALLENGE       creator          ends in          250 WIF    │
│ The Knowledge Run       10 questions      02h 14m        [View round]  │
└──────────────────────────────────────────────────────────────────────┘
```

Featured amounts/times in this wireframe are illustrative. Production shows actual funded competitions; when none exist, show “The next round is being prepared” with an honest creator CTA.

Below the hero: one featured competition, up to six live cards, finalized recent winners, a four-step Create → Fund → Compete → Receive rewards explanation, and the next-round CTA. Add global podium only when there are finalized data and P1 ranking semantics.

Mobile order: header, eyebrow, headline, short explanation, primary CTA, static/low-cost arena at roughly 220px height, featured card. The main action must be visible before an expensive canvas finishes loading.

## Screen 2 — discovery lobby

Page header: “Find your next challenge”, one sentence explaining free entry, Create challenge action. Status tabs: Live, Upcoming, Completed; visible total count only from loaded data. Search is client-side for the initial small catalog; no complex search service.

Feature card spans eight columns and contains the main live round. A four-column “Your league” panel shows current participation, confirmed rewards and next action. Disconnected users see “Your competition history lives here” plus an optional connect action. Do not invent a rank for an empty profile.

Competition grid uses three columns on wide desktop, two on tablet and one on mobile. Each card has:

1. Small visual/category strip with a restrained orbital motif.
2. Status chip: Upcoming / Live / Awaiting results / Finalized.
3. Title and creator identity.
4. WIF pool in mono, participant count and time limit.
5. Deadline with local time and UTC detail in an accessible popover.
6. A single primary action based on state.

Actions: upcoming → View schedule; live/unjoined → View challenge; registered/unstarted → Start run; active attempt → Resume run; submitted → View standings; finalized → View results. A discover-card click opens details, never immediately starts the timer.

Skeletons reserve final card dimensions. Filters with no results show a local empty state with Clear filters. A failed request gets Retry and last-updated context; it never appears as “zero competitions”.

## Screen 3 — competition detail

Desktop: main information eight columns; sticky reward/join panel four columns. Mobile: title and status, prize summary, primary action, then rules and participants. Sticky mobile action bar must not obscure content or the bottom navigation.

```text
┌───────────────────────────────────┬─────────────────────────────────┐
│ ← Discover       LIVE             │ PRIZE POOL                      │
│ The Knowledge Run                 │ 250 WIF                         │
│ By creator identity               │ 1st 150 / 2nd 62.5 / 3rd 37.5  │
│                                   │ ● Funding confirmed             │
│ Ten questions. Two minutes.       │                                 │
│ Highest score wins.               │ Entry                  FREE     │
│                                   │ Players                18 / 100 │
│ Overview | Rules | Standings      │ Closes                 02h 14m  │
│                                   │                                 │
│ Scoring / tie breaks / one attempt │ [Join free →]                   │
│ Judging authority / payout timing │ Platform covers registration gas│
│ Funding and contract references  │ View funding transaction ↗      │
└───────────────────────────────────┴─────────────────────────────────┘
```

Displayed values are reference examples. Rules include start/end, 120-second timer, one attempt per wallet, question count, score/ties, fewer-player payouts, scoring authority, registration capacity, settlement deadline and claim recovery. Put short scoring authority copy near the rewards panel: “Scores are verified by Flat League's scoring service. Final results settle onchain.” The complete details are expandable.

Join sequence: connect → sign in → sponsored registration → ready. Do not imply Connect itself joins. Once registration confirms, show a preflight sheet: timer length, one attempt, answers lock on confirmation, reliable connection needed; `Start my run` explicitly starts the clock.

If less than 120 seconds remain, replace Start with “Entries have closed for this round” and offer the next round. If the creator cancelled, replace join with cancellation information and the refund receipt. Network/relayer delay never starts the quiz clock.

If the settlement deadline passes without finalization, show “Settlement expired” and the creator's refund state. Do not retain projected winner claims after the contract becomes eligible for expiry refund.

## Screen 4 — focused quiz room

Use a centered column max 760px with one question at a time. No sidebar, canvas, scrolling background, rankings or price ticker. A small brand mark, question progress and remaining time are sufficient.

```text
┌───────────────────────────────────────────────────────────────────┐
│ FLAT LEAGUE              QUESTION 04 / 10               01:12      │
│ ━━━━━━━━━━━━━━━━───────────────────────────────────────────────   │
│                                                                   │
│ Which statement correctly describes ... ?                         │
│                                                                   │
│ [ A ]  Answer option                                              │
│ [ B ]  Answer option                       ← selected             │
│ [ C ]  Answer option                                              │
│ [ D ]  Answer option                                              │
│                                                                   │
│ Your answer locks after confirmation.                             │
│                                              [Confirm & next →]   │
└───────────────────────────────────────────────────────────────────┘
```

Options use a proper radio group with keyboard navigation. Selected option: raised surface, blue focus-border and selection icon. No green/red correctness feedback before closing. Confirm is disabled until selection, then changes to “Saving answer…” while the API acknowledges. Lock only on acceptance; retain the same retry key on failure.

Timer stays mono and stable-width. Below 20 seconds change to coral and include a short text cue. Announce 30 seconds and 10 seconds remaining to assistive technology; do not announce every tick. No screen shake or accelerating pulse.

On timeout the server closes the attempt. Show “Time is up. Your accepted answers were submitted.” A last-second selection that never reached the server is not counted; the UI explains that plainly. On successful final answer, show submission confirmation and remaining competition time rather than an immediate winner claim.

Do not penalize tab switching automatically. Leaving/reloading cannot reset the clock. Resume restores server state; after expiry it routes to the submitted screen. If connection drops, show an inline connection strip, retain selected input and warn that the timer continues. If the session expires, preserve attempt identity and reconnect without creating another attempt.

Mobile options have at least 56px height and 16px text. Confirmation bar remains reachable above the safe area; content scrolls naturally on short screens. Space/Enter confirm only from the intended focused control, avoiding accidental answer submission.

## Screen 5 — standings and results

Two distinct presentations share the route:

- Before finalization: “Provisional standings”; rank may change; answers/results may remain hidden until closing; no claim action.
- After finalization: “Final results”; fixed podium, score/time table, pool allocation and transaction records.

Desktop podium: second place left, first center taller, third right. Put wallet identicons and names above compact score/time rows. On mobile use three compact cards or a vertically ordered top-three list; do not squeeze tiny podium labels.

Table: Rank, Player, Score, Time, Reward, Delivery. Highlight the viewer's row. Delivery is Pending / Confirmed / Retry available, backed by allocation and receipts. `View reward transaction` appears only for a real confirmed hash. Provisional prize estimates say “Projected”, never “earned”.

Winner panel: “You placed #2” → “62.5 WIF allocated” → “Reward sent” after receipt. Automatic delivery is sponsored. If it fails, show Request delivery and an advanced self-claim option that clearly states the winner pays gas. The self-claim option never redirects the fixed recipient.

Nonwinner panel: correct score, placement, supportive copy and next scheduled challenge. The primary post-round action is `Play the next round`; secondary actions share results or inspect the public scoring artifact. No automatic transaction request to re-enter.

## Screen 6 — creator studio

A four-step wizard with a sticky preview/reward summary. Save offchain drafts between steps. Funding freezes the published rules.

| Step | Inputs | UX requirement |
| --- | --- | --- |
| 1. Challenge | Title, description, Knowledge Run mode | Show free entry and fixed 120-second rules; validate text lengths inline |
| 2. Questions | Ten question cards, four options, one correct answer | Clearly private until closing; no answer-key fields in the public preview |
| 3. Schedule & rewards | Start, end, participant cap, WIF pool | Show local and UTC time; 60/25/15 default; explain settlement cutoff and cancellation |
| 4. Review & fund | Frozen preview and exact transaction amounts | Present approval/funding/gas steps before opening wallet |

Use a human-readable date/time picker with local timezone label and an exact UTC preview. Reject impossible windows, insufficient preparation time, invalid participant caps and zero pools. Reward allocation is preset for the MVP rather than an unrestricted payout editor.

WIF input uses decimal-safe parsing and the verified 18 decimals. Show wallet WIF and ETH separately, only inside the funding context. Approval amount equals this pool; “Max” must leave gas considerations to ETH, not subtract imaginary WIF fees.

Transaction stepper: Review → Approve WIF (if needed) → Fund challenge → Published. After approval succeeds, a rejected funding transaction preserves the draft and allowance state. A refresh recovers known tx hashes and receipt state. Confirmed funding with delayed indexing shows “Funded. Publishing details…” and a link to the real receipt.

Primary labels describe the next action: `Review challenge`, `Approve 250 WIF`, `Fund with 250 WIF`. Do not combine two wallet confirmations into a misleading single “Create” button. After publication, show copy link, view challenge and create another round.

## Screen 7 — profile and season (P1)

Profile header uses an identicon, optional name and shortened wallet with copy/full-address access. Stats: completed rounds, wins and confirmed WIF received. History rows link to final results and receipts. An empty profile invites the first competition without fake achievements.

Season page lists placement points under the explicit 10/6/4 + one-completion-point rules. Show the counting period and finalized-only label. Global placement is separate from a specific competition's prize ranking. Do not compare raw quiz scores across different question packs as if they establish identical difficulty.

## Wallet and transaction behavior

Custom wallet drawer built on accessible Dialog/Sheet primitives. Desktop width approximately 420px, mobile bottom sheet. Options: installed wallet, WalletConnect, connection state. On connection show a compact address, WIF balance if available, network and disconnect. Balance failures say “Balance unavailable” rather than zero.

Creator wrong-chain action: `Switch to Robinhood Chain`; rejected switch leaves form intact. Offchain player participation does not repeatedly demand a network switch. Account changes invalidate login and player-specific queries; an active attempt stays owned by its original wallet.

Persist transaction context outside disposable toasts. A transaction panel shows wallet confirmation, submitted hash, pending receipt, confirmed effect and failed/reverted state. Wallet rejection is “Cancelled in wallet”; RPC uncertainty is “Checking whether your transaction was sent” followed by hash/state lookup. Toasts support the panel, never replace it.

## Flat Core — Three.js art direction

One recognizable environment: a faceted sphere hovering above a layered circular arena, enclosed by three orbital rings. A dark equatorial disc and thin horizon line connect the visual to the Flat League identity.

| Element | Specification |
| --- | --- |
| Core | Radius ~1.15 world units; moderately detailed icosahedron; graphite metal with cyan edge emission |
| Rings | Three torus meshes, radius ~1.7–2.1, thin thickness ~0.015–0.03; differently tilted; cobalt, violet, mint edge light |
| Platform | Three low-poly concentric discs below the core; dark material, blue perimeter lighting |
| Particles | One instanced field, ~160 desktop / ~48 mobile; deterministic orbital positions |
| Camera | Perspective 35° FOV near `[0, 1.2, 6.5]`; slow landing-scroll reframe only |
| Lighting | Soft cobalt key, violet rim and neutral fill; restrained bloom on desktop |
| Background | Transparent canvas over the HTML blue radial atmosphere |
| Interaction | Pointer shifts the parent group by at most ~0.08 radians; no drag-to-orbit requirement |

Use a subtle Fresnel/emissive shader to illuminate facets; opaque core center preserves silhouette. Do not make a transparent noisy orb that loses shape against the background. Seed particle positions; derive motion from render delta and avoid allocating vectors every frame.

Core rotation is approximately one revolution per 50–70 seconds. Rings move at different slow speeds; platform stays visually anchored. A live featured challenge adds a restrained ring-brightness pulse every four seconds. Completion may trigger a single light sweep if this scene is visible; no persistent flashing.

Components:

```text
ArenaScene.tsx          # Canvas, camera and quality gates
FlatCore.tsx            # Faceted sphere and shader
OrbitalRings.tsx        # Three orbital paths
ParticleField.tsx       # Instanced seeded points
ArenaPlatform.tsx      # Concentric podium
ArenaPoster.tsx        # Static fallback with identical framing
```

Landing-only dynamic import with an immediate poster. Critical headline/CTA render independently of the scene. Desktop target ≤30 draw calls and ≤40k triangles, DPR capped at 1.5. Mobile DPR ≤1, no bloom or dynamic shadows, smaller particle field. Quality drops when sustained frame rate is below 30 FPS. Measure rather than assuming these budgets guarantee performance.

Use IntersectionObserver and page visibility to stop continuous rendering offscreen/in a hidden tab. Static reduced-motion mode has no orbital loop or particles. WebGL unsupported/context loss switches to the poster. Do not render several live canvases inside competition cards.

## Motion system

| Interaction | Tool | Timing and behavior |
| --- | --- | --- |
| Hero entrance | Framer Motion | Eyebrow 220ms opacity/y 8; title lines 500ms y 20 with 80ms stagger; CTA 300ms; no delayed interactivity |
| Orbital scene | R3F | Slow continuous rotations while visible; bounded pointer response |
| Landing scroll | GSAP ScrollTrigger | Move camera/group slightly over first ~700px of scroll; no scroll locking or lengthy pinning |
| Discovery cards | Framer Motion | Initial 250ms opacity/y 12, 40ms stagger capped at six; hover y -4 over 160ms |
| Buttons | CSS/Framer Motion | Hover 140ms, press scale .985 over 90ms; preserve focus ring |
| Drawer/modal | Framer Motion | 220–280ms slide + scrim; focus trapped/restored |
| Quiz question | Framer Motion | 140ms opacity/y 8 after server acknowledgement; timer stays fixed |
| Rank reorder | Framer Motion layout | ~320ms shared-layout transition, stable wallet keys |
| Result reveal | Framer Motion | Top three stagger 100ms with gentle spring; one bounded medal shimmer |
| Transaction states | Framer Motion/CSS | Crossfade 160ms; pending progress indicator; confirmed check 240ms |

Ease for standard entry: cubic-bezier(.22,1,.36,1). Gentle layout spring starting values: stiffness 260, damping 28; tune against real content. No bounce for balances, deadlines or status messages.

GSAP owns landing camera/group scroll values, R3F owns internal orbit rotation, Framer Motion owns DOM transforms. Never animate the same transform through two systems. Clean up timelines/listeners on unmount; scope animations to mounted components.

Amounts animate only between confirmed values, using exact formatted display data. Under reduced motion, values update immediately. The live timer changes digits without counting tween effects. Avoid entrance choreography that prevents a player from acting quickly.

Reduced-motion mode removes parallax, continuous orbits, particles and reordering movement. State changes remain readable via immediate layout and short optional opacity fades. Animation is enhancement, not a condition for understanding status.

## Component inventory

| Component | Required variants |
| --- | --- |
| `CompetitionCard` | Upcoming, live, registered, active attempt, submitted, finalized, cancelled |
| `StatusBadge` | Label + icon; live, pending, confirmed, failed, cancelled |
| `PrizeAmount` | Funded pool, projected reward, allocated reward, confirmed payment |
| `Countdown` | Normal, closing soon, closed; server-offset-aware |
| `WalletControl` | Disconnected, connecting, connected, account changed, balance unavailable |
| `TransactionPanel` | Awaiting wallet, sent, pending, confirmed, reverted, uncertain send |
| `AnswerOption` | Idle, keyboard focus, selected, disabled/locked; no early correctness |
| `AttemptStatus` | Ready, registration pending, in progress, offline, expired, submitted |
| `LeaderboardRow` | Provisional, finalized, current player, podium, payment pending/confirmed |
| `CreatorWizard` | Draft, invalid step, frozen review, allowance confirmed, funding pending, published |

Use accessible shadcn/Radix foundations for Dialog, Sheet, Tabs, Accordion, RadioGroup, Tooltip, Select and Toast; style them to this identity. Core competition panels are custom layouts, not a default admin template. Use one restrained icon family and generated wallet identicons.

## Acceptance criteria

- First viewport communicates free skill competition and WIF-funded rewards within five seconds.
- The main action works while the 3D scene is loading or unavailable.
- Every payout/status label follows the actual contract/receipt state.
- A user sees scoring, ties and settlement timing before starting a one-time run.
- No wallet transaction prompt interrupts a quiz.
- Creator approval and funding are separate, recoverable steps.
- 390px mobile has no horizontal page overflow; safe areas and short-height screens work.
- Keyboard navigation, screen-reader labels and focus restoration work on wallet/preflight flows.
- Essential text and controls meet contrast targets; color is never the only state cue.
- Reduced-motion and WebGL-fallback paths preserve all functions.
- The 3D scene stops work offscreen; quiz never loads Three.js/GSAP.
- Visual polish is reviewed at 1440px desktop, 768px tablet and 390px mobile, including empty/error/provisional states.
