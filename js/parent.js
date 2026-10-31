import { KIDS, STAGES, ABETKA, START_TOKENS } from './quest-data.js';

const BASE = new URL('./', location.href).href;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const runeImg = (n) => `assets/runes/rune-${n}.jpg`;

document.querySelector('#base-url').textContent = BASE;
document.querySelector('#url-warning').hidden = location.protocol === 'https:';
document.querySelector('#print').addEventListener('click', () => window.print());

function qrSvg(token) {
  const qr = qrcode(0, 'M');
  qr.addData(`${BASE}#k=${token}`);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

const kidTag = (kid) => `<span class="tag" style="--c:${KIDS[kid].color}">${KIDS[kid].emoji} ${esc(KIDS[kid].label)}</span>`;

// ---------- 1. Інструкція ----------
function guideSheet() {
  const rows = STAGES.map((st) => {
    const cell = (kid) => {
      const p = st.perKid[kid];
      if (st.n === 5) return `6 шматків карти ${KIDS[kid].emoji}`;
      if (st.n === 7) return `${kid === 'y' ? 5 : 6} паперових Бубликів ${KIDS[kid].emoji}`;
      return `картка №${st.n} · <b>${esc(p.answers[0])}</b>`;
    };
    return `<tr><td>${st.n}</td><td>${esc(st.rune)}</td><td>${esc(st.place)}</td><td>${cell('y')}</td><td>${cell('o')}</td></tr>`;
  }).join('');
  return `<section class="sheet guide">
    <h2>Як підготувати квест</h2>
    <ol>
      <li>Роздрукуйте всі аркуші. Виріжте картки, обидві карти (по білих розривах — по 6 шматків) і паперових Бубликів.</li>
      <li>Сховайте все за таблицею. На кожному місці — дві картки: 🎃 помаранчева і 🔮 фіолетова.</li>
      <li>Старшому: Абетку Моргани покладіть біля вхідних дверей разом із карткою №1.</li>
      <li>Ванна: поставте 2 миски, воду з барвником, соду й оцет — для Зілля Хаосу.</li>
      <li>Сховайте подарунки (зараз загадка №10 веде під подушку дитини).</li>
      <li><b>Перевірте заздалегідь на кожному телефоні:</b> відскануйте Старт-картку і картку №1 Камерою, переконайтесь, що з'явилась руна, потім скиньте гру (довге натискання на заголовок → «Почати знову»).</li>
      <li>Дайте дітям Старт-картки: вони сканують їх <b>звичайною Камерою телефону</b> — і гра починається.</li>
    </ol>
    <table>
      <thead><tr><th>№</th><th>Руна</th><th>Де сховати</th><th>🎃 ${esc(KIDS.y.label)}</th><th>🔮 ${esc(KIDS.o.label)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">Якщо щось пішло не так: у полі відповіді введіть <b>БУБЛИК</b> і номер етапу (напр. <b>БУБЛИК7</b>) — дитину буде перенесено на цей етап. «Почати знову» — довге натискання на заголовок застосунку.</p>
  </section>`;
}

// ---------- 2. Картки ----------
function card(kid, n) {
  const k = KIDS[kid];
  if (n === 0) {
    return `<article class="card" style="--c:${k.color}">
      <header>${k.emoji} Старт-картка</header>
      <div class="body start">
        <img class="bub" src="assets/bublik.png" alt="">
        <div class="qr">${qrSvg(START_TOKENS[kid])}</div>
      </div>
      <p class="for">${esc(k.label)}</p>
      <p class="word">Наведи камеру телефону на квадратик — і пригода почнеться!</p>
    </article>`;
  }
  const st = STAGES[n - 1];
  const p = st.perKid[kid];
  return `<article class="card" style="--c:${k.color}">
    <header>${k.emoji} Лист №${n} · Руна ${esc(st.rune)}</header>
    <div class="body">
      <img class="rune" src="${runeImg(n)}" alt="">
      <div class="qr">${qrSvg(p.token)}</div>
    </div>
    <p class="word">Чарівне слово: <b>${esc(p.answers[0])}</b></p>
    ${p.cardNote ? `<p class="cardnote">${esc(p.cardNote)}</p>` : ''}
    <p class="for">для: ${esc(k.label)}</p>
  </article>`;
}

function cardSheets() {
  const pages = [];
  for (const kid of Object.keys(KIDS)) {
    const nums = [0, ...STAGES.filter((s) => s.perKid[kid].token).map((s) => s.n)];
    for (let i = 0; i < nums.length; i += 6) {
      pages.push(`<section class="sheet cards">${nums.slice(i, i + 6).map((n) => card(kid, n)).join('')}</section>`);
    }
  }
  return pages.join('');
}

// ---------- 3. Карти ----------
const PIECE_SPOTS = [[17, 40], [50, 36], [82, 40], [17, 92], [48, 92], [82, 92]];
function mapSheet() {
  const map = (kid) => `<figure class="map" style="--c:${KIDS[kid].color}">
    <img src="assets/map.webp" alt="Карта">
    ${PIECE_SPOTS.map(([x, y]) => `<span class="badge" style="left:${x}%;top:${y}%">${KIDS[kid].emoji}</span>`).join('')}
    <figcaption>${kidTag(kid)} — розріжте по білих розривах на 6 шматків</figcaption>
  </figure>`;
  return `<section class="sheet maps">${map('y')}${map('o')}</section>`;
}

// ---------- 4. Паперові Бублики ----------
function ghostsSheet() {
  const yWord = [...'ДРУЗІ'].map((ch, i) => ({ mark: ch, num: i + 1 }));
  const oWord = [...'ДРУЖБА'].map((ch) => ({ mark: ABETKA[ch] }));
  const order = [2, 4, 0, 5, 3, 1]; // перемішано, щоб не скласти слово з першого погляду
  const ghost = (kid, g) => `<div class="ghost" style="--c:${KIDS[kid].color}">
    <img src="assets/bublik.png" alt="">
    <span class="mark ${kid === 'o' ? 'emoji' : ''}">${g.mark}</span>
    ${g.num ? `<span class="num">${g.num}</span>` : ''}
  </div>`;
  return `<section class="sheet ghosts">
    <h2>Паперові Бублики — етап 7 (сховати в дитячій)</h2>
    <h3>${kidTag('y')} слово ДРУЗІ</h3>
    <div class="ghost-row">${yWord.map((g) => ghost('y', g)).join('')}</div>
    <h3>${kidTag('o')} слово ДРУЖБА (знаки з Абетки, без номерів)</h3>
    <div class="ghost-row">${order.map((i) => ghost('o', oWord[i])).join('')}</div>
  </section>`;
}

// ---------- 5. Абетка Моргани ----------
function abetkaSheet() {
  return `<section class="sheet abetka" style="--c:${KIDS.o.color}">
    <h2>📜 Абетка Моргани</h2>
    <p class="sub">Кожен знак — це літера. Розшифруй послання відьми!</p>
    <div class="abc">${Object.entries(ABETKA).map(([l, e]) => `<div><b>${l}</b><span>${e}</span></div>`).join('')}</div>
  </section>`;
}

document.querySelector('#sheets').innerHTML = guideSheet() + cardSheets() + mapSheet() + ghostsSheet() + abetkaSheet();
