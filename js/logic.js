// Правила квесту: чисті функції без DOM, щоб їх можна було тестувати в Node.
import { KIDS, STAGES, ABETKA, START_TOKENS } from './quest-data.js';

export const HINT_DELAY_MS = 120_000;
const TOTAL = STAGES.length;

const LATIN_TWINS = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };

export function normalize(s) {
  return String(s ?? '')
    .toLocaleUpperCase('uk-UA')
    .replace(/[A-Z]/g, (ch) => LATIN_TWINS[ch] ?? ch)
    .replace(/[^Ѐ-ӿ0-9]/g, '');
}

export function encode(text) {
  return text.split(/\s+/).filter(Boolean).map((w) => [...w].map((ch) => ABETKA[ch] ?? ch));
}

// token -> { kid, n }, n = 0 для Старт-картки
const TOKENS = new Map();
for (const kid of Object.keys(KIDS)) {
  TOKENS.set(START_TOKENS[kid], { kid, n: 0 });
  for (const st of STAGES) if (st.perKid[kid].token) TOKENS.set(st.perKid[kid].token, { kid, n: st.n });
}

export function tokenInfo(token) {
  return TOKENS.get(token) ?? null;
}

export function newState() {
  return { kid: null, runes: 0, introSeen: false, stageStartedAt: null, startedAt: null, finishedAt: null };
}

function advance(state, n, now) {
  if (state.runes >= TOTAL) return { state, outcome: 'finished' };
  const current = state.runes + 1;
  if (n < current) return { state, outcome: 'already' };
  if (n > current) return { state, outcome: 'tooEarly' };
  const runes = state.runes + 1;
  return {
    state: { ...state, runes, stageStartedAt: now, finishedAt: runes === TOTAL ? now : null },
    outcome: 'rune',
  };
}

export function applyToken(state, token, now) {
  const info = tokenInfo(token);
  if (!info) return { state, outcome: 'unknown' };
  if (info.n === 0) {
    if (!state.kid) return { state: { ...state, kid: info.kid, startedAt: now, stageStartedAt: now }, outcome: 'started' };
    return { state, outcome: state.kid === info.kid ? 'resumed' : 'otherKid' };
  }
  if (!state.kid) return { state, outcome: 'needStart' };
  if (info.kid !== state.kid) return { state, outcome: 'otherKid' };
  return advance(state, info.n, now);
}

function stageForWord(kid, word) {
  const st = STAGES.find((s) => s.perKid[kid].answers.some((a) => normalize(a) === word));
  return st ? st.n : null;
}

export function checkAnswer(state, input, now) {
  const word = normalize(input);
  if (!word) return { state, outcome: 'empty' };
  if (!state.kid) return { state, outcome: 'needStart' };

  const jump = word.match(/^БУБЛИК(\d{1,2})$/);
  if (jump) {
    const n = Number(jump[1]);
    if (n >= 1 && n <= TOTAL) {
      return { state: { ...state, runes: n - 1, introSeen: true, stageStartedAt: now, finishedAt: null }, outcome: 'jump' };
    }
  }

  const own = stageForWord(state.kid, word);
  if (own) return advance(state, own, now);
  const other = Object.keys(KIDS).find((k) => k !== state.kid && stageForWord(k, word));
  return { state, outcome: other ? 'otherKid' : 'wrong' };
}

export function hintAvailable(state, now) {
  return state.stageStartedAt != null && now - state.stageStartedAt >= HINT_DELAY_MS;
}
