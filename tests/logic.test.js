import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIDS, STAGES, ABETKA, START_TOKENS } from '../js/quest-data.js';
import { normalize, encode, newState, applyToken, checkAnswer, hintAvailable } from '../js/logic.js';

const T = 1_000_000;
const tok = (kid, n) => STAGES[n - 1].perKid[kid].token;
const started = (kid) => applyToken(newState(), START_TOKENS[kid], T).state;
const atRunes = (kid, runes) => ({ ...started(kid), introSeen: true, runes, stageStartedAt: T });

test('normalize: case, spaces, apostrophes, latin look-alikes', () => {
  assert.equal(normalize(' ванна кімната '), 'ВАННАКІМНАТА');
  assert.equal(normalize('ДРУЗI'), 'ДРУЗІ'); // Latin I
  assert.equal(normalize('Гарбуз!'), 'ГАРБУЗ');
  assert.equal(normalize("м'ята"), 'МЯТА');
  assert.equal(normalize('ckop'), 'СКОР');
});

test('encode: words to emoji, К is a dagger', () => {
  assert.deepEqual(encode('ТАМ ДЕ'), [['🗝️', '👻', '🌙'], ['🦇', '🧪']]);
  assert.equal(encode('К')[0][0], '🗡️');
});

test('start token picks the kid', () => {
  const r = applyToken(newState(), START_TOKENS.y, T);
  assert.equal(r.outcome, 'started');
  assert.equal(r.state.kid, 'y');
  assert.equal(r.state.startedAt, T);
});

test('start token of the sibling is refused', () => {
  const r = applyToken(started('y'), START_TOKENS.o, T);
  assert.equal(r.outcome, 'otherKid');
  assert.equal(r.state.kid, 'y');
});

test('own start card again resumes without changes', () => {
  const s = atRunes('y', 3);
  const r = applyToken(s, START_TOKENS.y, T);
  assert.equal(r.outcome, 'resumed');
  assert.deepEqual(r.state, s);
});

test('stage card before the start card asks for start', () => {
  const r = applyToken(newState(), tok('y', 1), T);
  assert.equal(r.outcome, 'needStart');
  assert.equal(r.state.kid, null);
});

test('current card gives a rune, again is already, future is too early', () => {
  let r = applyToken(atRunes('y', 0), tok('y', 1), T + 5);
  assert.equal(r.outcome, 'rune');
  assert.equal(r.state.runes, 1);
  assert.equal(r.state.stageStartedAt, T + 5);
  assert.equal(applyToken(r.state, tok('y', 1), T).outcome, 'already');
  const early = applyToken(atRunes('y', 0), tok('y', 3), T);
  assert.equal(early.outcome, 'tooEarly');
  assert.equal(early.state.runes, 0);
});

test("sibling's card is refused", () => {
  const r = applyToken(atRunes('y', 0), tok('o', 1), T);
  assert.equal(r.outcome, 'otherKid');
  assert.equal(r.state.runes, 0);
});

test('unknown token', () => {
  assert.equal(applyToken(atRunes('y', 0), 'zzz', T).outcome, 'unknown');
});

test('typed answers: map room, ghosts word, card word', () => {
  assert.equal(checkAnswer(atRunes('y', 4), 'ванну', T).outcome, 'rune');
  assert.equal(checkAnswer(atRunes('o', 4), 'Ванна кімната', T).outcome, 'rune');
  assert.equal(checkAnswer(atRunes('y', 6), 'друзi', T).outcome, 'rune');
  assert.equal(checkAnswer(atRunes('o', 6), 'дружба', T).outcome, 'rune');
  assert.equal(checkAnswer(atRunes('y', 0), 'гарбуз', T).outcome, 'rune');
});

test('typed answers: wrong, empty, other kid, too early, already', () => {
  assert.equal(checkAnswer(atRunes('y', 0), 'кіт', T).outcome, 'wrong');
  assert.equal(checkAnswer(atRunes('y', 0), '  ', T).outcome, 'empty');
  assert.equal(checkAnswer(atRunes('y', 0), 'місяць', T).outcome, 'otherKid');
  assert.equal(checkAnswer(atRunes('y', 0), 'кажан', T).outcome, 'tooEarly');
  assert.equal(checkAnswer(atRunes('y', 1), 'гарбуз', T).outcome, 'already');
});

test('parent override jumps to a stage', () => {
  const r = checkAnswer(atRunes('o', 0), 'Бублик 7', T);
  assert.equal(r.outcome, 'jump');
  assert.equal(r.state.runes, 6);
  assert.equal(checkAnswer(atRunes('o', 0), 'БУБЛИК11', T).outcome, 'wrong');
});

test('tenth rune finishes the quest', () => {
  const r = applyToken(atRunes('y', 9), tok('y', 10), T + 9);
  assert.equal(r.outcome, 'rune');
  assert.equal(r.state.runes, 10);
  assert.equal(r.state.finishedAt, T + 9);
  assert.equal(applyToken(r.state, tok('y', 10), T).outcome, 'finished');
});

test('hint after 120 seconds', () => {
  const s = atRunes('y', 0);
  assert.equal(hintAvailable(s, T + 119_000), false);
  assert.equal(hintAvailable(s, T + 120_000), true);
});

test('data integrity', () => {
  assert.equal(STAGES.length, 10);
  const tokens = [START_TOKENS.y, START_TOKENS.o];
  for (const kid of Object.keys(KIDS)) {
    const words = new Set();
    STAGES.forEach((st, i) => {
      const p = st.perKid[kid];
      assert.ok(p.clue && p.hint && p.answers.length, `stage ${i + 1} ${kid} complete`);
      if (st.n === 5 || st.n === 7) assert.equal(p.token, null);
      else tokens.push(p.token);
      for (const a of p.answers) {
        const w = normalize(a);
        assert.ok(!words.has(w), `duplicate answer ${a}`);
        words.add(w);
      }
      if (p.clueType === 'cipher') {
        for (const ch of p.clue.replace(/\s/g, '')) assert.ok(ABETKA[ch], `no abetka for ${ch}`);
      }
    });
  }
  assert.equal(new Set(tokens).size, tokens.length, 'tokens unique');
  const emoji = Object.values(ABETKA);
  assert.equal(new Set(emoji).size, emoji.length, 'abetka emoji unique');
});
