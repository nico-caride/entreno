'use strict';

const P = window.PLAN;
const KEY = 'entreno.v1';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const fmt = (n, d = 1) => (n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: d }));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- datos (localStorage) ----------
const blank = () => ({ logs: {}, prot: {}, crea: {}, tests: {} });
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return Object.assign(blank(), d);
  } catch (e) { /* sin datos */ }
  return blank();
}
let DB = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('No se pudo guardar en el celular'); }
}

// ---------- fechas ----------
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fechaCorta = (s) => { const d = parseISO(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
const fechaLarga = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
function hoy() {
  // ?fecha=2026-10-21 en la URL simula otro día (para probar)
  const q = new URLSearchParams(location.search).get('fecha');
  const d = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? parseISO(q) : new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

// ---------- plan ----------
function estado(dISO) {
  let b = P.bloques.find((x) => dISO >= x.desde && dISO <= x.hasta);
  let fase = 'plan';
  if (!b) {
    if (dISO < P.bloques[0].desde) { b = P.bloques[0]; fase = 'antes'; }
    else { b = P.bloques[P.bloques.length - 1]; fase = 'despues'; }
  }
  const descarga = fase === 'plan' && !!b.descarga && dISO >= b.descarga.desde && dISO <= b.descarga.hasta;
  const dias = Math.round((parseISO(dISO) - parseISO(P.lunesSemana1)) / 864e5);
  return { b, fase, descarga, semana: Math.floor(dias / 7) + 1 };
}

function armarSesion(d) {
  const dISO = iso(d);
  const E = estado(dISO);
  const s = P.sesiones[P.semana[d.getDay()]];
  const mitad = E.descarga || (E.fase === 'plan' && E.b.volumenBajo);
  const items = [];
  if (s.movilidadEntrada) {
    items.push({
      id: 'mov-entrada', nombre: 'Movilidad de entrada', series: 1, texto: '5–8 min', sinPeso: true, fijo: true,
      lista: P.movilidadEntrada.map((id) => P.movilidad.find((m) => m.id === id)).filter(Boolean),
    });
  }
  for (const it of s.items) {
    if (it.intervalos) {
      (E.descarga ? P.viernesDescarga : E.b.intervalos).forEach((x) => items.push({ sinPeso: true, fijo: true, ...x }));
      continue;
    }
    if (it.movilidadCompleta) {
      P.movilidad.forEach((m) => items.push({ id: 'mov-' + m.id, nombre: m.nombre, series: 1, texto: m.dosis, sinPeso: true, fijo: true }));
      continue;
    }
    const x = { ...it, ...((E.b.ajustes || {})[it.id] || {}) };
    if (mitad && !x.fijo && x.series > 1) x.series = Math.ceil(x.series / 2);
    items.push(x);
  }
  return { s, E, items, dISO };
}

const fmtDesc = (x) => x.descansoTxt || (!x.descanso ? '' : x.descanso < 120 ? `${x.descanso} s` : `${fmt(x.descanso / 60)} min`);
const dosis = (x) => (x.texto || '{s} × {r}').replace('{s}', x.series).replace('{r}', x.reps ?? '');

function ultimoPeso(id, antesDe) {
  const fechas = Object.keys(DB.logs).filter((f) => f < antesDe).sort().reverse();
  for (const f of fechas) {
    const w = DB.logs[f]?.[id]?.w;
    if (w) return { w, f };
  }
  return null;
}

function chipBloque(E) {
  if (E.fase === 'antes') return `Arranca el ${fechaCorta(P.bloques[0].desde)} · ${esc(E.b.etiqueta)}`;
  if (E.fase === 'despues') return 'Plan terminado 🎉';
  return `${esc(E.b.etiqueta)} · Semana ${E.semana}`;
}

// ---------- tarjeta de ejercicio ----------
function card(x, dISO, soloVer) {
  if (x.seccion) return `<h3 class="seccion">${esc(x.seccion)}</h3>`;
  const log = DB.logs[dISO]?.[x.id] || {};
  const done = log.d || [];
  const n = x.series || 1;
  const completo = !soloVer && Array.from({ length: n }).every((_, i) => done[i]);
  const desc = fmtDesc(x);
  const ult = x.sinPeso ? null : ultimoPeso(x.id, dISO);

  let h = `<article class="ej${completo ? ' ok' : ''}" data-id="${esc(x.id)}" data-rest="${x.descanso || 0}" data-n="${n}" data-nombre="${esc(x.nombre)}">
    <div class="ej-top"><h3>${esc(x.nombre)}</h3><span class="dosis">${esc(dosis(x))}</span></div>`;
  const meta = [desc && `⏱ ${esc(desc)}`, x.nota && esc(x.nota)].filter(Boolean).join(' · ');
  if (meta) h += `<p class="meta">${meta}</p>`;
  if (x.lista) h += `<ul class="lista">${x.lista.map((m) => `<li>${esc(m.nombre)} <span>${esc(m.dosis)}</span></li>`).join('')}</ul>`;

  if (!x.sinPeso) {
    if (soloVer) {
      if (ult) h += `<p class="meta">Última vez: <b>${esc(ult.w)} kg</b> (${fechaCorta(ult.f)})</p>`;
    } else {
      h += `<div class="peso">
        <label class="kg-box"><input class="kg" type="text" inputmode="decimal" autocomplete="off" value="${esc(log.w || '')}" placeholder="${ult ? esc(ult.w) : '—'}" aria-label="Peso usado"><span>kg</span></label>
        ${ult ? `<button type="button" class="ult" data-w="${esc(ult.w)}"><span>Última: <b>${esc(ult.w)} kg</b></span><small>${fechaCorta(ult.f)} · tocá para copiar</small></button>`
              : '<span class="ult vacio">Sin registro previo</span>'}
      </div>`;
    }
  }
  if (!soloVer) {
    h += '<div class="sets">' + Array.from({ length: n }, (_, i) =>
      `<button type="button" class="set${done[i] ? ' on' : ''}" data-i="${i}" aria-label="Serie ${i + 1}">${done[i] ? '✓' : i + 1}</button>`).join('') + '</div>';
  }
  return h + '</article>';
}

// ---------- pantalla: HOY ----------
function vistaHoy() {
  const d = hoy();
  const { s, E, items, dISO } = armarSesion(d);
  let h = `<header class="top">
    <p class="fecha">${esc(cap(fechaLarga(d)))}</p>
    <h1>${esc(s.titulo)}</h1>
    <p class="sub">${esc([s.sub, s.duracion].filter(Boolean).join(' · '))}</p>
    <p class="chip">${chipBloque(E)}</p>
  </header>`;

  if (E.fase === 'antes') h += `<div class="aviso">El plan arranca el ${fechaCorta(P.bloques[0].desde)}. Esto es lo que toca este día de la semana.</div>`;
  if (E.descarga) h += `<div class="aviso descarga"><b>Descarga: la mitad de las series</b>${d.getDay() === 5 ? '<br>Hoy: zona 2 en vez de intervalos.' : ''}</div>`;
  if (E.fase === 'plan' && E.b.volumenBajo && E.b.aviso) h += `<div class="aviso descarga">${esc(E.b.aviso)}</div>`;

  const t = P.tests.fechas.find((x) => dISO >= x.fecha && dISO <= iso(addDays(parseISO(x.fecha), 6)));
  if (t && !testCompleto(t.id)) h += `<button type="button" class="aviso test" data-tab="progreso">📏 Semana de tests (${esc(t.nombre)}): cargalos en Progreso →</button>`;

  if (s.tipo !== 'descanso') h += '<p class="seg">⚠︎ Primera ronda al 70 %. Mareo, visión borrosa o FC que no baja: cortá la sesión.</p>';
  if (s.tipo === 'fuerza' && E.fase === 'plan' && !E.b.volumenBajo) h += `<p class="nota-bloque"><b>${esc(E.b.etiqueta)}:</b> ${esc(E.b.fuerza)}</p>`;

  h += items.map((x) => card(x, dISO, false)).join('');

  if (s.tipo === 'fuerza') h += `<div class="card regla"><h3>Regla de progresión</h3><p>${esc(P.reglas.progresion)}</p></div>`;
  if (s.tipo === 'cardio' && d.getDay() === 5) h += '<div class="card regla"><h3>Al terminar</h3><p>Caminá 3–5 min. Nunca pares de golpe.</p></div>';
  return h;
}

// ---------- pantalla: SEMANA ----------
let diaAbierto = null;
function vistaSemana() {
  const d = hoy();
  const lunes = addDays(d, -((d.getDay() + 6) % 7));
  const E = estado(iso(d));
  let h = `<header class="top"><h1>Semana</h1><p class="chip">${chipBloque(E)}</p></header>`;
  if (E.descarga) h += '<div class="aviso descarga"><b>Semana de descarga:</b> la mitad de las series y el viernes zona 2.</div>';

  ORDEN.forEach((dia, k) => {
    const f = addDays(lunes, k);
    const S = armarSesion(f);
    const esHoy = iso(f) === iso(d);
    h += `<details class="dia${esHoy ? ' hoy' : ''}" data-dia="${dia}"${diaAbierto === dia ? ' open' : ''}>
      <summary>
        <span class="dn">${DIAS[dia]}${esHoy ? ' <em>hoy</em>' : ''}</span>
        <span class="dt">${esc(S.s.titulo)}</span>
        <span class="dd">${esc(S.s.duracion || '')}</span>
      </summary>
      <div class="dia-body">${S.s.sub ? `<p class="meta">${esc(S.s.sub)}</p>` : ''}${S.items.map((x) => card(x, S.dISO, true)).join('')}</div>
    </details>`;
  });

  h += '<h2>Bloques</h2>';
  h += P.bloques.map((b) => `<div class="card bloque${b === E.b && E.fase === 'plan' ? ' actual' : ''}">
      <h3>${esc(b.etiqueta)}</h3>
      <p class="meta">${fechaCorta(b.desde)} – ${fechaCorta(b.hasta)}${b.descarga ? ` · descarga ${fechaCorta(b.descarga.desde)}–${fechaCorta(b.descarga.hasta)}` : ''}</p>
      <p><b>Fuerza:</b> ${esc(b.fuerza)}</p>
      <p><b>Viernes:</b> ${esc(b.viernesTxt)}</p>
      <p><b>Comida:</b> ${esc(b.comida)}</p>
    </div>`).join('');
  h += '<p class="meta pie">Semana de descarga: mismos ejercicios, la mitad de las series y el viernes zona 2 en vez de intervalos.</p>';
  return h;
}

// ---------- pantalla: NUTRICIÓN ----------
function vistaNutri() {
  const d = hoy();
  const dISO = iso(d);
  const E = estado(dISO);
  const N = P.nutricion;
  const m = E.b.macros;
  const total = (DB.prot[dISO] || []).reduce((a, b) => a + b, 0);
  const meta = N.proteinaMeta;
  const pct = Math.min(100, (total / meta) * 100);
  const falta = Math.max(0, meta - total);

  let h = `<header class="top"><h1>Nutrición</h1><p class="chip">${chipBloque(E)}</p></header>`;

  h += `<section class="card prot">
    <div class="prot-top"><h3>Proteína de hoy</h3><p class="prot-n"><b>${total}</b> / ${meta} g</p></div>
    <div class="bar${total >= meta ? ' llena' : ''}"><span style="width:${pct}%"></span></div>
    <p class="meta">${total >= meta ? '¡Listo! Llegaste a la meta.' : `Te faltan ${falta} g.${falta >= 25 ? ' Si no llegás: whey 25 g.' : ''}`}</p>
    <div class="botonera">${N.botonesProteina.map((g) => `<button type="button" class="btn grande" data-prot="${g}">+${g} g</button>`).join('')}</div>
    <div class="botonera comidas">${N.diaTipo.map((c) => `<button type="button" class="btn" data-prot="${c.prot}">${esc(c.comida)} <small>+${c.prot}</small></button>`).join('')}</div>
    <div class="botonera">
      <button type="button" class="btn sec" data-accion="deshacer"${total ? '' : ' disabled'}>Deshacer</button>
      <button type="button" class="btn sec${DB.crea[dISO] ? ' on' : ''}" data-accion="crea">${DB.crea[dISO] ? '✓ Creatina tomada' : 'Creatina 5 g'}</button>
    </div>
  </section>`;

  if (m) {
    h += `<section class="card"><h3>Macros · ${esc(E.b.etiqueta)}</h3>
      <div class="tiles">
        <div class="tile"><b>${fmt(m.kcal, 0)}</b><span>kcal</span></div>
        <div class="tile"><b>${m.prot} g</b><span>proteína</span></div>
        <div class="tile"><b>~${m.grasa} g</b><span>grasa</span></div>
        <div class="tile"><b>~${m.carbs} g</b><span>carbos</span></div>
      </div>
      <p class="meta">${esc(N.objetivo)}</p></section>`;
  } else {
    h += `<section class="card"><h3>Macros · ${esc(E.b.etiqueta)}</h3><p>${esc(N.mantenimiento)}</p></section>`;
  }

  const sinCarbCena = d.getDay() === 2 || d.getDay() === 0;
  h += `<section class="card"><h3>Día tipo</h3>
    ${sinCarbCena ? `<p class="aviso mini">Hoy es ${DIAS[d.getDay()].toLowerCase()}: sin papa ni arroz en la cena.</p>` : ''}
    <ul class="comidas-lista">${N.diaTipo.map((c) => `<li><div><b>${esc(c.comida)}</b><p>${esc(c.detalle)}</p></div><span>~${c.prot} g</span></li>`).join('')}</ul>
    <ul class="reglas">${N.notasDia.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;

  let avisoAlcohol = '';
  if (d.getDay() === 2 || d.getDay() === 4) avisoAlcohol = `<p class="aviso mini">Hoy no hay salida: mañana es ${d.getDay() === 2 ? 'miércoles' : 'viernes'}.</p>`;
  else if (d.getMonth() === 11) avisoAlcohol = '<p class="aviso mini">Diciembre: lo mínimo posible.</p>';
  h += `<section class="card"><h3>Alcohol y comida libre</h3>${avisoAlcohol}
    <ul class="reglas">${N.alcohol.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;

  h += `<section class="card"><h3>Todos los días</h3><ul class="reglas">${N.otros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Suplementos</h3><ul class="reglas">${N.suplementos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  return h;
}

// ---------- pantalla: PROGRESO ----------
let testSel = null;
let campoSel = 'peso';

function valorTest(tid, campo) {
  const t = DB.tests[tid] || {};
  if (campo === 'peso') {
    const v = [t.peso1, t.peso2, t.peso3].map(num).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  return num(t[campo]);
}
function testCompleto(tid) {
  return P.tests.campos.every((c) => valorTest(tid, c.id) != null);
}

function vistaProgreso() {
  const dISO = iso(hoy());
  if (!testSel) {
    const pasados = P.tests.fechas.filter((t) => t.fecha <= dISO);
    testSel = (pasados[pasados.length - 1] || P.tests.fechas[0]).id;
  }
  const t = DB.tests[testSel] || {};
  const tInfo = P.tests.fechas.find((x) => x.id === testSel);

  let h = '<header class="top"><h1>Progreso</h1><p class="sub">Tests cada 4 semanas</p></header>';

  h += `<div class="segmentos">${P.tests.fechas.map((x) => `<button type="button" class="${x.id === testSel ? 'on' : ''}" data-test="${x.id}">${esc(x.nombre)}${testCompleto(x.id) ? ' ✓' : ''}</button>`).join('')}</div>`;

  h += `<section class="card tests"><h3>Test · ${esc(tInfo.nombre)} <small>${fechaCorta(tInfo.fecha)}</small></h3>`;
  for (const c of P.tests.campos) {
    if (c.tres) {
      const prom = valorTest(testSel, 'peso');
      h += `<div class="campo"><label>${esc(c.nombre)} <small>${esc(c.nota)}</small></label>
        <div class="tres">${[1, 2, 3].map((i) => `<input type="text" inputmode="decimal" data-tc="peso${i}" value="${esc(t['peso' + i] || '')}" placeholder="Día ${i}" aria-label="Peso día ${i}">`).join('')}</div>
        <p class="prom">Promedio: <b id="prom-peso">${prom == null ? '—' : fmt(prom) + ' kg'}</b></p></div>`;
    } else {
      h += `<div class="campo fila"><label>${esc(c.nombre)} <small>${esc(c.nota)}</small></label>
        <div class="kg-box"><input type="text" inputmode="decimal" data-tc="${c.id}" value="${esc(t[c.id] || '')}" aria-label="${esc(c.nombre)}"><span>${esc(c.unidad)}</span></div></div>`;
    }
  }
  h += `<button type="button" class="check${t.foto ? ' on' : ''}" data-accion="foto">${t.foto ? '✓' : '○'} Foto de frente y de costado <small>(la foto queda en tu galería, no en la app)</small></button></section>`;

  h += `<section class="card"><h3>Evolución</h3>
    <div class="segmentos chico">${P.tests.campos.map((c) => `<button type="button" class="${c.id === campoSel ? 'on' : ''}" data-campo="${c.id}">${esc(c.nombre)}</button>`).join('')}</div>
    <div id="grafico">${grafico(campoSel)}</div></section>`;

  h += `<section class="card"><h3>Reglas de ajuste</h3><ul class="reglas">${P.reglas.ajuste.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  h += `<section class="card seguridad"><h3>Seguridad (disautonomía)</h3><ul class="reglas">${P.reglas.seguridad.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  h += `<section class="card"><h3>Progresión</h3><p>${esc(P.reglas.progresion)}</p></section>`;

  h += `<section class="card"><h3>Backup</h3>
    <p class="meta">Tus datos viven solo en este celular. Exportá un backup cada tanto y guardalo en Archivos, Drive o mandátelo por mail.</p>
    <div class="botonera">
      <button type="button" class="btn" data-accion="exportar">Exportar</button>
      <button type="button" class="btn sec" data-accion="importar">Importar</button>
    </div>
    <input type="file" id="archivo" accept="application/json,.json" hidden>
  </section>`;
  return h;
}

function grafico(campo) {
  const c = P.tests.campos.find((x) => x.id === campo);
  const pts = P.tests.fechas.map((t, i) => ({ i, t, v: valorTest(t.id, campo) }));
  const conDato = pts.filter((p) => p.v != null);
  if (!conDato.length) return '<p class="meta vacio-g">Todavía no hay datos. Cargá el primer test arriba.</p>';

  let min = Math.min(...conDato.map((p) => p.v));
  let max = Math.max(...conDato.map((p) => p.v));
  const obj = campo === 'peso' ? P.tests.pesoObjetivo : null;
  if (obj) { min = Math.min(min, obj[0]); max = Math.max(max, obj[1]); }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.18;
  min -= pad; max += pad;

  const W = 340, H = 200, L = 40, R = 18, T = 26, B = 30, M = 18;
  const x = (i) => L + M + (i * (W - L - R - 2 * M)) / (pts.length - 1);
  const y = (v) => T + ((max - v) / (max - min)) * (H - T - B);

  let s = `<svg viewBox="0 0 ${W} ${H}" class="svg-g" role="img" aria-label="Evolución de ${esc(c.nombre)}">`;
  for (let k = 0; k <= 3; k++) {
    const v = min + ((max - min) * k) / 3;
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/><text x="${L - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  if (obj) s += `<rect x="${L}" width="${W - L - R}" y="${y(obj[1])}" height="${y(obj[0]) - y(obj[1])}" class="g-obj"/><text x="${W - R - 4}" y="${y(obj[1]) - 4}" class="g-eje" text-anchor="end">objetivo</text>`;
  pts.forEach((p) => { s += `<text x="${x(p.i)}" y="${H - 8}" class="g-eje" text-anchor="middle">${fechaCorta(p.t.fecha)}</text>`; });
  if (conDato.length > 1) s += `<polyline points="${conDato.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}" class="g-linea"/>`;
  conDato.forEach((p) => {
    s += `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="5" class="g-punto"/><text x="${x(p.i)}" y="${y(p.v) - 10}" class="g-val" text-anchor="middle">${fmt(p.v)}</text>`;
  });
  s += '</svg>';

  if (conDato.length > 1) {
    const dlt = conDato[conDato.length - 1].v - conDato[0].v;
    s += `<p class="meta">Desde el primer test: <b>${dlt > 0 ? '+' : ''}${fmt(dlt)} ${esc(c.unidad)}</b></p>`;
  }
  return s;
}

// ---------- navegación ----------
let tab = 'hoy';
let fechaRender = '';
const VISTAS = { hoy: vistaHoy, semana: vistaSemana, nutri: vistaNutri, progreso: vistaProgreso };

function render(nuevo, mantenerScroll) {
  if (nuevo) tab = nuevo;
  const y = window.scrollY;
  $('#view').innerHTML = VISTAS[tab]();
  fechaRender = iso(hoy());
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, mantenerScroll ? y : 0);
}

// ---------- temporizador ----------
const T = { end: 0, total: 0, int: null, lock: null, finTimeout: null };
let audio = null;

function unlockAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) { /* sin audio */ }
}
function beep() {
  if (!audio) return;
  [0, 0.25, 0.5].forEach((t) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.18);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t);
    o.stop(audio.currentTime + t + 0.2);
  });
}
async function pedirWakeLock() {
  try { if ('wakeLock' in navigator && !T.lock) T.lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no soportado */ }
}
function soltarWakeLock() {
  try { T.lock && T.lock.release(); } catch (e) { /* nada */ }
  T.lock = null;
}

function startTimer(seg, nombre) {
  clearTimeout(T.finTimeout);
  T.end = Date.now() + seg * 1000;
  T.total = seg;
  $('#timer-lbl').textContent = `Descanso · ${nombre}`;
  $('#timer').hidden = false;
  $('#timer').classList.remove('fin');
  document.body.classList.add('con-timer');
  clearInterval(T.int);
  T.int = setInterval(tick, 250);
  tick();
  pedirWakeLock();
}
function tick() {
  const ms = T.end - Date.now();
  if (ms <= 0) return finTimer(true);
  const s = Math.ceil(ms / 1000);
  $('#timer-t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#timer-bar').style.width = `${Math.max(0, (ms / (T.total * 1000)) * 100)}%`;
}
function finTimer(sonar) {
  clearInterval(T.int);
  T.int = null;
  soltarWakeLock();
  if (!sonar) return cerrarTimer();
  beep();
  try { navigator.vibrate && navigator.vibrate([300, 120, 300, 120, 300]); } catch (e) { /* nada */ }
  $('#timer').classList.add('fin');
  $('#timer-lbl').textContent = 'Terminó el descanso';
  $('#timer-t').textContent = '¡Dale!';
  $('#timer-bar').style.width = '0%';
  T.finTimeout = setTimeout(cerrarTimer, 5000);
}
function cerrarTimer() {
  $('#timer').hidden = true;
  document.body.classList.remove('con-timer');
}

// ---------- toast ----------
let toastT = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 2500);
}

// ---------- backup ----------
async function exportar() {
  const nombre = `entreno-backup-${iso(new Date())}.json`;
  const blob = new Blob([JSON.stringify({ app: 'entreno', version: 1, fecha: new Date().toISOString(), datos: DB }, null, 2)], { type: 'application/json' });
  const file = new File([blob], nombre, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Entreno' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function importar(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      const datos = j.datos || j;
      if (!datos || typeof datos !== 'object' || !('logs' in datos)) throw new Error('formato');
      if (!confirm('Esto reemplaza todos los datos del celular por los del backup. ¿Seguimos?')) return;
      DB = Object.assign(blank(), datos);
      save();
      toast('Backup importado');
      render(tab);
    } catch (e) { toast('Ese archivo no es un backup válido'); }
  };
  r.readAsText(file);
}

// ---------- eventos ----------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button, summary');
  if (!el) return;

  if (el.dataset.tab) return render(el.dataset.tab);

  if (el.dataset.timer === 'mas') { T.end += 15000; T.total += 15; return tick(); }
  if (el.dataset.timer === 'fin') { clearTimeout(T.finTimeout); return finTimer(false); }

  // tildar serie
  if (el.classList.contains('set')) {
    unlockAudio();
    const art = el.closest('.ej');
    const dISO = iso(hoy());
    const log = (DB.logs[dISO] ||= {});
    const e = (log[art.dataset.id] ||= { w: '', d: [] });
    const i = +el.dataset.i;
    e.d[i] = !e.d[i];
    save();
    el.classList.toggle('on', e.d[i]);
    el.textContent = e.d[i] ? '✓' : i + 1;
    const n = +art.dataset.n;
    const completo = Array.from({ length: n }).every((_, k) => e.d[k]);
    art.classList.toggle('ok', completo);
    const rest = +art.dataset.rest;
    if (e.d[i] && rest) startTimer(rest, art.dataset.nombre);
    try { navigator.vibrate && navigator.vibrate(15); } catch (x) { /* nada */ }
    return;
  }

  // copiar última carga
  if (el.classList.contains('ult') && el.dataset.w) {
    const inp = el.closest('.ej').querySelector('.kg');
    inp.value = el.dataset.w;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (el.dataset.prot) {
    const dISO = iso(hoy());
    (DB.prot[dISO] ||= []).push(+el.dataset.prot);
    save();
    return render('nutri', true);
  }

  if (el.dataset.test) { testSel = el.dataset.test; return render('progreso', true); }
  if (el.dataset.campo) { campoSel = el.dataset.campo; return render('progreso', true); }

  const acc = el.dataset.accion;
  if (acc === 'deshacer') { (DB.prot[iso(hoy())] || []).pop(); save(); return render('nutri', true); }
  if (acc === 'crea') { const k = iso(hoy()); DB.crea[k] = !DB.crea[k]; save(); return render('nutri', true); }
  if (acc === 'foto') { const t = (DB.tests[testSel] ||= {}); t.foto = !t.foto; save(); return render('progreso', true); }
  if (acc === 'exportar') return exportar();
  if (acc === 'importar') return $('#archivo').click();
});

document.addEventListener('toggle', (ev) => {
  const d = ev.target;
  if (d.classList && d.classList.contains('dia')) {
    if (d.open) diaAbierto = +d.dataset.dia;
    else if (diaAbierto === +d.dataset.dia) diaAbierto = null;
  }
}, true);

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.classList.contains('kg') && el.closest('.ej')) {
    const dISO = iso(hoy());
    const log = (DB.logs[dISO] ||= {});
    const e = (log[el.closest('.ej').dataset.id] ||= { w: '', d: [] });
    e.w = el.value.trim().replace('.', ',');
    save();
    return;
  }
  if (el.dataset.tc) {
    const t = (DB.tests[testSel] ||= {});
    t[el.dataset.tc] = el.value.trim();
    save();
    if (el.dataset.tc.startsWith('peso')) {
      const p = valorTest(testSel, 'peso');
      $('#prom-peso').textContent = p == null ? '—' : fmt(p) + ' kg';
    }
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.dataset.tc) $('#grafico').innerHTML = grafico(campoSel);
  if (ev.target.id === 'archivo' && ev.target.files[0]) importar(ev.target.files[0]);
});

// Si la app quedó abierta de un día para el otro, refresca
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (T.int) { tick(); pedirWakeLock(); }
  if (iso(hoy()) !== fechaRender) render(tab);
});

render('hoy');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
