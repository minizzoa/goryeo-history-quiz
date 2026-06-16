'use strict';

const NUMS = ['①','②','③','④'];
const DIFF_NAMES = ['','쉬움','쉬움','보통','보통','어려움','어려움','최고 난이도'];
const DIFF_COLORS = ['','#1D9E75','#1D9E75','#639922','#BA7517','#EF9F27','#D85A30','#E24B4A'];
const DIFF_STARS = (l) => '★'.repeat(l) + '☆'.repeat(7 - l);

let state = {
  tab: 'obj',
  answered: false,
  cur: null,
  used: { obj: [], sub: [] },
  stats: { obj: { c:0, w:0, t:0 }, sub: { c:0, w:0, t:0 } },
  streak: 0,
  soundOn: true,
};

// ── DOM refs ──
const $ = (id) => document.getElementById(id);
const qArea   = $('q-area');
const nextBtn = $('next-btn');
const toast   = $('toast');

// ── Sound Engine (Web Audio API) ──
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(config) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudioCtx();
    config.forEach(({ freq, start, dur, type = 'sine', gain = 0.3 }) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      vol.gain.setValueAtTime(gain, ctx.currentTime + start);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
  } catch(e) {}
}

function soundCorrect() {
  playTone([
    { freq: 523, start: 0,    dur: 0.12, type: 'triangle', gain: 0.25 },
    { freq: 659, start: 0.1,  dur: 0.12, type: 'triangle', gain: 0.25 },
    { freq: 784, start: 0.2,  dur: 0.22, type: 'triangle', gain: 0.28 },
  ]);
}

function soundWrong() {
  playTone([
    { freq: 300, start: 0,    dur: 0.15, type: 'sawtooth', gain: 0.18 },
    { freq: 220, start: 0.15, dur: 0.22, type: 'sawtooth', gain: 0.15 },
  ]);
}

function soundStreak() {
  playTone([
    { freq: 523, start: 0,    dur: 0.09, type: 'triangle', gain: 0.22 },
    { freq: 659, start: 0.09, dur: 0.09, type: 'triangle', gain: 0.22 },
    { freq: 784, start: 0.18, dur: 0.09, type: 'triangle', gain: 0.22 },
    { freq: 1047,start: 0.27, dur: 0.22, type: 'triangle', gain: 0.28 },
  ]);
}

function soundTab() {
  playTone([{ freq: 440, start: 0, dur: 0.1, type: 'sine', gain: 0.15 }]);
}

function soundNext() {
  playTone([{ freq: 380, start: 0, dur: 0.08, type: 'sine', gain: 0.12 }]);
}

// ── Sound toggle ──
function toggleSound() {
  state.soundOn = !state.soundOn;
  $('sound-btn').textContent = state.soundOn ? '🔊' : '🔇';
  if (state.soundOn) playTone([{ freq: 660, start: 0, dur: 0.1, type: 'sine', gain: 0.2 }]);
}

// ── Question picking ──
function getLevel(tab) {
  return Math.min(7, 1 + Math.floor(state.stats[tab].c / 2));
}

function pickQ(tab) {
  const pool = tab === 'obj' ? OBJ_Q : SUB_Q;
  const used = state.used[tab];
  const level = getLevel(tab);

  let candidates = pool.filter(q => !used.includes(q) && q.level === level);
  if (!candidates.length) candidates = pool.filter(q => !used.includes(q));
  if (!candidates.length) {
    state.used[tab] = [];
    candidates = pool.filter(q => q.level === level);
    if (!candidates.length) candidates = pool;
  }

  const q = candidates[Math.floor(Math.random() * candidates.length)];
  state.used[tab].push(q);
  return q;
}

// ── Tab switch ──
function switchTab(tab) {
  if (tab !== state.tab) soundTab();
  state.tab = tab;
  state.answered = false;

  $('tab-obj').className = 'tab-btn' + (tab === 'obj' ? ' active-obj' : '');
  $('tab-sub').className = 'tab-btn' + (tab === 'sub' ? ' active-sub' : '');

  nextBtn.style.display = 'none';
  nextBtn.className = 'next-btn ' + tab;

  state.cur = pickQ(tab);
  renderQ();
  updateStats();
}

// ── Render question ──
function renderQ() {
  const q   = state.cur;
  const tab = state.tab;
  const s   = state.stats[tab];
  state.answered = false;
  nextBtn.style.display = 'none';

  let html = `
    <div class="q-card">
      <div class="q-meta">
        <span class="badge badge-${tab}">${tab === 'obj' ? '객관식' : '주관식'}</span>
        <span class="diff-stars">${DIFF_STARS(q.level)}</span>
        <span class="q-number">문제 ${s.t + 1}</span>
      </div>
      <p class="q-text">${q.q}</p>`;

  if (tab === 'obj') {
    html += `<div class="choices">`;
    q.choices.forEach((c, i) => {
      html += `<button class="choice" id="c${i}" onclick="checkObj(${i})">
                 <span class="choice-num">${NUMS[i]}</span>${c}
               </button>`;
    });
    html += `</div>`;
  } else {
    html += `<textarea class="sub-input" id="sub-in" placeholder="답을 입력하세요" rows="2"></textarea>
             <button class="sub-submit" id="sub-btn" onclick="checkSub()">제출하기</button>`;
  }

  html += `<div class="feedback" id="feedback"></div></div>`;
  qArea.innerHTML = html;
  qArea.scrollTop = 0;

  if (tab === 'sub') {
    $('sub-in').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); checkSub(); }
    });
  }
}

// ── Check objective ──
function checkObj(idx) {
  if (state.answered) return;
  state.answered = true;

  const q = state.cur;
  for (let i = 0; i < q.choices.length; i++) {
    const btn = $('c' + i);
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    else if (i === idx) btn.classList.add('wrong');
  }

  const ok = idx === q.answer;
  recordResult(ok, q.explain, null);
}

// ── Check subjective ──
function checkSub() {
  if (state.answered) return;
  const val = $('sub-in').value.trim();
  if (!val) return;

  state.answered = true;
  $('sub-in').disabled = true;
  $('sub-btn').disabled = true;

  const q = state.cur;
  const ok = q.answer.some(a =>
    val.replace(/\s/g,'').includes(a.replace(/\s/g,'')) ||
    a.replace(/\s/g,'').includes(val.replace(/\s/g,''))
  );

  recordResult(ok, q.explain, ok ? null : q.answer[0]);
}

// ── Record result ──
function recordResult(ok, explain, correctAns) {
  const tab = state.tab;
  const s   = state.stats[tab];
  s.t++;
  if (ok) { s.c++; state.streak++; } else { s.w++; state.streak = 0; }

  if (ok) soundCorrect(); else soundWrong();

  updateStats();

  const fb = $('feedback');
  if (ok) {
    fb.className = 'feedback correct';
    fb.innerHTML = `<div class="result-emoji">✅</div><strong>정답!</strong> ${explain}`;
  } else {
    fb.className = 'feedback wrong';
    fb.innerHTML = `<div class="result-emoji">❌</div><strong>오답.</strong> ${correctAns ? `정답: <strong>${correctAns}</strong><br>` : ''}${explain}`;
  }

  nextBtn.style.display = 'block';

  if (ok && state.streak > 0 && state.streak % 3 === 0) {
    setTimeout(soundStreak, 350);
    showToast(`🔥 ${state.streak}연속 정답!`);
  }
}

// ── Stats update ──
function updateStats() {
  const tab = state.tab;
  const s   = state.stats[tab];
  $('s-correct').textContent = s.c;
  $('s-wrong').textContent   = s.w;
  $('s-total').textContent   = s.t;
  $('s-rate').textContent    = s.t > 0 ? Math.round(s.c / s.t * 100) + '%' : '—';

  const level = state.cur ? state.cur.level : 1;
  const pct   = Math.round((level - 1) / 6 * 100);
  $('diff-fill').style.width      = pct + '%';
  $('diff-fill').style.background = DIFF_COLORS[level] || '#1D9E75';
  $('diff-name').textContent      = DIFF_NAMES[level] || '';
  $('diff-stars-bar').textContent = DIFF_STARS(level);

  const streak = $('streak-badge');
  if (state.streak >= 3) {
    streak.classList.add('visible');
    streak.textContent = `🔥 ${state.streak}연속`;
  } else {
    streak.classList.remove('visible');
  }
}

// ── Next question ──
function nextQ() {
  soundNext();
  state.cur = pickQ(state.tab);
  renderQ();
  updateStats();
}

// ── Toast ──
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  switchTab('obj');
});
