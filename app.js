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
const rango = (n) => Array.from({ length: n }, (_, i) => i);

// ---------- datos (localStorage) ----------
const blank = () => ({ logs: {}, prot: {}, crea: {}, tests: {}, agenda: {}, check: {}, peso: {}, entrenos: {} });
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
const fechaMedia = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
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

// ---------- agenda: qué sesión toca cada día (con cambios) ----------
const lunesDe = (d) => addDays(d, -((d.getDay() + 6) % 7));
const diasSemana = (d) => { const l = lunesDe(d); return ORDEN.map((_, k) => addDays(l, k)); };
const claveDefecto = (d) => P.semana[d.getDay()];
const claveDe = (d) => DB.agenda[iso(d)] || claveDefecto(d);
const movido = (d) => claveDe(d) !== claveDefecto(d);
const titulo = (k) => P.sesiones[k].titulo;
const prio = (k) => P.sesiones[k].prioridad || 0;
const pesada = (d) => !!P.sesiones[claveDe(d)].pesada;
const diaNombre = (d) => DIAS[d.getDay()].toLowerCase();
const hechoEl = (d) => Object.values(DB.logs[iso(d)] || {}).some((e) => (e.d || []).some(Boolean));

// Hoy hice "nueva" en vez de lo planeado: intercambia con el día de "nueva" si viene
// más adelante en la semana; si no, la sesión perdida pisa un día de menor prioridad.
function cambiarDia(d, nueva) {
  const dISO = iso(d);
  const vieja = claveDe(d);
  if (nueva === vieja) return '';
  const futuros = diasSemana(d).filter((f) => iso(f) > dISO);
  DB.agenda[dISO] = nueva;
  let msg = '';
  const slot = futuros.find((f) => claveDe(f) === nueva);
  if (slot) {
    DB.agenda[iso(slot)] = vieja;
    msg = `${titulo(vieja)} pasó al ${diaNombre(slot)}.`;
  } else if (prio(vieja) > 0) {
    const libre = futuros
      .filter((f) => prio(claveDe(f)) > 0 && prio(claveDe(f)) < prio(vieja))
      .sort((a, b) => prio(claveDe(a)) - prio(claveDe(b)))[0];
    if (libre) {
      const pisada = claveDe(libre);
      DB.agenda[iso(libre)] = vieja;
      msg = `${titulo(vieja)} pasó al ${diaNombre(libre)}, en lugar de ${titulo(pisada)}.`;
    } else {
      msg = `${titulo(vieja)} queda salteada esta semana.`;
    }
  }
  save();
  return msg;
}
function moverDia(a, b) {
  const ka = claveDe(a);
  const kb = claveDe(b);
  DB.agenda[iso(a)] = kb;
  DB.agenda[iso(b)] = ka;
  save();
}
function restaurarSemana(d) {
  diasSemana(d).forEach((f) => { delete DB.agenda[iso(f)]; });
  save();
}
// Solo avisa si los dos días fuertes seguidos salen de un cambio tuyo, no del plan original.
function avisoSeguidos(d) {
  if (!pesada(d)) return '';
  const man = addDays(d, 1);
  const ayer = addDays(d, -1);
  if (pesada(man) && (movido(d) || movido(man))) return `Mañana también es día fuerte (${titulo(claveDe(man))}).`;
  if (pesada(ayer) && (movido(d) || movido(ayer))) return `Ayer también fue día fuerte (${titulo(claveDe(ayer))}).`;
  return '';
}

// ---------- sesión del día ----------
let lugarSel = null; // gym o casa, elegido antes de empezar
const lugarDe = (dISO) => DB.entrenos[dISO]?.lugar || lugarSel || 'gym';

function armarSesion(d, lugar = lugarDe(iso(d))) {
  const dISO = iso(d);
  const E = estado(dISO);
  const clave = claveDe(d);
  const s = P.sesiones[clave];
  const casa = lugar === 'casa';
  const mitad = E.descarga || (E.fase === 'plan' && E.b.volumenBajo);
  // En casa los pesos van aparte del gimnasio (otras mancuernas, otra progresión).
  const listo = (x) => Object.assign(x, { logId: casa && !x.sinPeso ? `${x.id}@casa` : x.id, enCasa: casa });
  const items = [];
  if (s.movilidadEntrada) {
    items.push(listo({
      id: 'mov-entrada', nombre: 'Movilidad de entrada', series: 1, texto: '5–8 min', sinPeso: true, fijo: true,
      lista: P.movilidadEntrada.map((id) => P.movilidad.find((m) => m.id === id)).filter(Boolean),
    }));
  }
  for (const it of s.items) {
    if (it.seccion) { items.push(it); continue; }
    if (it.intervalos) {
      (E.descarga ? P.viernesDescarga : E.b.intervalos).forEach((x) => items.push(listo({
        sinPeso: true, fijo: true, ...x, ...(casa && !E.descarga ? { nota: P.casa.notaIntervalos } : {}),
      })));
      continue;
    }
    if (it.movilidadCompleta) {
      P.movilidad.forEach((m) => items.push(listo({ id: 'mov-' + m.id, nombre: m.nombre, series: 1, texto: m.dosis, sinPeso: true, fijo: true })));
      continue;
    }
    let x = { ...it, ...((E.b.ajustes || {})[it.id] || {}) };
    if (casa && it.casa) x = { ...x, ...it.casa, reemplaza: it.nombre };
    delete x.casa;
    if (mitad && !x.fijo && x.series > 1) x.series = Math.ceil(x.series / 2);
    items.push(listo(x));
  }
  return { s, E, items, dISO, clave, lugar };
}
const ejerciciosDe = (S) => S.items.filter((x) => !x.seccion);

const fmtDesc = (x) => x.descansoTxt || (!x.descanso ? '' : x.descanso < 120 ? `${x.descanso} s` : `${fmt(x.descanso / 60)} min`);
const tecDe = (x) => { const T = P.tecnica || {}; return T[x.tec] || T[x.id] || T[String(x.id).replace(/^mov-/, '')]; };
function tecHTML(t) {
  const q = encodeURIComponent(t.video || '');
  return `<ol class="pasos">${t.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`
    + (t.error ? `<p class="error">⚠︎ Error típico: ${esc(t.error)}</p>` : '')
    + (t.video ? `<a class="video" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ Ver video</a>` : '');
}
const dosis = (x) => (x.texto || '{s} × {r}').replace('{s}', x.series).replace('{r}', x.reps ?? '');
function listaHTML(x) {
  return `<ul class="lista">${x.lista.map((m) => {
    const t = tecDe(m);
    return t ? `<li><details><summary>${esc(m.nombre)} <span class="info">ⓘ</span><span class="ds">${esc(m.dosis)}</span></summary><div class="tec">${tecHTML(t)}</div></details></li>`
             : `<li><span>${esc(m.nombre)}</span> <span class="ds">${esc(m.dosis)}</span></li>`;
  }).join('')}</ul>`;
}

// ---------- registros y progresión ----------
const numerosReps = (x) => String(x.reps ?? '').match(/\d+/g);
const topeReps = (x) => { const m = numerosReps(x); return m ? +m[m.length - 1] : null; };
const usaReps = (x) => !x.sinPeso && !x.fijo && topeReps(x) != null;
const kAt = (e, i) => e?.k?.[i] || e?.w || '';
function pesoMax(e) {
  const v = rango(e?.n || (e?.k || []).length).map((i) => num(kAt(e, i))).filter((n) => n != null);
  return v.length ? Math.max(...v) : num(e?.w);
}
function completo(x, dISO) {
  const e = DB.logs[dISO]?.[x.logId];
  return rango(x.series || 1).every((i) => e?.d?.[i]);
}

function ultimaSesion(logId, antesDe) {
  const fechas = Object.keys(DB.logs).filter((f) => f < antesDe).sort().reverse();
  for (const f of fechas) {
    const e = DB.logs[f]?.[logId];
    if (e && (e.w || (e.d || []).some(Boolean))) return { ...e, f };
  }
  return null;
}

// Si en "u" completaste el tope de reps en todas las series con el mismo peso, sugiere subir.
function evaluarSubida(x, u) {
  if (!usaReps(x) || !u || !u.n || !u.t) return null;
  const w = pesoMax(u);
  if (w == null) return null;
  const ok = rango(u.n).every((i) => u.d?.[i] && (u.r?.[i] || 0) >= u.t && (num(kAt(u, i)) ?? 0) >= w);
  if (!ok) return null;
  if (x.enCasa) {
    const sig = P.casa.mancuernas.find((m) => m > w);
    return sig ? { w: fmt(sig), antes: fmt(w) } : { txt: 'Ya estás en tu mancuerna más pesada: sumá 2 reps o bajá en 3 s.' };
  }
  return { w: fmt(w + (x.piernas ? 5 : 2.5)), antes: fmt(w) };
}
const sugerencia = (x, dISO) => (estado(dISO).descarga ? null : evaluarSubida(x, ultimaSesion(x.logId, dISO)));

function chipBloque(E) {
  if (E.fase === 'antes') return `Arranca el ${fechaCorta(P.bloques[0].desde)}`;
  if (E.fase === 'despues') return 'Plan terminado 🎉';
  return `${esc(E.b.etiqueta.replace('Bloque ', 'B'))} · sem ${E.semana}`;
}

// ---------- recuperación (check de la mañana) ----------
const CHECK = [
  { id: 'sueno', t: 'Sueño', ops: ['Mal', 'Normal', 'Bien'] },
  { id: 'energia', t: 'Energía', ops: ['Baja', 'Normal', 'Alta'] },
  { id: 'mareo', t: 'Mareo o síntomas', ops: ['Sí', 'Algo', 'Nada'] },
];
function puntaje(c) {
  if (!c || CHECK.some((q) => c[q.id] == null)) return null;
  let p = Math.round(((c.sueno + c.energia + c.mareo) / 6) * 100);
  if (c.mareo === 0) p = Math.min(p, 30); // con mareo, nunca verde
  return p;
}
const zona = (p) => (p == null ? null : p >= 67 ? 'verde' : p >= 34 ? 'amarillo' : 'rojo');
const COLOR = { verde: 'var(--ok)', amarillo: 'var(--warn)', rojo: 'var(--bad)' };
const RECO = {
  verde: 'Estás para entrenar normal.',
  amarillo: 'Primera ronda al 70 % y escuchá el cuerpo. Si no levanta, sacá una serie por ejercicio.',
  rojo: 'Hoy mejor zona 2 suave o descanso. Si el mareo sigue, consultá al médico.',
};
let editarCheck = false;

function dial(frac, color, centro, label, accion) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, frac)) * c;
  return `<button type="button" class="dial" ${accion}>
    <svg viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="${r}" class="dial-bg"/>${len > 0 ? `<circle cx="37" cy="37" r="${r}" class="dial-fg" style="stroke:${color}" stroke-dasharray="${len} ${c}" transform="rotate(-90 37 37)"/>` : ''}
    <text x="37" y="44" text-anchor="middle" class="dial-n">${centro}</text></svg>
    <span class="k">${label}</span></button>`;
}

// ---------- pantalla: INICIO ----------
function vistaInicio() {
  const d = hoy();
  const dISO = iso(d);
  const S = armarSesion(d);
  const { s, E, clave } = S;
  const ent = DB.entrenos[dISO];
  const ejercicios = ejerciciosDe(S);
  const hechos = ejercicios.filter((x) => completo(x, dISO)).length;
  const c = DB.check[dISO];
  const p = puntaje(c);
  const z = zona(p);
  const prot = (DB.prot[dISO] || []).reduce((a, b) => a + b, 0);
  const meta = P.nutricion.proteinaMeta;

  let h = `<header class="ini-top"><span class="k fuerte">Hoy · ${esc(fechaMedia(d))}</span><span class="k">${chipBloque(E)}</span></header>`;

  if (p == null || editarCheck) {
    h += `<section class="c check"><p class="k">¿Cómo llegás hoy?</p>${CHECK.map((q) => `<div class="q"><span>${q.t}</span><div class="ops">${q.ops.map((o, v) => `<button type="button" class="op${c?.[q.id] === v ? ' on' : ''}" data-check="${q.id}" data-v="${v}">${o}</button>`).join('')}</div></div>`).join('')}</section>`;
  }

  h += `<div class="diales">
    ${dial(p == null ? 0 : p / 100, z ? COLOR[z] : 'var(--line)', p == null ? '—' : `${p}%`, 'Recuperación', 'data-accion="check"')}
    ${dial(ejercicios.length ? hechos / ejercicios.length : 0, 'var(--acc)', `${hechos}/${ejercicios.length}`, 'Sesión', '')}
    ${dial(prot / meta, 'var(--prot)', `${prot}g`, 'Proteína', 'data-tab="nutri"')}
  </div>`;

  if (z) {
    h += `<p class="reco" style="--z:${COLOR[z]}">${esc(RECO[z])}</p>`;
    if (z === 'rojo' && !['z2', 'domingo'].includes(clave) && !ent?.inicio) h += '<button type="button" class="link" data-sesion="z2">Cambiar hoy por zona 2 →</button>';
  }

  h += avisoUnico(d, E, clave);
  h += tarjetaSesion(S, ent, hechos, ejercicios.length);
  h += tiraSemana(d);
  h += tarjetaPeso(dISO);
  return h;
}

// Un solo aviso a la vez: el más importante.
function avisoUnico(d, E, clave) {
  const dISO = iso(d);
  const t = P.tests.fechas.find((x) => dISO >= x.fecha && dISO <= iso(addDays(parseISO(x.fecha), 6)));
  const bajos = rango(7).map((i) => puntaje(DB.check[iso(addDays(d, -i))])).filter((p) => p != null && p < 50).length;
  let a = null;
  if (E.fase === 'antes') a = `El plan arranca el ${fechaCorta(P.bloques[0].desde)}.`;
  else if (E.descarga) a = `<b>Semana de descarga:</b> la mitad de las series${clave === 'viernes' ? ' y hoy zona 2 en vez de intervalos' : ''}.`;
  else if (E.fase === 'plan' && E.b.volumenBajo) a = esc(E.b.aviso);
  else if (t && !testCompleto(t.id)) a = `<button type="button" class="link" data-tab="progreso">📏 Semana de tests: cargalos en Progreso →</button>`;
  else if (avisoSeguidos(d)) a = `⚠︎ ${esc(avisoSeguidos(d))} Si llegás cargado, cambiá uno por zona 2.`;
  else if (bajos >= 3) a = 'Venís con varios días de recuperación baja: considerá adelantar la descarga.';
  return a ? `<div class="aviso">${a}</div>` : '';
}

function tarjetaSesion(S, ent, hechos, total) {
  const { s, clave, lugar, dISO } = S;
  const d = parseISO(dISO);
  const entrena = s.tipo === 'fuerza' || s.tipo === 'cardio';
  const tieneCasa = s.items.some((it) => it.casa) || clave === 'viernes';
  let h = `<section class="c sesion">
    <div class="fila-k"><span class="k">Sesión de hoy${movido(d) ? ' · movida' : ''}</span>${ent?.inicio ? `<span class="k">${lugar === 'casa' ? '🏠 Casa' : '🏋️ Gimnasio'}</span>` : ''}</div>
    <h2 class="big">${esc(s.titulo)}</h2>
    <p class="mut">${esc([s.duracion, total > 1 ? `${total} ejercicios` : s.sub].filter(Boolean).join(' · '))}</p>`;

  if (!ent?.inicio) {
    if (tieneCasa) {
      h += `<div class="segm">${[['gym', '🏋️ Gimnasio'], ['casa', '🏠 Casa']].map(([v, t]) => `<button type="button" class="${lugar === v ? 'on' : ''}" data-lugar="${v}">${t}</button>`).join('')}</div>`;
      if (lugar === 'casa') h += `<p class="mut chico">Con: ${esc(P.casa.equipo)}</p>`;
    }
    h += '<button type="button" class="primario" data-accion="empezar">Empezar</button>';
  } else if (!ent.fin) {
    h += `<button type="button" class="primario azul" data-accion="continuar">Continuar · ${hechos}/${total}</button>`;
  } else {
    h += `<p class="hecha">✓ Hecha · ${Math.max(1, Math.round((ent.fin - ent.inicio) / 60000))} min</p>
      <div class="dos"><button type="button" class="secund" data-accion="resumen">Ver resumen</button><button type="button" class="secund" data-accion="reabrir">Reabrir</button></div>`;
  }
  if (entrena && !ent?.fin) h += '<p class="seg">⚠︎ Primera ronda al 70 %</p>';

  h += `<div class="links">
      <button type="button" class="link" data-accion="verlista">Ver ejercicios</button>
      ${ent?.inicio ? '' : '<button type="button" class="link" data-accion="cambiar">Cambiar sesión</button>'}
    </div>
    <ul class="prev" id="prev" hidden>${S.items.map((x) => (x.seccion ? `<li class="k">${esc(x.seccion)}</li>` : `<li><span>${esc(x.nombre)}</span><span class="mut">${esc(dosis(x))}</span></li>`)).join('')}</ul>
    <div class="opciones" id="opciones" hidden>
      <p class="mut chico">¿Qué hiciste o vas a hacer hoy? La semana se reacomoda sola.</p>
      ${Object.keys(P.sesiones).filter((k) => k !== clave).map((k) => `<button type="button" class="secund" data-sesion="${k}">${esc(titulo(k))}</button>`).join('')}
    </div>
  </section>`;
  return h;
}

function tiraSemana(d) {
  const dISO = iso(d);
  return `<button type="button" class="c tira" data-tab="semana">
    <span class="fila-k"><span class="k">Semana</span><span class="k">Ver →</span></span>
    <span class="dias7">${diasSemana(d).map((f) => {
      const fISO = iso(f);
      const est = hechoEl(f) ? 'ok' : fISO === dISO ? 'hoy' : fISO < dISO ? 'pasado' : '';
      return `<span class="d7 ${est}"><span class="l">${DIAS[f.getDay()][0]}</span><span class="pt">${est === 'ok' ? '✓' : ''}</span><span class="s">${esc(P.sesiones[claveDe(f)].corto || '')}</span></span>`;
    }).join('')}</span>
  </button>`;
}

function tarjetaPeso(dISO) {
  const v = DB.peso[dISO] || '';
  const fechas = Object.keys(DB.peso).filter((f) => f < dISO && num(DB.peso[f]) != null).sort();
  const hace7 = iso(addDays(parseISO(dISO), -7));
  const ref = fechas.filter((f) => f <= hace7).pop() || fechas[0];
  const actual = num(v) ?? num(DB.peso[fechas[fechas.length - 1]]);
  let delta = '';
  if (ref && actual != null && num(DB.peso[ref]) != null) {
    const dl = actual - num(DB.peso[ref]);
    delta = `<span class="delta ${dl <= 0 ? 'baja' : 'sube'}">${dl <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dl))} <small>desde ${fechaCorta(ref)}</small></span>`;
  }
  return `<section class="c fila-peso">
    <span class="k">Peso en ayunas</span>
    <span class="peso-der">${delta}<label class="kg-box chico"><input id="peso-hoy" type="text" inputmode="decimal" autocomplete="off" value="${esc(v)}" placeholder="—" aria-label="Peso de hoy"><span>kg</span></label></span>
  </section>`;
}

// ---------- pantalla: ENTRENANDO ----------
function vistaEntreno() {
  const d = hoy();
  const dISO = iso(d);
  const ent = DB.entrenos[dISO];
  const S = armarSesion(d);
  const ejercicios = ejerciciosDe(S);
  const hechos = ejercicios.filter((x) => completo(x, dISO)).length;
  let actual = ejercicios.find((x) => x.logId === ent.actual);
  if (!actual) actual = ejercicios.find((x) => !completo(x, dISO));

  let h = `<header class="en-top">
      <button type="button" class="icono" data-accion="salir" aria-label="Volver al inicio">✕</button>
      <span class="big reloj" id="reloj">${reloj(ent.inicio)}</span>
      <span class="k azul">${hechos}/${ejercicios.length}</span>
    </header>
    <div class="barra"><span style="width:${ejercicios.length ? (hechos / ejercicios.length) * 100 : 0}%"></span></div>
    <p class="en-sub">${esc(S.s.titulo)}${S.lugar === 'casa' ? ' · 🏠 Casa' : ''}${S.s.tipo !== 'descanso' ? ' · <span class="warn">primera ronda al 70 %</span>' : ''}</p>`;

  for (const x of S.items) {
    if (x.seccion) { h += `<p class="k sec">${esc(x.seccion)}</p>`; continue; }
    if (actual && x.logId === actual.logId) h += bloqueActual(x, dISO);
    else if (completo(x, dISO)) h += `<button type="button" class="fila hecha" data-ir="${esc(x.logId)}"><span>✓ ${esc(x.nombre)}</span><span class="mut">${esc(resumenHecho(x, dISO))}</span></button>`;
    else h += `<button type="button" class="fila" data-ir="${esc(x.logId)}"><span>${esc(x.nombre)}</span><span class="mut">${esc(dosis(x))}</span></button>`;
  }
  if (!actual) h += '<p class="todo-ok">Completaste todo. ¡Bien ahí!</p>';
  h += `<button type="button" class="primario${actual ? ' gris' : ''}" data-accion="terminar">Terminar</button>`;
  return h;
}

function resumenHecho(x, dISO) {
  const e = DB.logs[dISO]?.[x.logId];
  if (x.sinPeso || !e) return dosis(x);
  const w = pesoMax(e);
  return w != null ? `${x.series} × ${fmt(w)} kg` : dosis(x);
}

function bloqueActual(x, dISO) {
  const e = DB.logs[dISO]?.[x.logId] || {};
  const u = x.sinPeso ? null : ultimaSesion(x.logId, dISO);
  const sug = x.sinPeso ? null : sugerencia(x, dISO);
  const tec = tecDe(x);
  const n = x.series || 1;
  const desc = fmtDesc(x);
  const meta = [desc && `⏱ ${esc(desc)}`, x.nota && esc(x.nota), x.reemplaza && `en lugar de ${esc(x.reemplaza)}`].filter(Boolean).join(' · ');

  let h = `<article class="actual" id="actual" data-id="${esc(x.logId)}" data-n="${n}" data-rest="${x.descanso || 0}" data-tope="${usaReps(x) ? topeReps(x) : ''}" data-nombre="${esc(x.nombre)}">
    <div class="ej-top"><h3>${tec ? `<button type="button" class="nombre" aria-expanded="false">${esc(x.nombre)} <span class="info">ⓘ</span></button>` : esc(x.nombre)}</h3><span class="dosis">${esc(dosis(x))}</span></div>
    ${meta ? `<p class="meta">${meta}</p>` : ''}
    ${tec ? `<div class="tec" hidden>${tecHTML(tec)}</div>` : ''}
    ${x.lista ? listaHTML(x) : ''}`;
  if (sug) h += `<p class="sube">⬆︎ ${sug.w ? `Hoy subí a <b>${esc(sug.w)} kg</b> <small>(antes ${esc(sug.antes)})</small>` : esc(sug.txt)}</p>`;

  if (!x.sinPeso) {
    h += '<div class="tabla"><div class="fila-h"><span>#</span><span>Anterior</span><span>kg</span><span>Reps</span><span></span></div>';
    for (const i of rango(n)) {
      const ant = u && (u.d?.[i] || u.k?.[i]) ? `${kAt(u, i) || '–'} × ${u.r?.[i] || '–'}` : '—';
      const phK = e.k?.[i - 1] || sug?.w || kAt(u, i) || '';
      const phR = u?.r?.[i] || topeReps(x) || '';
      h += `<div class="serie${e.d?.[i] ? ' on' : ''}" data-i="${i}">
        <span class="n">${i + 1}</span><span class="ant">${esc(ant)}</span>
        <input class="in-kg" type="text" inputmode="decimal" autocomplete="off" value="${esc(e.k?.[i] || '')}" placeholder="${esc(phK)}" aria-label="Kilos serie ${i + 1}">
        <input class="in-reps" type="text" inputmode="numeric" autocomplete="off" value="${esc(e.r?.[i] || '')}" placeholder="${esc(phR)}" aria-label="Reps serie ${i + 1}">
        <button type="button" class="ck${e.d?.[i] ? ' on' : ''}" aria-label="Serie ${i + 1} hecha">✓</button></div>`;
    }
    h += '</div>';
  } else {
    h += '<div class="tabla">';
    for (const i of rango(n)) {
      const obj = n === 1 ? (x.lista ? 'Hecho' : dosis(x)) : x.reps ? `${x.reps} reps` : `${i + 1} de ${n}`;
      h += `<div class="serie simple${e.d?.[i] ? ' on' : ''}" data-i="${i}"><span class="n">${n === 1 ? '' : i + 1}</span><span class="ant">${esc(obj)}</span>
        <button type="button" class="ck${e.d?.[i] ? ' on' : ''}" aria-label="Hecho">✓</button></div>`;
    }
    h += '</div>';
  }
  return h + '</article>';
}

const reloj = (t0) => { const s = Math.max(0, Math.floor((Date.now() - t0) / 1000)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };

// ---------- pantalla: RESUMEN ----------
function vistaResumen() {
  const d = hoy();
  const dISO = iso(d);
  const ent = DB.entrenos[dISO];
  const S = armarSesion(d);
  const ejercicios = ejerciciosDe(S);
  let series = 0;
  let volumen = 0;
  for (const x of ejercicios) {
    const e = DB.logs[dISO]?.[x.logId];
    rango(x.series || 1).forEach((i) => {
      if (!e?.d?.[i]) return;
      series++;
      if (!x.sinPeso) volumen += (num(kAt(e, i)) || 0) * (e.r?.[i] || 0);
    });
  }
  const subir = ejercicios.map((x) => ({ x, s: evaluarSubida(x, DB.logs[dISO]?.[x.logId]) })).filter((o) => o.s);
  const faltan = ejercicios.filter((x) => !completo(x, dISO));
  const min = Math.max(1, Math.round(((ent.fin || Date.now()) - ent.inicio) / 60000));

  let h = `<header class="ini-top"><span class="k fuerte">Sesión hecha</span><span class="k">${esc(fechaMedia(d))}</span></header>
    <h1 class="big titulo-res">${esc(S.s.titulo)}</h1>
    <div class="stats">
      <div class="c stat"><span class="big">${min}</span><span class="k">min</span></div>
      <div class="c stat"><span class="big">${series}</span><span class="k">series</span></div>
      <div class="c stat"><span class="big">${volumen ? fmt(volumen, 0) : '—'}</span><span class="k">kg totales</span></div>
    </div>`;
  if (S.s.tipo === 'cardio' || S.s.pesada) h += '<div class="aviso">Caminá 3–5 min antes de parar. Nunca de golpe.</div>';
  if (subir.length) {
    h += `<section class="c"><p class="k">Para la próxima</p><ul class="res-lista">${subir.map(({ x, s }) => `<li><span>${esc(x.nombre)}</span><span class="ok-t">${s.w ? `⬆︎ ${esc(s.w)} kg` : '⬆︎ +2 reps'}</span></li>`).join('')}</ul></section>`;
  }
  if (faltan.length) {
    h += `<section class="c"><p class="k">Quedaron sin hacer</p><ul class="res-lista">${faltan.map((x) => `<li><span>${esc(x.nombre)}</span></li>`).join('')}</ul><p class="mut chico">No los recuperes: seguí con el plan.</p></section>`;
  }
  h += '<button type="button" class="primario" data-tab="inicio">Volver al inicio</button>';
  return h;
}

// ---------- pantalla: SEMANA ----------
let diaAbierto = null;
function cardVer(x, dISO) {
  if (x.seccion) return `<h3 class="seccion">${esc(x.seccion)}</h3>`;
  const tec = tecDe(x);
  const desc = fmtDesc(x);
  const meta = [desc && `⏱ ${esc(desc)}`, x.nota && esc(x.nota)].filter(Boolean).join(' · ');
  const u = x.sinPeso ? null : ultimaSesion(x.logId, dISO);
  const w = u ? pesoMax(u) : null;
  return `<article class="ej">
    <div class="ej-top"><h3>${tec ? `<button type="button" class="nombre" aria-expanded="false">${esc(x.nombre)} <span class="info">ⓘ</span></button>` : esc(x.nombre)}</h3><span class="dosis">${esc(dosis(x))}</span></div>
    ${meta ? `<p class="meta">${meta}</p>` : ''}
    ${tec ? `<div class="tec" hidden>${tecHTML(tec)}</div>` : ''}
    ${x.lista ? listaHTML(x) : ''}
    ${w != null ? `<p class="meta">Última vez: <b>${fmt(w)} kg</b> (${fechaCorta(u.f)})</p>` : ''}
  </article>`;
}

function vistaSemana() {
  const d = hoy();
  const E = estado(iso(d));
  let h = `<header class="top"><h1 class="big">Semana</h1><p class="chip">${chipBloque(E)}</p></header>`;
  if (E.descarga) h += '<div class="aviso"><b>Semana de descarga:</b> la mitad de las series y el viernes zona 2.</div>';

  const dias = diasSemana(d);
  if (dias.some(movido)) h += '<button type="button" class="cambiar" data-accion="restaurar">↺ Volver la semana al orden original</button>';

  dias.forEach((f) => {
    const dia = f.getDay();
    const S = armarSesion(f);
    const esHoy = iso(f) === iso(d);
    const prevD = addDays(f, -1);
    const seguidos = pesada(f) && pesada(prevD) && (movido(f) || movido(prevD));
    h += `<details class="dia${esHoy ? ' hoy' : ''}${iso(f) < iso(d) ? ' pasado' : ''}" data-dia="${dia}"${diaAbierto === dia ? ' open' : ''}>
      <summary>
        <span class="dn">${DIAS[dia]}${esHoy ? ' <em>hoy</em>' : ''}${hechoEl(f) ? ' <span class="tag ok">✓</span>' : ''}${movido(f) ? ' <span class="tag">movido</span>' : ''}</span>
        <span class="dt">${esc(S.s.titulo)}${seguidos ? ' <span class="warn">⚠︎ 2 días fuertes seguidos</span>' : ''}</span>
        <span class="dd">${esc(S.s.duracion || '')}</span>
      </summary>
      <div class="dia-body">
        <div class="mover"><span class="meta">Mover a:</span>${dias.filter((g) => g !== f).map((g) => `<button type="button" data-mover="${iso(f)}|${iso(g)}">${DIAS[g.getDay()].slice(0, 3)}</button>`).join('')}</div>
        ${S.s.sub ? `<p class="meta">${esc(S.s.sub)}</p>` : ''}${S.items.map((x) => cardVer(x, S.dISO)).join('')}
      </div>
    </details>`;
  });

  h += '<h2>Bloques</h2>';
  h += P.bloques.map((b) => `<div class="card bloque${b === E.b && E.fase === 'plan' ? ' actual-b' : ''}">
      <h3>${esc(b.etiqueta)}</h3>
      <p class="meta">${fechaCorta(b.desde)} – ${fechaCorta(b.hasta)}${b.descarga ? ` · descarga ${fechaCorta(b.descarga.desde)}–${fechaCorta(b.descarga.hasta)}` : ''}</p>
      <p><b>Fuerza:</b> ${esc(b.fuerza)}</p>
      <p><b>Viernes:</b> ${esc(b.viernesTxt)}</p>
      <p><b>Comida:</b> ${esc(b.comida)}</p>
    </div>`).join('');
  h += `<section class="card"><h3>Reglas de ajuste</h3><ul class="reglas">${P.reglas.ajuste.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  h += `<section class="card seguridad"><h3>Seguridad (disautonomía)</h3><ul class="reglas">${P.reglas.seguridad.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  h += `<section class="card"><h3>Progresión</h3><p>${esc(P.reglas.progresion)}</p></section>`;
  return h;
}

// ---------- pantalla: COMIDA ----------
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

  let h = `<header class="top"><h1 class="big">Comida</h1><p class="chip">${chipBloque(E)}</p></header>`;

  h += `<section class="card prot">
    <div class="prot-top"><span class="k">Proteína de hoy</span><p class="prot-n"><b class="big">${total}</b> / ${meta} g</p></div>
    <div class="bar${total >= meta ? ' llena' : ''}"><span style="width:${pct}%"></span></div>
    <p class="meta">${total >= meta ? 'Llegaste a la meta.' : `Te faltan ${falta} g.${falta >= 25 ? ' Si no llegás: whey 25 g.' : ''}`}</p>
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
        <div class="tile"><b class="big">${fmt(m.kcal, 0)}</b><span>kcal</span></div>
        <div class="tile"><b class="big">${m.prot} g</b><span>proteína</span></div>
        <div class="tile"><b class="big">~${m.grasa} g</b><span>grasa</span></div>
        <div class="tile"><b class="big">~${m.carbs} g</b><span>carbos</span></div>
      </div>
      <p class="meta">${esc(N.objetivo)}</p></section>`;
  } else {
    h += `<section class="card"><h3>Macros · ${esc(E.b.etiqueta)}</h3><p>${esc(N.mantenimiento)}</p></section>`;
  }

  const sinCarbCena = ['z2', 'domingo'].includes(claveDe(d));
  h += `<details class="card plegable"><summary><h3>Día tipo</h3></summary>
    ${sinCarbCena ? `<p class="aviso mini">Hoy es día liviano (${esc(titulo(claveDe(d)))}): sin papa ni arroz en la cena.</p>` : ''}
    <ul class="comidas-lista">${N.diaTipo.map((c) => `<li><div><b>${esc(c.comida)}</b><p>${esc(c.detalle)}</p></div><span>~${c.prot} g</span></li>`).join('')}</ul>
    <ul class="reglas">${N.notasDia.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;

  let avisoAlcohol = '';
  const manana = claveDe(addDays(d, 1));
  if (['piernas', 'viernes'].includes(manana)) avisoAlcohol = `<p class="aviso mini">Hoy no hay salida: mañana tenés ${esc(titulo(manana))}.</p>`;
  else if (d.getMonth() === 11) avisoAlcohol = '<p class="aviso mini">Diciembre: lo mínimo posible.</p>';
  h += `<details class="card plegable"${avisoAlcohol ? ' open' : ''}><summary><h3>Alcohol y comida libre</h3></summary>${avisoAlcohol}
    <ul class="reglas">${N.alcohol.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;

  h += `<details class="card plegable"><summary><h3>Todos los días y suplementos</h3></summary><ul class="reglas">${N.otros.concat(N.suplementos).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
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

  let h = '<header class="top"><h1 class="big">Progreso</h1><p class="sub">Tests cada 4 semanas</p></header>';

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
  h += `<button type="button" class="check-foto${t.foto ? ' on' : ''}" data-accion="foto">${t.foto ? '✓' : '○'} Foto de frente y de costado <small>(la foto queda en tu galería, no en la app)</small></button></section>`;

  h += `<section class="card"><h3>Evolución</h3>
    <div class="segmentos chico">${P.tests.campos.map((c) => `<button type="button" class="${c.id === campoSel ? 'on' : ''}" data-campo="${c.id}">${esc(c.nombre)}</button>`).join('')}</div>
    <div id="grafico">${grafico(campoSel)}</div></section>`;

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
let tab = 'inicio';
let fechaRender = '';
let relojInt = null;
const VISTAS = { inicio: vistaInicio, entreno: vistaEntreno, resumen: vistaResumen, semana: vistaSemana, nutri: vistaNutri, progreso: vistaProgreso };

function render(nuevo, mantenerScroll) {
  if (nuevo) tab = nuevo;
  const y = window.scrollY;
  $('#view').innerHTML = VISTAS[tab]();
  fechaRender = iso(hoy());
  const enSesion = tab === 'entreno' || tab === 'resumen';
  document.body.classList.toggle('modo-entreno', enSesion);
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  clearInterval(relojInt);
  if (tab === 'entreno') {
    const t0 = DB.entrenos[iso(hoy())]?.inicio;
    relojInt = setInterval(() => { const r = $('#reloj'); if (r && t0) r.textContent = reloj(t0); }, 1000);
    pedirWakeLock();
  } else if (!T.int) {
    soltarWakeLock();
  }
  window.scrollTo(0, mantenerScroll ? y : 0);
}
function irAlActual() {
  const a = $('#actual');
  if (a) window.scrollTo({ top: a.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
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
  if (tab !== 'entreno') soltarWakeLock();
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
  const blob = new Blob([JSON.stringify({ app: 'entreno', version: 2, fecha: new Date().toISOString(), datos: DB }, null, 2)], { type: 'application/json' });
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
      render('inicio');
    } catch (e) { toast('Ese archivo no es un backup válido'); }
  };
  r.readAsText(file);
}

// ---------- eventos ----------
function logDe(art) {
  const log = (DB.logs[iso(hoy())] ||= {});
  const e = (log[art.dataset.id] ||= { w: '', d: [] });
  e.n = +art.dataset.n;
  if (art.dataset.tope) e.t = +art.dataset.tope;
  return e;
}
function actualizarW(e) { const w = pesoMax(e); e.w = w != null ? fmt(w) : ''; }

function tildarSerie(btn) {
  unlockAudio();
  const art = btn.closest('#actual');
  const fila = btn.closest('.serie');
  const i = +fila.dataset.i;
  const e = logDe(art);
  const dISO = iso(hoy());
  if (e.d[i]) {
    e.d[i] = false;
    save();
    return render('entreno', true);
  }
  // Si no escribiste nada, toma lo sugerido (lo que se ve en gris).
  const inK = fila.querySelector('.in-kg');
  const inR = fila.querySelector('.in-reps');
  if (inK) { const v = (inK.value.trim() || inK.placeholder).replace('.', ','); if (v) (e.k ||= [])[i] = v; }
  if (inR) { const v = num(inR.value.trim() || inR.placeholder); if (v != null) (e.r ||= [])[i] = v; }
  e.d[i] = true;
  actualizarW(e);
  const ent = DB.entrenos[dISO];
  const n = +art.dataset.n;
  const termino = rango(n).every((k) => e.d[k]);
  if (termino) {
    const S = armarSesion(hoy());
    const ejs = ejerciciosDe(S);
    const idx = ejs.findIndex((x) => x.logId === art.dataset.id);
    const sig = ejs.slice(idx + 1).concat(ejs.slice(0, idx)).find((x) => !completo(x, dISO));
    ent.actual = sig ? sig.logId : null;
  } else {
    ent.actual = art.dataset.id;
  }
  save();
  const rest = +art.dataset.rest;
  if (rest) startTimer(rest, art.dataset.nombre);
  try { navigator.vibrate && navigator.vibrate(termino ? [20, 60, 20] : 15); } catch (x) { /* nada */ }
  render('entreno', true);
  if (termino) irAlActual();
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button, summary');
  if (!el) return;
  const dISO = iso(hoy());

  if (el.dataset.tab) { editarCheck = false; return render(el.dataset.tab); }

  // técnica del ejercicio
  if (el.classList.contains('nombre')) {
    const tec = el.closest('article').querySelector(':scope > .tec');
    tec.hidden = !tec.hidden;
    el.setAttribute('aria-expanded', String(!tec.hidden));
    return;
  }

  if (el.dataset.timer === 'mas') { T.end += 15000; T.total += 15; return tick(); }
  if (el.dataset.timer === 'fin') { clearTimeout(T.finTimeout); return finTimer(false); }

  if (el.classList.contains('ck')) return tildarSerie(el);
  if (el.dataset.ir) {
    DB.entrenos[dISO].actual = el.dataset.ir;
    save();
    render('entreno', true);
    return irAlActual();
  }

  if (el.dataset.check) {
    const c = (DB.check[dISO] ||= {});
    c[el.dataset.check] = +el.dataset.v;
    save();
    if (puntaje(c) != null) editarCheck = false;
    return render('inicio', true);
  }
  if (el.dataset.lugar) { lugarSel = el.dataset.lugar; return render('inicio', true); }

  if (el.dataset.prot) {
    (DB.prot[dISO] ||= []).push(+el.dataset.prot);
    save();
    return render('nutri', true);
  }

  if (el.dataset.test) { testSel = el.dataset.test; return render('progreso', true); }
  if (el.dataset.campo) { campoSel = el.dataset.campo; return render('progreso', true); }

  if (el.dataset.sesion) {
    const msg = cambiarDia(hoy(), el.dataset.sesion);
    render('inicio');
    toast(msg || 'Listo, cambiado');
    return;
  }
  if (el.dataset.mover) {
    const [a, b] = el.dataset.mover.split('|').map(parseISO);
    moverDia(a, b);
    diaAbierto = b.getDay();
    render('semana', true);
    toast(`Intercambiados ${diaNombre(a)} y ${diaNombre(b)}`);
    return;
  }

  const acc = el.dataset.accion;
  if (!acc) return;
  const ent = DB.entrenos[dISO];
  if (acc === 'check') { editarCheck = !editarCheck; return render('inicio', true); }
  if (acc === 'cambiar') { const o = $('#opciones'); o.hidden = !o.hidden; return; }
  if (acc === 'verlista') { const o = $('#prev'); o.hidden = !o.hidden; return; }
  if (acc === 'empezar') {
    unlockAudio();
    DB.entrenos[dISO] = { lugar: lugarDe(dISO), inicio: Date.now() };
    save();
    return render('entreno');
  }
  if (acc === 'continuar') { unlockAudio(); render('entreno'); return irAlActual(); }
  if (acc === 'salir') return render('inicio');
  if (acc === 'terminar') {
    if (ent) { ent.fin = Date.now(); save(); }
    return render('resumen');
  }
  if (acc === 'resumen') return render('resumen');
  if (acc === 'reabrir') { if (ent) { delete ent.fin; save(); } return render('entreno'); }
  if (acc === 'restaurar') { restaurarSemana(hoy()); render('semana', true); return toast('Semana restaurada'); }
  if (acc === 'deshacer') { (DB.prot[dISO] || []).pop(); save(); return render('nutri', true); }
  if (acc === 'crea') { DB.crea[dISO] = !DB.crea[dISO]; save(); return render('nutri', true); }
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
  if (el.classList.contains('in-kg') || el.classList.contains('in-reps')) {
    const art = el.closest('#actual');
    const i = +el.closest('.serie').dataset.i;
    const e = logDe(art);
    if (el.classList.contains('in-kg')) { (e.k ||= [])[i] = el.value.trim().replace('.', ','); actualizarW(e); }
    else (e.r ||= [])[i] = num(el.value);
    save();
    return;
  }
  if (el.id === 'peso-hoy') {
    DB.peso[iso(hoy())] = el.value.trim().replace('.', ',');
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
  if (ev.target.id === 'peso-hoy') render('inicio', true);
  if (ev.target.dataset.tc) $('#grafico').innerHTML = grafico(campoSel);
  if (ev.target.id === 'archivo' && ev.target.files[0]) importar(ev.target.files[0]);
});

// Si la app quedó abierta de un día para el otro, refresca
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (T.int) { tick(); pedirWakeLock(); }
  if (tab === 'entreno') pedirWakeLock();
  if (iso(hoy()) !== fechaRender) render(tab === 'entreno' || tab === 'resumen' ? 'inicio' : tab);
});

// Al abrir: si quedó un entrenamiento a medias hoy, vuelve directo a él.
const entHoy = DB.entrenos[iso(hoy())];
render(entHoy?.inicio && !entHoy.fin ? 'entreno' : 'inicio');
if (tab === 'entreno') irAlActual();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
