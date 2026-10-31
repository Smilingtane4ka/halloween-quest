# Halloween Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Static phone web app where two kids each walk their own 10-stage Halloween route, unlocking runes by scanning printed QR cards or typing magic words, plus a printable kit page for the parent.

**Architecture:** Plain HTML/CSS/ES modules, no build. All quest content lives in one data module; all rules (token/answer checking) live in a pure logic module tested with `node --test`; the UI module only renders state and persists it in `localStorage`. A separate `parent.html` renders print sheets with QR codes generated client-side.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Node 18+ `node:test`, `qrcode-generator@1.4.4` from cdnjs (parent page only), Google Fonts (Philosopher, Nunito), Pillow in a scratch venv for one-off image prep, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-31-halloween-quest-design.md`

## Global Constraints

- All UI copy in Ukrainian; second-person copy avoids past-tense gendered verbs.
- Kid ids: `y` (🎃 younger, orange `#ff8a1f`), `o` (🔮 older, purple `#a66bff`). Labels are placeholders editable in `js/quest-data.js`.
- Abetka: user's table, except К = 🗡️.
- Stages 5 and 7 have no card/token; every other stage (and stage 0 = start) has one token per kid.
- Answer normalization: uppercase (uk), strip spaces/apostrophes/punctuation, Latin look-alikes → Cyrillic.
- Parent override: `БУБЛИК<n>` (n = 1..10) jumps the current kid to stage n.
- Hint unlocks 120 s after the stage started.
- No real names, no server, no in-app camera scanner.

## Review Focus

1. QR opened in a new tab while an old tab is open → old tab must pick up progress (`storage` event re-render). Covered in Task 3 manual check.
2. Kid scans sibling's card, or a future card → friendly refusal, no progress change. Test in Task 1.
3. Card scanned before the Start card on a fresh browser → "скануй Старт-картку" message, no crash. Test in Task 1.
4. Typed answer with Latin letters / extra spaces / lower case (`ванна кімната`, `ДРУЗI` with Latin I) → accepted. Test in Task 1.
5. `localStorage` unavailable (private mode) → game still works in memory. Task 3 wraps all storage in try/catch.

---

### Task 1: Quest data + logic

**Files:**
- Create: `package.json` (`{"type":"module","scripts":{"test":"node --test tests/"}}`)
- Create: `js/quest-data.js`, `js/logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Produces (`quest-data.js`): `KIDS: {y,o}` each `{id,label,emoji,color,colorName}`; `ABETKA: Record<letter, emoji>`; `STAGES: Array<10>` of `{n, rune, place, perKid: {y,o}}`, `perKid[k] = {clue: string, clueType: 'text'|'cipher'|'mirror', hint, answers: string[], token: string|null, cardNote?: string}`; `START_TOKENS: {y,o}`; `INTRO`, `FINALE` copy.
- Produces (`logic.js`): `normalize(s): string`; `encode(text): string[][]` (words → emoji lists); `newState(): State` where `State = {kid: 'y'|'o'|null, runes: 0..10, introSeen: bool, stageStartedAt: number|null, startedAt: number|null, finishedAt: number|null}`; `applyToken(state, token, now) → {state, outcome}` with outcome ∈ `started|rune|already|tooEarly|otherKid|needStart|unknown|finished`; `checkAnswer(state, input, now) → {state, outcome}` with outcome ∈ `rune|jump|already|tooEarly|otherKid|wrong|empty`; `hintAvailable(state, now): boolean`.

- [ ] **Step 1: Write failing tests** — `normalize(' ванна кімната ') === 'ВАННАКІМНАТА'`; `normalize('ДРУЗI')` (Latin I) `=== 'ДРУЗІ'`; start token on new state → `started`, kid set; younger stage-1 token at runes 0 → `rune`, runes 1; same token again → `already`; younger stage-3 token at runes 0 → `tooEarly`; older token on younger phone → `otherKid`; stage token on new state → `needStart`; `checkAnswer` with stage-5 `'ванну'` at runes 4 → `rune`; `'БУБЛИК 7'` → `jump`, runes 6; wrong → `wrong`; 10th rune sets `finishedAt`; data integrity: all tokens unique, all answers unique per kid, stages 5 & 7 token `null`, every letter in every cipher clue exists in `ABETKA`, ABETKA emoji unique.
- [ ] **Step 2:** `npm test` → FAIL (modules missing).
- [ ] **Step 3:** Implement both modules with the spec's table copy verbatim.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5:** Commit `feat: quest data and rules`.

### Task 2: Images

**Files:** Create `assets/bublik.png` (transparent background), `assets/map.webp` (copy), `assets/runes/rune-1.jpg … rune-10.jpg` (crops of the 5×2 grid incl. plaques).

- [ ] **Step 1:** Scratch venv with Pillow; flood-fill near-white from the borders of `1.webp` to alpha, resize to 600 px wide → `bublik.png`.
- [ ] **Step 2:** Crop 10 runes from `3.webp` (1536×1024; columns at x≈45,335,630,930,1225 width 290; rows y≈55 and 505, height 420), save JPEG q85.
- [ ] **Step 3:** Visually check every crop in the image viewer; adjust offsets if a plaque is clipped.
- [ ] **Step 4:** Commit `feat: quest artwork`.

### Task 3: Kid app

**Files:** Create `index.html`, `css/app.css`, `js/app.js`.

**Interfaces:** Consumes Task 1 exports. Storage key `hq-state-v1`.

- [ ] **Step 1:** Screens: choose-kid (scan-start prompt + two fallback buttons), intro letter, stage (rune counter, clue card by `clueType`, 🔊 for `y`, answer form, hint button after 120 s, 10-slot rune shelf), rune-won overlay (glow animation, chime, vibrate), finale with certificate, adult menu on 1.5 s long-press of title (restart with confirm). Toast for refusal outcomes with these texts: `otherKid` «Цей лист — для іншого мисливця 👻», `tooEarly` «Ще зарано! Спершу розгадай цю загадку», `already` «Цю руну вже зібрано ✨», `needStart` «Спершу відскануй свою Старт-картку», `wrong` «Ні, це не чарівне слово… Спробуй ще!», `unknown` «Дивний знак… Бублик його не знає».
- [ ] **Step 2:** Hash `#k=TOKEN` handled on load and `hashchange`, then cleared with `history.replaceState`; `storage` and `visibilitychange` re-read state.
- [ ] **Step 3:** In the browser pane at 375×812: play younger route start→finale via hashes and typed words; check mirror and cipher render; two-tab sync.
- [ ] **Step 4:** Commit `feat: kid quest app`.

### Task 4: Parent print kit

**Files:** Create `parent.html`, `css/print.css`, `js/parent.js`.

- [ ] **Step 1:** Screen-only header showing base URL used in QRs (`new URL('./', location.href)`), warning if not `https:`; "Друкувати" button.
- [ ] **Step 2:** Sections, each starting a new A4 page: hiding checklist (from `STAGES[*].place` + card words), start cards, 16 stage cards (6 per page, colored border, rune image, QR ≈35 mm, magic word, `cardNote`), two maps with colored frame + 🎃/🔮 badges per piece, paper ghosts (5 orange letters Д-Р-У-З-І numbered; 6 purple emoji for ДРУЖБА, unnumbered, shuffled), Abetka sheet.
- [ ] **Step 3:** Check print preview layout (A4, colors kept via `print-color-adjust: exact`); scan one QR from the screen to confirm URL.
- [ ] **Step 4:** Commit `feat: printable kit`.

### Task 5: Publish

- [ ] **Step 1:** `gh repo create halloween-quest --public --source . --push`; enable Pages on `main` / root via `gh api`.
- [ ] **Step 2:** Wait for deploy; open the Pages URL in the browser pane; run one stage via a real token URL.
- [ ] **Step 3:** Hand the user the kid URL and the parent URL.
