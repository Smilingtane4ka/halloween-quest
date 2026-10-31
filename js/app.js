import { KIDS, STAGES, INTRO, FINALE } from './quest-data.js';
import { newState, applyToken, checkAnswer, hintAvailable, encode, HINT_DELAY_MS } from './logic.js';

const STORAGE_KEY = 'hq-state-v1';
const $ = (sel) => document.querySelector(sel);
const app = $('#app');

const MESSAGES = {
  otherKid: 'Цей лист — для іншого мисливця 👻',
  tooEarly: 'Ще зарано! Спершу розгадай цю загадку',
  already: 'Цю руну вже зібрано ✨',
  needStart: 'Спершу відскануй свою Старт-картку',
  wrong: 'Ні, це не чарівне слово… Спробуй ще!',
  unknown: 'Дивний знак… Бублик його не знає',
  finished: 'Квест уже пройдено! 🎉',
  empty: 'Напиши чарівне слово',
};

// ---------- стан ----------
let memoryState = null;
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...newState(), ...JSON.parse(raw) };
  } catch { /* приватний режим — працюємо в пам'яті */ }
  return memoryState ?? newState();
}
function save(s) {
  memoryState = s;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* див. load */ }
}
let state = load();
function setState(s) { state = s; save(s); render(); }

// ---------- дрібниці ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const runeImg = (n) => `assets/runes/rune-${n}.jpg`;

let toastTimer;
function toast(text, bad = false) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('show');
  if (bad) el.classList.add('shake');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Цей телефон не вміє читати вголос 😔');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'uk-UA';
  u.rate = 0.92;
  const voice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('uk'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch { /* без звуку — не біда */ }
  navigator.vibrate?.([80, 40, 140]);
}

// ---------- результати дій ----------
function handle(result) {
  const prev = state;
  state = result.state;
  save(state);
  const { outcome } = result;
  if (outcome === 'rune') {
    render();
    showRune(prev.runes + 1);
  } else if (outcome === 'started') {
    render();
  } else if (outcome === 'jump') {
    render();
    toast(`Дорослий переніс на етап ${state.runes + 1}`);
  } else if (outcome === 'resumed') {
    render();
    toast('З поверненням, мисливцю! 👻');
  } else {
    render();
    toast(MESSAGES[outcome] ?? MESSAGES.unknown, outcome !== 'already' && outcome !== 'finished');
  }
  return outcome;
}

function showRune(n) {
  const st = STAGES[n - 1];
  const ov = $('#overlay');
  const last = n === STAGES.length;
  ov.innerHTML = `
    <img src="${runeImg(n)}" alt="">
    <h2>✨ Руна ${esc(st.rune)} — твоя!</h2>
    <p class="small">Зібрано ${n} з ${STAGES.length}</p>
    <button class="btn" id="ov-next" type="button">${last ? 'Зняти закляття! 🎁' : 'Далі ➜'}</button>`;
  ov.hidden = false;
  chime();
  $('#ov-next').addEventListener('click', () => { ov.hidden = true; render(); window.scrollTo(0, 0); });
}

// ---------- екрани ----------
function shelf() {
  return `<div class="shelf" aria-label="Зібрані руни">${STAGES.map((st) => {
    if (st.n <= state.runes) return `<div class="slot lit"><img src="${runeImg(st.n)}" alt="Руна ${esc(st.rune)}"></div>`;
    return `<div class="slot${st.n === state.runes + 1 ? ' next' : ''}">${st.n}</div>`;
  }).join('')}</div>`;
}

function chooseScreen() {
  return `<section class="screen">
    <img class="bublik big" src="assets/bublik.png" alt="Привид Бублик">
    <p class="lead">Привіт, мисливцю на привидів! 👻<br>Наведи камеру телефону на свою <b>Старт-картку</b> 📷</p>
    <p class="small">Або обери себе:</p>
    <div class="choose">
      ${Object.values(KIDS).map((k) => `<button class="btn" type="button" data-kid="${k.id}" style="background:${k.color}">${k.emoji} ${esc(k.label)}</button>`).join('')}
    </div>
  </section>`;
}

function introScreen() {
  return `<section class="screen">
    <img class="bublik big" src="assets/bublik.png" alt="Привид Бублик">
    <div class="parchment"><p>${esc(INTRO(state.kid))}</p><p class="from">— твій друг Бублик</p></div>
    ${state.kid === 'y' ? `<button class="btn ghost" type="button" data-speak="intro">🔊 Прочитай мені</button>` : ''}
    <button class="btn wide" type="button" id="begin">Почати пошуки! 🔦</button>
  </section>`;
}

function clueHtml(p) {
  if (p.clueType === 'mirror') return `<p class="clue mirror">${esc(p.clue)}</p>`;
  if (p.clueType === 'cipher') {
    return `<div class="cipher">${encode(p.clue).map((w) => `<div class="word">${w.map((e) => `<span>${e}</span>`).join('')}</div>`).join('')}</div>
      <p class="cipher-note">Розшифруй Абеткою Моргани 📜</p>`;
  }
  return `<p class="clue">${esc(p.clue)}</p>`;
}

function stageScreen() {
  const st = STAGES[state.runes];
  const p = st.perKid[state.kid];
  const now = Date.now();
  const hintReady = hintAvailable(state, now);
  return `<section class="screen">
    <div class="stage-head">
      <img src="${runeImg(st.n)}" alt="">
      <div><div class="count">Руна ${st.n} з ${STAGES.length}</div><h2>Руна ${esc(st.rune)}</h2></div>
    </div>
    <div class="parchment">${clueHtml(p)}</div>
    <div class="tools">
      ${state.kid === 'y' && p.clueType === 'text' ? `<button class="btn ghost" type="button" data-speak="clue">🔊 Прочитай мені</button>` : ''}
      <button class="btn ghost" type="button" id="hint-btn" ${hintReady ? '' : 'disabled'}>${hintReady ? '💡 Підказка' : hintLabel(now)}</button>
    </div>
    <div id="hint-box"></div>
    <form class="answer" id="answer" autocomplete="off">
      <input name="word" placeholder="${p.token ? 'Чарівне слово з листа' : 'Твоя відповідь'}" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go">
      <button class="btn wide" type="submit">✨ Перевірити</button>
    </form>
    ${p.token ? '<p class="scan-note">або наведи камеру телефону на QR-квадратик на листі 📷</p>' : ''}
    ${shelf()}
  </section>`;
}

function hintLabel(now) {
  const left = Math.max(0, Math.ceil((HINT_DELAY_MS - (now - (state.stageStartedAt ?? now))) / 1000));
  return `💡 Підказка через ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function finaleScreen() {
  const k = KIDS[state.kid];
  const mins = state.startedAt && state.finishedAt ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 60000)) : null;
  const date = new Date(state.finishedAt ?? Date.now()).toLocaleDateString('uk-UA');
  return `<section class="screen">
    <img class="bublik big" src="assets/bublik.png" alt="Привид Бублик">
    <div class="parchment"><p>${esc(FINALE)}</p><p class="from">— Бублик</p></div>
    ${state.kid === 'y' ? `<button class="btn ghost" type="button" data-speak="finale">🔊 Прочитай мені</button>` : ''}
    <div class="parchment certificate">
      <h3>Сертифікат мисливця на привидів</h3>
      <p class="name">${k.emoji} ${esc(k.label)}</p>
      <p>отримує звання Мисливця на привидів: усі 10 магічних рун зібрано${mins ? ` за ${mins} хв` : ''}, закляття відьми Моргани знято.</p>
      <p class="from">${date} · Бублик 👻</p>
    </div>
    ${shelf()}
  </section>`;
}

let hintTicker;
function render() {
  clearInterval(hintTicker);
  const kid = state.kid ? KIDS[state.kid] : null;
  document.documentElement.style.setProperty('--kid', kid ? kid.color : '#ff8a1f');
  const badge = $('#kid-badge');
  badge.hidden = !kid;
  if (kid) badge.textContent = `${kid.emoji} ${kid.label}`;

  if (!state.kid) app.innerHTML = chooseScreen();
  else if (!state.introSeen) app.innerHTML = introScreen();
  else if (state.runes >= STAGES.length) app.innerHTML = finaleScreen();
  else {
    app.innerHTML = stageScreen();
    if (!hintAvailable(state, Date.now())) {
      hintTicker = setInterval(() => {
        const btn = $('#hint-btn');
        if (!btn) return clearInterval(hintTicker);
        const now = Date.now();
        if (hintAvailable(state, now)) { btn.disabled = false; btn.textContent = '💡 Підказка'; clearInterval(hintTicker); }
        else btn.textContent = hintLabel(now);
      }, 1000);
    }
  }
}

// ---------- події ----------
app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.kid) {
    if (confirm(`Ти — ${KIDS[t.dataset.kid].emoji} ${KIDS[t.dataset.kid].label}?`)) {
      setState({ ...newState(), kid: t.dataset.kid, startedAt: Date.now(), stageStartedAt: Date.now() });
    }
  } else if (t.id === 'begin') {
    setState({ ...state, introSeen: true, stageStartedAt: Date.now() });
  } else if (t.id === 'hint-btn') {
    const p = STAGES[state.runes].perKid[state.kid];
    $('#hint-box').innerHTML = `<div class="hint">💡 ${esc(p.hint)}</div>`;
    if (state.kid === 'y') speak(p.hint);
  } else if (t.dataset.speak) {
    const text = t.dataset.speak === 'intro' ? INTRO(state.kid)
      : t.dataset.speak === 'finale' ? FINALE
      : STAGES[state.runes].perKid[state.kid].clue;
    speak(text);
  }
});

app.addEventListener('submit', (e) => {
  if (e.target.id !== 'answer') return;
  e.preventDefault();
  const input = e.target.elements.word;
  const outcome = handle(checkAnswer(state, input.value, Date.now()));
  if (outcome === 'wrong' || outcome === 'otherKid' || outcome === 'tooEarly') {
    const again = $('#answer input');
    if (again) { again.value = input.value; again.select(); }
  }
});

function consumeHash() {
  const m = location.hash.match(/k=([\w-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  state = load();
  handle(applyToken(state, m[1], Date.now()));
}
window.addEventListener('hashchange', consumeHash);

// QR відкривається в новій вкладці — старі вкладки підхоплюють прогрес
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { state = load(); render(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { state = load(); render(); } });

// ---------- меню дорослого: довге натискання на заголовок ----------
const adult = $('#adult');
let pressTimer;
const title = $('#title');
const startPress = () => { pressTimer = setTimeout(openAdult, 1500); };
const endPress = () => clearTimeout(pressTimer);
title.addEventListener('pointerdown', startPress);
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => title.addEventListener(ev, endPress));
title.addEventListener('contextmenu', (e) => e.preventDefault());

function openAdult() {
  const k = state.kid ? `${KIDS[state.kid].emoji} ${KIDS[state.kid].label}` : 'дитину ще не обрано';
  $('#adult-status').textContent = `${k}. Зібрано рун: ${state.runes} з ${STAGES.length}.`;
  adult.showModal();
}
$('#adult-close').addEventListener('click', () => adult.close());
$('#adult-reset').addEventListener('click', () => {
  if (confirm('Стерти весь прогрес на цьому телефоні?')) { adult.close(); setState(newState()); }
});

render();
consumeHash();
