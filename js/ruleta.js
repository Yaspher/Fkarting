/* ═══════════════════════════════════════════════════════
   RULETA.JS — autocontenido (no depende de connection.js)
═══════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://kgzqqaxhqcydrvzqnxmk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg';

async function fetchPilotos() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vista_piloto?select=Nombre,Numero`,
    {
      headers: {
        apikey:        SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */

let allPilotos   = [];
let excludedSet  = new Set();
let participants = [];
let historyData  = [];
let rotation     = 0;
let spinning     = false;

/* ═══════════════════════════════════════════════════════
   CANVAS
═══════════════════════════════════════════════════════ */

const canvas = document.getElementById('wheel');
const ctx    = canvas.getContext('2d');
const CX     = canvas.width  / 2;
const CY     = canvas.height / 2;
const R      = (canvas.width / 2) - 8;
const TAU    = Math.PI * 2;

const SLICE_COLORS = [
  '#b91c1c', '#111111', '#991b1b',
  '#0d0d0d', '#7f1d1d', '#141414',
];

/* ═══════════════════════════════════════════════════════
   DRAW
═══════════════════════════════════════════════════════ */

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!participants.length) return drawEmptyWheel();

  const n     = participants.length;
  const slice = TAU / n;

  /* Halo exterior */
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R + 6, 0, TAU);
  ctx.strokeStyle = 'rgba(127,29,29,0.4)';
  ctx.lineWidth   = 12;
  ctx.stroke();
  ctx.restore();

  /* Rebanadas */
  participants.forEach((p, i) => {
    const a = i * slice + rotation;

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, a, a + slice);
    ctx.closePath();
    ctx.fillStyle = SLICE_COLORS[i % SLICE_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(a + slice / 2);
    ctx.textAlign = 'right';

    ctx.font      = `900 21px 'Barlow Condensed', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`#${p.number}`, R - 36, -6);

    ctx.font      = `600 15px 'Barlow', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(p.name.toUpperCase(), R - 36, 14);

    ctx.restore();
  });

  /* Divisores */
  participants.forEach((_, i) => {
    const a = i * slice + rotation;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
    ctx.strokeStyle = 'rgba(220,38,38,0.25)';
    ctx.lineWidth   = 2;
    ctx.stroke();
  });

  /* Cap central */
  const capR = 58;
  ctx.beginPath();
  ctx.arc(CX, CY, capR, 0, TAU);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,29,29,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, capR - 8, 0, TAU);
  ctx.strokeStyle = 'rgba(127,29,29,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,38,38,0.9)';
  ctx.font      = `900 16px 'Barlow Condensed', sans-serif`;
  ctx.fillText('FK', CX, CY + 6);
}

function drawEmptyWheel() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,29,29,0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(127,29,29,0.5)';
  ctx.font      = `700 18px 'Barlow', sans-serif`;
  ctx.fillText('Sin pilotos activos', CX, CY);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════
   SYNC / STATS / BADGE
═══════════════════════════════════════════════════════ */

function syncParticipants() {
  participants = allPilotos.filter((_, i) => !excludedSet.has(i));
  drawWheel();
  updateStats();
  updatePilotsBadge();
}

function updateStats(winner) {
  document.getElementById('statUltimo').textContent =
    winner ? `#${winner.number}`
           : (historyData[0] ? `#${historyData[0].number}` : '—');
  document.getElementById('statPilotos').textContent = participants.length;
}

function updatePilotsBadge() {
  const badge  = document.getElementById('pilotsBadge');
  const btn    = document.getElementById('editPilotsBtn');
  const active = allPilotos.length - excludedSet.size;
  const total  = allPilotos.length;

  if (!total) {
    badge.textContent = '—';
    btn.classList.remove('filtered');
    return;
  }
  badge.textContent = `${active}/${total}`;
  btn.classList.toggle('filtered', excludedSet.size > 0);
}

/* ═══════════════════════════════════════════════════════
   SPIN
═══════════════════════════════════════════════════════ */

function pickRandom() {
  return participants[Math.floor(Math.random() * participants.length)];
}

function spin() {
  if (spinning || !participants.length) return;
  spinning = true;

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;

  const winner = pickRandom();
  const index  = participants.indexOf(winner);
  const slice  = TAU / participants.length;

  const fullTurns = 7 + Math.floor(Math.random() * 3);

  let targetAngle = (-Math.PI / 2) - index * slice - slice / 2;
  targetAngle     = ((targetAngle % TAU) + TAU) % TAU;

  const currentNorm = ((rotation % TAU) + TAU) % TAU;

  let delta = targetAngle - currentNorm;
  if (delta < 0) delta += TAU;

  const target   = rotation + delta + TAU * fullTurns;
  const start    = rotation;
  const duration = 7200;
  let   startT   = null;

  function animate(ts) {
    if (!startT) startT = ts;
    const elapsed = ts - startT;
    const pct     = Math.min(elapsed / duration, 1);
    const ease    = 1 - Math.pow(1 - pct, 4);

    rotation = start + (target - start) * ease;
    drawWheel();

    if (pct < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      btn.disabled = false;
      showWinner(winner);
    }
  }

  requestAnimationFrame(animate);
}

/* ═══════════════════════════════════════════════════════
   WINNER / HISTORY
═══════════════════════════════════════════════════════ */

function showWinner(winner) {
  const box = document.getElementById('winnerBox');
  box.classList.add('has-winner');
  box.innerHTML = `
    <div class="winner-content">
      <span class="winner-label">🏆 Ganador</span>
      <span class="winner-name">${winner.name}</span>
      <span class="winner-num">#${winner.number}</span>
    </div>`;
  addHistory(winner);
  updateStats(winner);
}

function addHistory(winner) {
  historyData.unshift(winner);
  renderHistory();
}

function renderHistory() {
  const list  = document.getElementById('historyList');
  const count = document.getElementById('historyCount');
  count.textContent = historyData.length;

  if (!historyData.length) {
    list.innerHTML = `<p class="history-empty">Aún no hay resultados.<br>¡Gira la ruleta!</p>`;
    return;
  }

  list.innerHTML = historyData.map((w, i) => {
    const pos      = i + 1;
    const posClass = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
    return `
      <div class="history-item" data-idx="${i}">
        <span class="history-pos ${posClass}">${pos}</span>
        <span class="history-num">#${w.number}</span>
        <div class="history-info">
          <div class="history-name">${w.name}</div>
        </div>
        <button class="del-btn" data-del="${i}" title="Eliminar">✕</button>
      </div>`;
  }).join('');
}

function deleteHistory(idx) {
  historyData.splice(idx, 1);
  renderHistory();
  updateStats();
}

/* Delegación de eventos para el botón eliminar */
document.getElementById('historyList').addEventListener('click', e => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  deleteHistory(Number(btn.dataset.del));
});

/* ═══════════════════════════════════════════════════════
   CLEAR
═══════════════════════════════════════════════════════ */

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!historyData.length) return;
  if (!confirm('¿Limpiar todo el historial?')) return;

  historyData = [];
  renderHistory();
  updateStats();

  const box = document.getElementById('winnerBox');
  box.classList.remove('has-winner');
  box.innerHTML = `<span class="winner-idle">Esperando resultado...</span>`;
});

/* ═══════════════════════════════════════════════════════
   HAMBURGER MENU
═══════════════════════════════════════════════════════ */

const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMobile.classList.toggle('open');
});

navMobile.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navMobile.classList.remove('open');
  });
});

/* ═══════════════════════════════════════════════════════
   LOADING STATE
═══════════════════════════════════════════════════════ */

function setLoading(on) {
  const btn = document.getElementById('spinBtn');
  btn.disabled = on;
  btn.innerHTML = on
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin-icon .8s linear infinite;width:20px;height:20px"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Cargando...`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg> Girar Ruleta`;
}

/* ═══════════════════════════════════════════════════════
   PILOT EDITOR MODAL
═══════════════════════════════════════════════════════ */

const pilotsModal  = document.getElementById('pilotsModal');
const pilotsList   = document.getElementById('pilotsList');
const pilotsSearch = document.getElementById('pilotsSearch');

function renderPilotsList(filter = '') {
  const q = filter.toLowerCase().trim();
  pilotsList.innerHTML = '';

  allPilotos.forEach((p, idx) => {
    const label = `${p.name} #${p.number}`;
    if (q && !label.toLowerCase().includes(q)) return;

    const included = !excludedSet.has(idx);
    const row      = document.createElement('div');
    row.className  = `pilot-row ${included ? 'included' : 'excluded'}`;
    row.setAttribute('role', 'listitem');
    row.setAttribute('data-idx', idx);

    row.innerHTML = `
      <div class="pilot-toggle"></div>
      <span class="pilot-num-badge">#${p.number}</span>
      <span class="pilot-row-name">${p.name}</span>
    `;

    row.addEventListener('click', () => {
      if (excludedSet.has(idx)) {
        excludedSet.delete(idx);
        row.classList.add('included');
        row.classList.remove('excluded');
      } else {
        excludedSet.add(idx);
        row.classList.remove('included');
        row.classList.add('excluded');
      }
      updateModalCount();
    });

    pilotsList.appendChild(row);
  });

  updateModalCount();
}

function updateModalCount() {
  const active = allPilotos.length - excludedSet.size;
  const el = document.getElementById('modalActiveCount');
  el.innerHTML = `<strong>${active}</strong> piloto${active !== 1 ? 's' : ''} activo${active !== 1 ? 's' : ''}`;
  updatePilotsBadge();
}

function openPilotsModal() {
  renderPilotsList(pilotsSearch.value);
  pilotsModal.classList.add('open');
  pilotsSearch.focus();
}

function closePilotsModal() {
  pilotsModal.classList.remove('open');
}

pilotsSearch.addEventListener('input', () => renderPilotsList(pilotsSearch.value));

document.getElementById('btnSelectAll').addEventListener('click', () => {
  excludedSet.clear();
  renderPilotsList(pilotsSearch.value);
});

document.getElementById('btnSelectNone').addEventListener('click', () => {
  allPilotos.forEach((_, i) => excludedSet.add(i));
  renderPilotsList(pilotsSearch.value);
});

document.getElementById('btnApplyPilots').addEventListener('click', () => {
  syncParticipants();
  closePilotsModal();

  if (historyData.length &&
      !participants.some(p => p.number === historyData[0].number)) {
    const box = document.getElementById('winnerBox');
    box.classList.remove('has-winner');
    box.innerHTML = `<span class="winner-idle">Esperando resultado...</span>`;
  }
});

pilotsModal.addEventListener('click', e => {
  if (e.target === pilotsModal) closePilotsModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && pilotsModal.classList.contains('open')) closePilotsModal();
});

document.getElementById('closeModalBtn').addEventListener('click', closePilotsModal);
document.getElementById('editPilotsBtn').addEventListener('click', openPilotsModal);

/* ═══════════════════════════════════════════════════════
   SPIN BUTTON
═══════════════════════════════════════════════════════ */

document.getElementById('spinBtn').addEventListener('click', spin);

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */

async function init() {
  setLoading(true);
  drawWheel();

  try {
    const data = await fetchPilotos();

    if (!data || !data.length) {
      document.getElementById('winnerBox').innerHTML =
        `<span class="winner-idle" style="color:var(--red-500)">No hay pilotos registrados en la base de datos.</span>`;
      return;
    }

    allPilotos = data.map(p => ({
      name:   p.Nombre ?? p.nombre ?? 'Piloto',
      number: p.Numero ?? p.numero ?? '—',
    }));
    excludedSet = new Set();
    syncParticipants();

  } catch (err) {
    console.error('Error cargando pilotos:', err);
    document.getElementById('winnerBox').innerHTML =
      `<span class="winner-idle" style="color:var(--red-500)">Error conectando a la base de datos.</span>`;
  } finally {
    setLoading(false);
  }
}

init();