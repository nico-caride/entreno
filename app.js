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
const blank = () => ({ logs: {}, prot: {}, crea: {}, tests: {}, agenda: {}, fijos: {}, check: {}, peso: {}, entrenos: {}, comida: {}, misAli: [], aliEdit: {}, salud: {}, garmin: { padel: [], ignorados: [] } });
// ?demo=1 carga datos de ejemplo en memoria y no guarda nada (para probar sin tocar datos reales).
const DEMO = new URLSearchParams(location.search).has('demo');
function load() {
  if (DEMO) return blank();
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return Object.assign(blank(), d);
  } catch (e) { /* sin datos */ }
  return blank();
}
let DB = load();
const VERSION = 15; // subirla junto con el ?v= de index.html
// Candado: si de golpe hay muchos menos registros que los guardados, no pisa los datos.
const cantidad = (d) => ['logs', 'comida', 'salud', 'peso', 'entrenos'].reduce((a, k) => a + Object.keys(d?.[k] || {}).length, 0);
let cantGuardada = cantidad(DB);
function save() {
  if (DEMO) return;
  const n = cantidad(DB);
  if (cantGuardada >= 10 && n < cantGuardada * 0.5) { toast('No guardé: parecía que se borraban muchos datos.'); return; }
  try {
    localStorage.setItem(KEY, JSON.stringify(DB));
    localStorage.setItem(`${KEY}.cambio`, String(Date.now()));
    cantGuardada = n;
  } catch (e) { toast('No se pudo guardar en el celular'); }
}
// Copia local completa cada vez que se abre una versión nueva de la app (antes de tocar nada).
(function respaldoLocal() {
  if (DEMO) return;
  try {
    const actual = localStorage.getItem(KEY);
    if (!actual || localStorage.getItem(`${KEY}.respaldo.version`) === String(VERSION)) return;
    localStorage.setItem(`${KEY}.respaldo`, actual);
    localStorage.setItem(`${KEY}.respaldo.version`, String(VERSION));
    localStorage.setItem(`${KEY}.respaldo.fecha`, new Date().toISOString());
  } catch (e) { /* sin espacio: seguimos igual */ }
}());

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

// ---------- reorganizar la semana ----------
// Un día está bloqueado si ya pasó, o si es hoy y ya entrenaste.
const bloqueado = (f) => {
  const hISO = iso(hoy());
  return iso(f) < hISO || (iso(f) === hISO && (!!DB.entrenos[hISO]?.inicio || hechoEl(f)));
};
const fijado = (f) => !!DB.fijos[iso(f)];
// Se puede cambiar lo que tiene un día (incluso uno que ya pasó, para registrar lo que hiciste),
// salvo hoy si ya empezaste a entrenar.
const editable = (f) => { const hISO = iso(hoy()); return !(iso(f) === hISO && DB.entrenos[hISO]?.inicio); };
const esFuerza = (k) => P.sesiones[k].tipo === 'fuerza';
const esPesada = (k) => !!P.sesiones[k].pesada;

// Puntaje de una semana (menos es mejor): evita días fuertes seguidos y fuerza
// pegada a fuerza, y cambia lo menos posible respecto de cómo estaba.
function puntuar(a, ref, ayer) {
  let s = 0;
  const seq = [ayer, ...a];
  for (let i = 1; i < seq.length; i++) {
    if (esPesada(seq[i]) && esPesada(seq[i - 1])) s += 10;
    if (esFuerza(seq[i]) && esFuerza(seq[i - 1])) s += 3;
  }
  a.forEach((k, i) => { if (k !== ref[i]) s += 1; });
  return s;
}
function permutaciones(arr, cb) {
  const usado = arr.map(() => false);
  const cur = [];
  const rec = () => {
    if (cur.length === arr.length) return cb(cur);
    const vistos = new Set();
    arr.forEach((k, i) => {
      if (usado[i] || vistos.has(k)) return;
      vistos.add(k); usado[i] = true; cur.push(k); rec(); cur.pop(); usado[i] = false;
    });
  };
  rec();
}

// Pone "clave" en el día "destino" (queda fijo) y reacomoda el resto de los días libres
// de la semana. "origen" es el día de donde se arrastró (se libera aunque estuviera fijo).
function reorganizar(destino, clave, origen) {
  const dias = diasSemana(destino);
  const antes = dias.map(claveDe);
  const dI = dias.findIndex((f) => iso(f) === iso(destino));
  const libres = [];
  const pool = [antes[dI]];
  dias.forEach((f, i) => {
    if (i === dI || bloqueado(f)) return;
    if (fijado(f) && !(origen && iso(f) === iso(origen))) return;
    libres.push(i);
    pool.push(antes[i]);
  });
  const ix = pool.indexOf(clave);
  if (ix >= 0) pool.splice(ix, 1);
  // Si sobra una sesión (agregaste algo extra), se cae la de menor prioridad; el descanso se cuida.
  const caidas = [];
  const peso = (k) => (k === 'domingo' ? 4 : prio(k));
  while (pool.length > libres.length) {
    let m = 0;
    pool.forEach((k, i) => { if (peso(k) < peso(pool[m])) m = i; });
    caidas.push(pool.splice(m, 1)[0]);
  }
  const ayer = claveDe(addDays(dias[0], -1));
  const asign = antes.slice();
  asign[dI] = clave;
  let mejor = null;
  let mejorP = Infinity;
  permutaciones(pool, (perm) => {
    libres.forEach((i, j) => { asign[i] = perm[j]; });
    const p = puntuar(asign, antes, ayer);
    if (p < mejorP) { mejorP = p; mejor = asign.slice(); }
  });
  return { dias: dias.map(iso), antes, despues: mejor || asign, destino: iso(destino), origen: origen ? iso(origen) : null, caidas, ayer };
}
function aplicar(prop) {
  prop.dias.forEach((f, i) => { DB.agenda[f] = prop.despues[i]; });
  if (prop.origen) delete DB.fijos[prop.origen];
  DB.fijos[prop.destino] = true;
  save();
}
const DIA3 = (fISO) => DIAS[parseISO(fISO).getDay()].slice(0, 3).toLowerCase();
function textoCambios(prop) {
  const c = prop.dias.map((f, i) => (prop.despues[i] !== prop.antes[i] && f !== prop.destino ? `${titulo(prop.despues[i])} → ${DIA3(f)}` : null)).filter(Boolean);
  const caidas = prop.caidas.map((k) => `se cae ${titulo(k)}`);
  return c.concat(caidas).join(' · ');
}
function seguidosEn(prop) {
  const seq = [prop.ayer, ...prop.despues];
  const out = [];
  for (let i = 1; i < seq.length; i++) if (esPesada(seq[i]) && esPesada(seq[i - 1])) out.push(`${titulo(seq[i - 1])} y ${titulo(seq[i])}`);
  return out;
}

// Desde Inicio: "hoy hice otra cosa". Se aplica directo.
function cambiarDia(d, nueva) {
  if (nueva === claveDe(d)) return '';
  const prop = reorganizar(d, nueva, null);
  aplicar(prop);
  return textoCambios(prop);
}
function restaurarSemana(d) {
  diasSemana(d).forEach((f) => { delete DB.agenda[iso(f)]; delete DB.fijos[iso(f)]; });
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
  const cambios = DB.entrenos[dISO]?.cambios || {};
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
    let x = { ...it, ...((E.b.ajustes || {})[it.id] || {}), base: it.id };
    // Opción elegida en el momento (orig / alt / casa); si no, en casa va la versión de casa.
    const eleg = cambios[it.id] || (casa && it.casa ? 'casa' : 'orig');
    const var_ = eleg === 'alt' ? it.alt : eleg === 'casa' ? it.casa : null;
    if (var_) x = { ...x, ...var_, reemplaza: it.nombre };
    x.eleccion = var_ ? eleg : 'orig';
    x.opciones = [['orig', it.nombre], ['alt', it.alt?.nombre], ['casa', it.casa?.nombre]]
      .filter(([k, n]) => n && k !== x.eleccion && !(k === 'casa' && it.casa?.nombre === it.alt?.nombre && it.alt));
    delete x.casa;
    delete x.alt;
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

// ---------- comida ----------
P.alimentos ||= [];
P.alimentosCats ||= [];
P.comidasTipo ||= [];
// Alimentos = los del plan + los que creaste, con tus correcciones de valores encima.
let ALI = {};
function armarALI() {
  ALI = Object.fromEntries([...DB.misAli, ...P.alimentos].map((a) => [a.id, { ...a, ...(DB.aliEdit[a.id] || {}) }]));
}
armarALI();
const todosAli = () => [...DB.misAli, ...P.alimentos].map((a) => ALI[a.id]);
// Valores de lo que comiste: si lo corregiste a mano, manda eso.
const valE = (e) => { const a = ALI[e.id]; return { p: e.p ?? a.prot * e.c, k: e.k ?? a.kcal * e.c }; };
function totales(dISO) {
  let prot = (DB.prot[dISO] || []).reduce((a, b) => a + b, 0);
  let kcal = 0;
  for (const e of DB.comida[dISO] || []) {
    if (!ALI[e.id]) continue;
    const v = valE(e);
    prot += v.p;
    kcal += v.k;
  }
  return { prot: Math.round(prot), kcal: Math.round(kcal) };
}
const fmtC = (c) => ({ 0.5: '½', 1.5: '1½' }[c] || fmt(c));
const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function dial(frac, color, centro, label, accion) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, frac)) * c;
  return `<button type="button" class="dial" ${accion}>
    <svg viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="${r}" class="dial-bg"/>${len > 0 ? `<circle cx="37" cy="37" r="${r}" class="dial-fg" style="stroke:${color}" stroke-dasharray="${len} ${c}" transform="rotate(-90 37 37)"/>` : ''}
    <text x="37" y="44" text-anchor="middle" class="dial-n">${centro}</text></svg>
    <span class="k">${label}</span></button>`;
}

// ---------- Garmin (vía app Salud + Atajo de iOS + portapapeles) ----------
const ATAJO = 'Entreno';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Texto que arma el Atajo (una línea por fase del sueño):
//   ENTRENO
//   fcr=56
//   s=Profundo;2026-10-13T01:02:00-03:00;2026-10-13T02:10:00-03:00
//   s=REM;...
//   padel=2026-10-12;2026-10-14   (opcional)
// También acepta el formato viejo con inicio= y fin=.
function faseDe(v) {
  const t = sinTildes(String(v));
  const n = { 0: 'cama', 1: 'dormido', 2: 'despierto', 3: 'ligero', 4: 'profundo', 5: 'rem' }[t.trim()];
  if (n) return n;
  if (/profund|deep/.test(t)) return 'profundo';
  if (/\brem\b/.test(t)) return 'rem';
  if (/despiert|awake|vigil/.test(t)) return 'despierto';
  if (/cama|bed/.test(t)) return 'cama';
  if (/nucleo|basico|core|ligero|light/.test(t)) return 'ligero';
  return 'dormido';
}
const aFecha = (t) => { const d = new Date(String(t || '').trim().replace(' ', 'T')); return isNaN(d) ? null : d; };
// Resume las fases de la última noche (si vinieron restos de la noche anterior, se descartan).
function resumirNoche(muestras) {
  const m = muestras.filter((x) => x.ini && x.fin && x.fin > x.ini).sort((a, b) => a.ini - b.ini);
  if (!m.length) return null;
  const grupos = [[m[0]]];
  for (const x of m.slice(1)) {
    const g = grupos[grupos.length - 1];
    if (x.ini - Math.max(...g.map((y) => +y.fin)) > 2 * 36e5) grupos.push([x]); else g.push(x);
  }
  const noche = grupos[grupos.length - 1];
  const fases = noche.filter((x) => x.fase !== 'cama');
  const base = fases.length ? fases : noche;
  const min = (f) => Math.round(noche.filter((x) => x.fase === f).reduce((a, x) => a + (x.fin - x.ini), 0) / 6e4);
  const dormidoMin = fases.filter((x) => x.fase !== 'despierto').reduce((a, x) => a + (x.fin - x.ini), 0) / 6e4;
  const ini = new Date(Math.min(...base.map((x) => +x.ini)));
  const fin = new Date(Math.max(...base.map((x) => +x.fin)));
  const horas = fases.length ? dormidoMin / 60 : (fin - ini) / 36e5;
  return {
    horas: Math.round(horas * 10) / 10,
    inicio: ini.toISOString(), fin: fin.toISOString(), dia: iso(fin),
    profundo: fases.length ? min('profundo') : null, rem: fases.length ? min('rem') : null,
    despierto: fases.length ? min('despierto') : null,
    despertares: noche.filter((x) => x.fase === 'despierto' && x.ini > ini && x.fin < fin).length,
  };
}
function leerSync(texto) {
  if (!/ENTRENO/i.test(texto || '')) return null;
  const kv = {};
  const muestras = [];
  texto.split(/[\n&]+/).forEach((l) => {
    const sm = l.match(/^\s*s\s*[=:]\s*(.+)$/i);
    if (sm) { const [v, a, b] = sm[1].split(/\s*[;|]\s*/); muestras.push({ fase: faseDe(v), ini: aFecha(a), fin: aFecha(b) }); return; }
    const m = l.match(/^\s*([a-záéíóú]+)\s*[=:]\s*(.+?)\s*$/i);
    if (m) kv[m[1].toLowerCase()] = m[2];
  });
  if (!muestras.length && aFecha(kv.inicio) && aFecha(kv.fin)) muestras.push({ fase: 'cama', ini: aFecha(kv.inicio), fin: aFecha(kv.fin) });
  let noche = resumirNoche(muestras);
  if (noche && !(noche.horas > 1 && noche.horas < 15)) noche = null;
  const fcr = num(kv.fcr);
  const padel = String(kv.padel || '').split(/[;,\s]+/).map((x) => (x.match(/\d{4}-\d{2}-\d{2}/) || [])[0]).filter(Boolean);
  if (fcr == null && !noche && !padel.length) return null;
  return { fcr: fcr != null ? Math.round(fcr) : null, noche, padel, dia: noche ? noche.dia : iso(hoy()) };
}
function guardarSync(texto) {
  const r = leerSync(texto);
  if (!r) return toast('No encontré datos del Atajo. Corrélo de nuevo y probá otra vez.');
  const dia = r.dia;
  const { dia: _d, ...noche } = r.noche || {};
  DB.salud[dia] = { ...(DB.salud[dia] || {}), ...(r.fcr != null ? { fcr: r.fcr } : {}), ...(r.noche ? noche : {}) };
  r.padel.forEach((f) => { if (!DB.garmin.padel.includes(f)) DB.garmin.padel.push(f); });
  save();
  render('inicio', true);
  const partes = [r.noche && `sueño ${fmtHoras(r.noche.horas)}`, r.fcr != null && `pulso ${r.fcr}`].filter(Boolean);
  toast(`Garmin: ${partes.join(' · ') || 'datos cargados'}`);
}
const fmtHoras = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const fmtMin = (m) => (m >= 60 ? fmtHoras(m / 60) : `${m} min`);

// Recuperación: sueño real (meta 7,5 h), sueño profundo, ratos despierto
// y pulso en reposo contra tu promedio de 3 semanas.
function recuperacion(dISO) {
  const s = DB.salud[dISO];
  if (!s) return null;
  const desde = iso(addDays(parseISO(dISO), -21));
  const prev = Object.keys(DB.salud).filter((f) => f < dISO && f >= desde && DB.salud[f].fcr != null).map((f) => DB.salud[f].fcr);
  const base = prev.length >= 3 ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
  const partes = []; // [puntaje 0–1, peso]
  if (s.horas != null) partes.push([clamp01((s.horas - 5) / 2.5), 1]);
  if (s.profundo != null && s.horas) partes.push([clamp01((s.profundo / (s.horas * 60) - 0.08) / 0.1), 0.5]);
  if (s.despierto != null && s.horas) partes.push([clamp01((s.horas * 60 / (s.horas * 60 + s.despierto) - 0.8) / 0.12), 0.5]);
  const dif = base != null && s.fcr != null ? s.fcr - base : null;
  if (dif != null) partes.push([clamp01(1 - Math.max(0, dif) / 8), 1]);
  if (!partes.length) return null;
  const peso = partes.reduce((a, [, w]) => a + w, 0);
  let p = Math.round((partes.reduce((a, [v, w]) => a + v * w, 0) / peso) * 100);
  if (dif != null && dif >= 8) p = Math.min(p, 30); // pulso muy alto: nunca verde
  return { p, ...s, base, dif };
}
const zonaR = (p) => (p >= 67 ? 'verde' : p >= 40 ? 'amarillo' : 'rojo');
const COLOR_R = { verde: 'var(--ok)', amarillo: 'var(--warn)', rojo: 'var(--bad)' };
const RECO_R = {
  verde: ['Dormiste bien y el pulso está normal.', 'Entrená como está planeado.'],
  amarillo: ['Recuperación a medias.', 'Primera ronda al 70 % y escuchá el cuerpo. Si no levanta, sacá una serie por ejercicio.'],
  rojo: ['Pulso alto o poco sueño.', 'Hoy mejor zona 2 suave o descanso. Si te sentís mareado, cortá.'],
};
function padelPendiente(d) {
  return diasSemana(d).map(iso).filter((f) => DB.garmin.padel.includes(f) && !DB.garmin.ignorados.includes(f) && claveDe(parseISO(f)) !== 'sabado');
}
const ICON_IR = '<span class="ir" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F4F3EF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></span>';
const ICON_AVISO = '<svg class="ic-aviso" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5B94A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>';
const filaAviso = (html, extra = '') => `<div class="aviso">${ICON_AVISO}<div class="aviso-txt">${html}${extra}</div></div>`;

// Héroe de Hoy: recuperación en grande; si no hay datos del Garmin, la tarjeta para traerlos.
function heroeRecuperacion(d) {
  const dISO = iso(d);
  const r = recuperacion(dISO);
  if (!r) {
    return `<section class="c garmin-sync">
      <div class="g-cab"><span><b>Datos del Garmin</b><small>Sueño y pulso de anoche, para calcular tu recuperación</small></span></div>
      <div class="dos"><button type="button" class="secund" data-accion="correr-atajo">Traer</button><button type="button" class="secund" data-accion="pegar-garmin">Pegar</button></div>
      <details class="ayuda-g"><summary>¿Cómo funciona?</summary><p class="mut chico">"Traer" corre el Atajo "${ATAJO}" de tu iPhone, que copia el sueño y el pulso de la app Salud. Volvé con ◀ y tocá "Pegar". Si programaste el Atajo para que corra solo a la mañana, con "Pegar" alcanza.</p></details>
      <textarea id="pegar-txt" class="pegar-txt" hidden placeholder="Mantené apretado acá y pegá"></textarea>
    </section>`;
  }
  const z = zonaR(r.p);
  const [titulo, consejo] = RECO_R[z];
  return `<button type="button" class="heroe" data-detalle="sueno" aria-label="Recuperación ${r.p} %, ver sueño y pulso">
    <span class="heroe-k">Recuperación</span>
    <span class="heroe-n"><span class="dot">${r.p}</span><span class="heroe-u">%</span></span>
    <span class="ruler"><span class="tri" style="left:calc(${r.p}% - 7px)"></span><span class="mk" style="left:calc(${r.p}% - 1.5px)"></span></span>
    <span class="heroe-t">${esc(titulo)}<br><span class="mut">${esc(consejo)}</span></span>
  </button>`;
}
function avisosPadel(d) {
  return padelPendiente(d).map((f) => filaAviso(`Garmin registró pádel el ${esc(diaNombre(parseISO(f)))} ${fechaCorta(f)}.`,
    `<div class="aviso-acc"><button type="button" class="link chico" data-ignorar-padel="${f}">Ignorar</button><button type="button" class="link chico" data-poner="${f}|sabado">Marcar en la semana</button></div>`)).join('');
}

// Tira de días: semana actual (o anteriores con la flecha). Días futuros no se tocan.
let semanaVista = 0; // 0 = esta semana, -1 = la anterior…
let diaVer = null; // día pasado que se mira en Hoy
let comidaDia = null; // día con el que trabaja Comida (null = hoy)
const tieneComida = (f) => (DB.comida[iso(f)] || []).length > 0 || (DB.prot[iso(f)] || []).length > 0;
function tiraDias(diaVisto, modo = 'hoy') {
  const h = hoy();
  const hISO = iso(h);
  const lunes = addDays(lunesDe(h), semanaVista * 7);
  const dias = ORDEN.map((_, k) => addDays(lunes, k));
  return `<nav class="tira-dias" aria-label="Días de la semana">
    <span class="td"><button type="button" class="tdc atras" data-semana="-1" aria-label="Semana anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4F3EF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><span class="tdp"></span></span>
    ${dias.map((f) => {
      const fISO = iso(f);
      const futuro = fISO > hISO;
      const cls = ['tdc', fISO === diaVisto ? 'sel' : '', fISO === hISO ? 'hoy' : '', futuro ? 'fut' : ''].filter(Boolean).join(' ');
      const letra = DIAS[f.getDay()][0];
      const marca = modo === 'comida' ? tieneComida(f) : hechoEl(f);
      const punto = `<span class="tdp${marca ? ` on ${modo}` : ''}"></span>`;
      const attr = modo === 'comida' ? 'data-comida-dia' : 'data-ver-dia';
      return `<span class="td">${futuro ? `<span class="${cls}">${letra}</span>` : `<button type="button" class="${cls}" ${attr}="${fISO}" aria-label="${DIAS[f.getDay()]} ${f.getDate()}">${letra}</button>`}${punto}</span>`;
    }).join('')}
  </nav>`;
}

// ---------- pantalla: INICIO ----------
const COLOR_TIPO = { fuerza: 'var(--entreno)', cardio: '#8FB0FF', descanso: '#5A5A60' };
const colorDe = (k) => COLOR_TIPO[P.sesiones[k].tipo] || 'var(--entreno)';
const tipoNombre = (s) => ({ fuerza: 'Fuerza', cardio: 'Cardio', descanso: 'Descanso' }[s.tipo] || '');
function vistaInicio() {
  const d = hoy();
  const dISO = iso(d);
  const S = armarSesion(d);
  const { E, clave } = S;
  const ent = DB.entrenos[dISO];
  const ejercicios = ejerciciosDe(S);
  const hechos = ejercicios.filter((x) => completo(x, dISO)).length;

  if (diaVer && diaVer < dISO) return vistaDiaPasado(diaVer);
  let h = `<header class="cab"><h1>${DIAS[d.getDay()]} ${d.getDate()}</h1><span class="k">${chipBloque(E)}</span></header>`;
  h += tiraDias(dISO);
  h += heroeRecuperacion(d);
  h += avisosPadel(d);
  h += avisoUnico(d, E, clave);
  h += tarjetaSesion(S, ent, hechos, ejercicios.length);
  h += tarjetasDia(dISO);
  h += tarjetaPeso(dISO);
  return h;
}

const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const BTN_HOY = (attr) => `<button type="button" class="secund hoy-btn" ${attr}>Hoy<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;
function cuandoFue(fISO) {
  const dias = Math.round((parseISO(iso(hoy())) - parseISO(fISO)) / 864e5);
  return dias === 1 ? 'Ayer' : dias < 7 ? `Hace ${dias} días` : fechaCorta(fISO);
}
// Cuentas de una sesión registrada (las mismas del resumen).
function cuentaSesion(fISO) {
  const S = armarSesion(parseISO(fISO));
  const ejercicios = ejerciciosDe(S);
  let series = 0;
  let volumen = 0;
  for (const x of ejercicios) {
    const e = DB.logs[fISO]?.[x.logId];
    rango(x.series || 1).forEach((i) => {
      if (!e?.d?.[i]) return;
      series++;
      if (!x.sinPeso) volumen += (num(kAt(e, i)) || 0) * (e.r?.[i] || 0);
    });
  }
  return { S, ejercicios, series, volumen };
}

function vistaDiaPasado(fISO) {
  const d = parseISO(fISO);
  const E = estado(fISO);
  const ent = DB.entrenos[fISO];
  const { S, ejercicios, series, volumen } = cuentaSesion(fISO);
  const s = DB.salud[fISO] || {};
  const r = recuperacion(fISO);
  const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const entreno = hechoEl(d);

  let h = `<header class="cab"><div><h1>${DIAS[d.getDay()]} ${d.getDate()}</h1><span class="k">${cuandoFue(fISO)} · ${chipBloque(E)}</span></div>${BTN_HOY(`data-ver-dia="${iso(hoy())}"`)}</header>`;
  h += tiraDias(fISO);
  h += `<div class="minis">
    <button type="button" class="mini" data-detalle="sueno"><span class="k">Recuperación</span><span class="mini-n">${r ? `${r.p} <small>%</small>` : '—'}</span></button>
    <button type="button" class="mini" data-detalle="sueno"><span class="k"><i class="pto" style="background:var(--sueno)"></i>Sueño</span><span class="mini-n">${s.horas != null ? `${hm(s.horas)} <small>h</small>` : '—'}</span></button>
    <button type="button" class="mini" data-detalle="sueno"><span class="k"><i class="pto" style="background:var(--pulso)"></i>Pulso</span><span class="mini-n">${s.fcr != null ? `${s.fcr} <small>lpm</small>` : '—'}</span></button>
  </div>`;

  // entrenamiento
  h += `<section class="t alta tarjeta-dia" style="background-color:${entreno ? colorDe(S.clave) : 'var(--sup2)'}">
    <div class="ses-top"><span class="t-k">Entrenamiento · ${esc(tipoNombre(S.s))}</span><span class="estado-chip">${entreno ? '✓ Hecho' : 'Sin registro'}</span></div>
    <h2>${esc(S.s.titulo)}</h2>`;
  if (entreno) {
    const min = ent?.inicio && ent?.fin ? Math.max(1, Math.round((ent.fin - ent.inicio) / 6e4)) : null;
    h += `<div class="cuentas">${min ? `<span><b>${min}</b><small> min</small></span>` : ''}<span><b>${series}</b><small> series</small></span>${volumen ? `<span><b>${fmt(volumen, 0)}</b><small> kg totales</small></span>` : ''}</div><div class="filas">`;
    const sinPeso = [];
    for (const x of ejercicios) {
      const e = DB.logs[fISO]?.[x.logId];
      if (!e?.d?.some(Boolean)) continue;
      if (x.sinPeso || pesoMax(e) == null) { sinPeso.push(x.nombre); continue; }
      const reps = (e.r || []).slice(0, x.series || 1).map((v) => v || '–').join('-');
      h += `<button type="button" class="fr" data-ej="${esc(x.logId)}"><span>${esc(x.nombre)}</span><span class="fr-d"><span class="v">${x.series} × ${fmt(pesoMax(e))} kg${reps ? ` · ${reps}` : ''}</span>${CHEV}</span></button>`;
    }
    if (sinPeso.length) h += `<div class="fr sin"><span>${esc(sinPeso.length > 3 ? `${sinPeso.slice(0, 3).join(', ')} y ${sinPeso.length - 3} más` : sinPeso.join(', '))}</span><span class="v">✓ hechos</span></div>`;
    h += '</div>';
  } else {
    h += '<p class="ses-sub">No hay series registradas ese día.</p>';
  }
  h += '</section>';
  const enSemana = fISO >= iso(lunesDe(hoy()));
  h += `<div class="links">${ent?.inicio ? `<button type="button" class="link" data-resumen="${fISO}">Ver resumen</button>` : ''}${enSemana ? `<button type="button" class="link" data-cambiar-dia="${fISO}">Cambiar lo que hiciste</button>` : ''}</div>`;

  // comida
  const { prot, kcal } = totales(fISO);
  const lista = DB.comida[fISO] || [];
  const momIds = P.momentos.map((x) => x.id);
  const filasCom = P.momentos.map((mo) => {
    let p = 0;
    let k = 0;
    lista.filter((e) => (momIds.includes(e.m) ? e.m : 'extras') === mo.id && ALI[e.id]).forEach((e) => { const v = valE(e); p += v.p; k += v.k; });
    if (mo.id === 'extras') p += (DB.prot[fISO] || []).reduce((a, b) => a + b, 0);
    return p || k ? `<div class="fr"><span>${esc(mo.nombre)}</span><span class="v">${fmt(p, 0)} g · ${fmt(k, 0)} kcal</span></div>` : '';
  }).join('');
  h += `<section class="t alta tarjeta-dia" style="background-color:var(--comida)">
    <div class="ses-top"><span class="t-k">Comida</span><span class="k claro">${DB.crea[fISO] ? 'Creatina ✓' : ''}</span></div>
    <div class="cuentas"><span><b>${prot}</b><small> / ${P.nutricion.proteinaMeta} g prot.</small></span><span><b>${fmt(kcal, 0)}</b><small>${E.b.macros ? ` / ${fmt(E.b.macros.kcal, 0)}` : ''} kcal</small></span></div>
    ${filasCom ? `<div class="filas">${filasCom}</div>` : '<p class="ses-sub">No cargaste comida ese día.</p>'}
    <button type="button" class="secund" data-comida-dia="${fISO}" data-ir-comida="1">Editar la comida de ese día</button>
  </section>`;

  // peso
  h += `<section class="t tarjeta peso-t chica" style="background-color:var(--cuerpo)"><span class="t-k">Peso en ayunas</span><span>${DB.peso[fISO] ? `<span class="t-n">${esc(DB.peso[fISO])}</span><span class="t-u"> kg</span>` : '<span class="t-u">Sin dato</span>'}</span></section>`;
  return h;
}

// Comida, sueño y pulso del día como tarjetas de color.
function tarjetasDia(dISO) {
  const E = estado(dISO);
  const { prot, kcal } = totales(dISO);
  const metaP = P.nutricion.proteinaMeta;
  const metaK = E.b.macros?.kcal;
  const s = DB.salud[dISO] || {};
  const r = recuperacion(dISO);
  const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  return `<button type="button" class="t tarjeta" style="background-color:var(--comida)" data-tab="nutri">
      ${ICON_IR}<span class="t-k">Comida</span>
      <span class="t-2">
        <span class="t-col"><span><span class="t-n">${prot}</span><span class="t-u"> / ${metaP} g prot.</span></span><span class="minibar"><span style="width:${Math.min(100, (prot / metaP) * 100)}%"></span></span></span>
        <span class="t-col"><span><span class="t-n">${fmt(kcal, 0)}</span><span class="t-u"> kcal</span></span><span class="minibar"><span style="width:${metaK ? Math.min(100, (kcal / metaK) * 100) : 0}%"></span></span></span>
      </span>
    </button>
    <div class="t-par">
      <button type="button" class="t tarjeta" style="background-color:var(--sueno)" data-detalle="sueno">${ICON_IR}<span class="t-k">Sueño</span>
        <span>${s.horas != null ? `<span class="t-n g">${hm(s.horas)}</span><span class="t-u"> h</span>` : '<span class="t-n g">—</span>'}</span></button>
      <button type="button" class="t tarjeta" style="background-color:var(--pulso)" data-detalle="sueno">${ICON_IR}<span class="t-k">Pulso</span>
        <span>${s.fcr != null ? `<span class="t-n g">${s.fcr}</span><span class="t-u"> lpm${r?.dif != null ? ` · ${r.dif >= 0 ? '+' : ''}${fmt(r.dif, 0)} vs prom.` : ''}</span>` : '<span class="t-n g">—</span>'}</span></button>
    </div>`;
}

// Un solo aviso a la vez: el más importante.
function avisoUnico(d, E, clave) {
  const dISO = iso(d);
  const t = P.tests.fechas.find((x) => dISO >= x.fecha && dISO <= iso(addDays(parseISO(x.fecha), 6)));
  let a = null;
  if (E.fase === 'antes') a = `El plan arranca el ${fechaCorta(P.bloques[0].desde)}.`;
  else if (E.descarga) a = `<b>Semana de descarga:</b> la mitad de las series${clave === 'viernes' ? ' y hoy zona 2 en vez de intervalos' : ''}.`;
  else if (E.fase === 'plan' && E.b.volumenBajo) a = esc(E.b.aviso);
  else if (t && !testCompleto(t.id)) a = 'Semana de tests: <button type="button" class="link chico" data-detalle="tests">cargalos acá</button>';
  else if (avisoSeguidos(d)) a = `${esc(avisoSeguidos(d))} Si llegás cargado, cambiá uno por zona 2.`;
  else if (rango(7).map((i) => recuperacion(iso(addDays(d, -i)))).filter((r) => r && r.p < 40).length >= 3) a = 'Varios días con recuperación baja esta semana: considerá adelantar la descarga.';
  return a ? filaAviso(a) : '';
}

function tarjetaSesion(S, ent, hechos, total) {
  const { s, clave, lugar, dISO } = S;
  const d = parseISO(dISO);
  const entrena = s.tipo === 'fuerza' || s.tipo === 'cardio';
  const tieneCasa = s.items.some((it) => it.casa) || clave === 'viernes';
  const r = recuperacion(dISO);
  const sub = [s.sub, total > 1 ? `${total} ejercicios` : ''].filter(Boolean).join(' · ');
  let h = `<section class="t sesion" style="--sc:${colorDe(clave)}">
    <div class="ses-top"><span class="tipo-k">${entrena ? 'Hoy entrenás' : 'Hoy'} · ${esc(tipoNombre(s))}${movido(d) ? ' · movida' : ''}</span><span class="ses-dur">${ent?.inicio ? (lugar === 'casa' ? 'Casa' : 'Gimnasio') : esc(s.duracion || '')}</span></div>
    <div class="ses-pie">
      <h2>${esc(s.titulo)}</h2>
      ${sub ? `<p class="ses-sub">${esc(sub)}</p>` : ''}`;
  if (!ent?.inicio) {
    if (tieneCasa) {
      h += `<div class="segm" role="group" aria-label="Dónde entrenás">${[['gym', 'Gimnasio'], ['casa', 'Casa']].map(([v, t]) => `<button type="button" class="${lugar === v ? 'on' : ''}" data-lugar="${v}">${t}</button>`).join('')}</div>`;
      if (lugar === 'casa') h += `<p class="ses-sub chico">Con: ${esc(P.casa.equipo)}</p>`;
    }
    h += '<button type="button" class="primario" data-accion="empezar">Empezar</button>';
    if (entrena) h += '<p class="ses-70">Primera ronda al 70 %</p>';
  } else if (!ent.fin) {
    h += `<button type="button" class="primario" data-accion="continuar">Continuar · ${hechos}/${total}</button>`;
  } else {
    h += `<p class="hecha">✓ Hecha · ${Math.max(1, Math.round((ent.fin - ent.inicio) / 60000))} min</p>
      <div class="ses-acc"><button type="button" class="secund" data-accion="resumen">Ver resumen</button><button type="button" class="link" data-accion="reabrir">Reabrir</button></div>`;
  }
  h += `</div></section>
    <div class="links">
      <button type="button" class="link" data-accion="verlista">Ver ejercicios</button>
      ${ent?.inicio ? '' : '<button type="button" class="link" data-accion="cambiar">Cambiar sesión</button>'}
      ${r && zonaR(r.p) === 'rojo' && !['z2', 'domingo'].includes(clave) && !ent?.inicio ? '<button type="button" class="link" data-sesion="z2">Cambiar hoy por zona 2</button>' : ''}
    </div>
    <ul class="c prev" id="prev" hidden>${S.items.map((x) => (x.seccion ? `<li class="k">${esc(x.seccion)}</li>` : `<li><span>${esc(x.nombre)}</span><span class="mut">${esc(dosis(x))}</span></li>`)).join('')}</ul>
    <div class="c opciones" id="opciones" hidden>
      <p class="mut chico">¿Qué hiciste o vas a hacer hoy? La semana se reacomoda sola.</p>
      ${Object.keys(P.sesiones).filter((k) => k !== clave).map((k) => `<button type="button" class="secund" data-sesion="${k}">${esc(titulo(k))}</button>`).join('')}
      <button type="button" class="link chico" data-tab="semana" style="grid-column:1/-1">¿Es otro día? Cambialo en Semana</button>
    </div>`;
  return h;
}

function tiraSemana(d) {
  const dISO = iso(d);
  return `<button type="button" class="c tira" data-tab="semana">
    <span class="fila-k"><span class="k">${diasSemana(d).filter(hechoEl).length} de 7 días con registro</span><span class="k">Ver →</span></span>
    <span class="dias7">${diasSemana(d).map((f) => {
      const fISO = iso(f);
      const est = hechoEl(f) ? 'ok' : fISO === dISO ? 'hoy' : fISO < dISO ? 'pasado' : '';
      return `<span class="d7 ${est}" style="--sc:${colorDe(claveDe(f))}"><span class="l">${DIAS[f.getDay()][0]}</span><span class="pt">${est === 'ok' ? '✓' : ''}</span><span class="s">${esc(P.sesiones[claveDe(f)].corto || '')}</span></span>`;
    }).join('')}</span>
  </button>`;
}

function tarjetaPeso(dISO) {
  const v = DB.peso[dISO] || '';
  const fechas = Object.keys(DB.peso).filter((f) => f <= dISO && num(DB.peso[f]) != null).sort();
  const ultimo = fechas[fechas.length - 1];
  const actual = num(DB.peso[ultimo]);
  const hace7 = iso(addDays(parseISO(dISO), -7));
  const ref = fechas.filter((f) => f <= hace7).pop();
  let delta = '';
  if (ref && actual != null) {
    const dl = actual - num(DB.peso[ref]);
    delta = ` · ${dl <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dl))} en 7 días`;
  }
  return `<section class="t tarjeta peso-t" style="background-color:var(--cuerpo)">
    <span class="peso-izq"><span class="t-k">Peso en ayunas</span>
      <span>${actual != null ? `<span class="t-n">${fmt(actual)}</span><span class="t-u"> kg${delta}</span>` : '<span class="t-u">Cargá tu peso de hoy</span>'}</span></span>
    <label class="peso-in"><span>Hoy</span><input id="peso-hoy" type="text" inputmode="decimal" autocomplete="off" value="${esc(v)}" placeholder="—" aria-label="Peso de hoy en kilos"></label>
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
      <button type="button" class="ico" data-accion="salir" aria-label="Volver a Hoy">${ICON_ATRAS}</button>
      <span class="reloj" id="reloj">${reloj(ent.inicio)}</span>
      <span class="en-prog">${hechos}/${ejercicios.length}</span>
    </header>
    <div class="barra"><span style="width:${ejercicios.length ? (hechos / ejercicios.length) * 100 : 0}%"></span></div>
    <p class="en-sub">${esc(S.s.titulo)} · ${S.lugar === 'casa' ? 'Casa' : 'Gimnasio'}${S.s.tipo !== 'descanso' ? ' · <span class="aviso-t">primera ronda al 70 %</span>' : ''}</p><div class="en-lista">`;
  const OK = '<span class="ok-c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg></span>';
  let paso = false; // ya pasamos el ejercicio actual
  for (const x of S.items) {
    if (x.seccion) { h += `<p class="k sec">${esc(x.seccion)}</p>`; continue; }
    if (actual && x.logId === actual.logId) { h += bloqueActual(x, dISO); paso = true; continue; }
    if (completo(x, dISO)) h += `<button type="button" class="hecho-f" data-ir="${esc(x.logId)}"><span class="hecho-n">${OK}${esc(x.nombre)}</span><span class="v">${esc(resumenHecho(x, dISO))}</span></button>`;
    else {
      if (paso) { h += '<p class="k sec">Después</p>'; paso = false; }
      h += `<button type="button" class="pend" data-ir="${esc(x.logId)}"><span>${esc(x.nombre)}</span><span class="v">${esc(dosis(x))}</span></button>`;
    }
  }
  h += '</div>';
  if (!actual) h += '<p class="todo-ok">Completaste todo. ¡Bien ahí!</p>';
  h += `<button type="button" class="${actual ? 'secund terminar' : 'primario'}" data-accion="terminar">Terminar sesión</button>`;
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
    <div class="ej-top"><h3>${esc(x.nombre)}</h3><span class="dosis">${esc(dosis(x))}</span></div>
    ${meta ? `<p class="k">${meta.replace('⏱ ', 'Descanso ')}</p>` : ''}
    <div class="act-links">${tec ? '<button type="button" class="link chico" data-accion="ver-tec">Técnica y video</button>' : ''}${x.opciones?.length ? '<button type="button" class="link chico" data-accion="ver-opciones">Cambiar ejercicio</button>' : ''}${x.sinPeso ? '' : `<button type="button" class="link chico" data-historial="${esc(x.logId)}">Historial</button>`}</div>
    ${tec ? `<div class="tec" hidden>${tecHTML(tec)}</div>` : ''}
    ${x.opciones?.length ? `<div class="opc-ej" hidden>${x.opciones.map(([k, n]) => `<button type="button" class="secund" data-opcion="${esc(x.base)}|${k}">${k === 'orig' ? '↺ ' : ''}${esc(n)}</button>`).join('')}</div>` : ''}
    ${x.lista ? listaHTML(x) : ''}`;
  if (sug) h += `<p class="sube"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg><span>${sug.w ? `Hoy subí a <b>${esc(sug.w)} kg</b> <small>(antes ${esc(sug.antes)})</small>` : esc(sug.txt)}</span></p>`;

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
let resumenDia = null; // fecha del resumen (null = hoy)
function vistaResumen() {
  const dISO = resumenDia || iso(hoy());
  const d = parseISO(dISO);
  const ent = DB.entrenos[dISO] || {};
  const { S, ejercicios, series, volumen } = cuentaSesion(dISO);
  const subir = ejercicios.map((x) => ({ x, s: evaluarSubida(x, DB.logs[dISO]?.[x.logId]) })).filter((o) => o.s);
  const faltan = ejercicios.filter((x) => !completo(x, dISO));
  const min = ent.inicio ? Math.max(1, Math.round(((ent.fin || Date.now()) - ent.inicio) / 60000)) : '—';

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
  h += `<button type="button" class="primario" data-accion="volver-resumen">${resumenDia ? 'Volver al día' : 'Volver al inicio'}</button>`;
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

let propuesta = null;
let semanaS = 0; // semana que se mira en la pestaña Semana (0 = esta)
function vistaSemana() {
  const d = hoy();
  const hISO = iso(d);
  const ref = addDays(d, semanaS * 7);
  const dias = diasSemana(ref);
  const E = estado(iso(ref));
  const rangoTxt = `${dias[0].getDate()}–${dias[6].getDate()} ${dias[6].toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}`;
  const flecha = (dir) => `<button type="button" class="ico" data-semana-s="${dir}" aria-label="Semana ${dir < 0 ? 'anterior' : 'siguiente'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg></button>`;
  let h = `<header class="cab"><div><h1>Semana</h1><span class="k">${rangoTxt} · ${chipBloque(E)}</span></div><div class="flechas">${flecha(-1)}${flecha(1)}</div></header>`;
  if (semanaS !== 0) h += `<button type="button" class="link chico" data-semana-s="0">Volver a esta semana</button>`;

  if (propuesta) {
    const seg = seguidosEn(propuesta);
    h += `<section class="c propuesta"><p class="t-k">Así queda la semana</p>
      <p class="mut chico">${esc(textoCambios(propuesta) || 'Sin otros cambios.')}</p>
      ${seg.length ? `<p class="aviso-t">Quedan días fuertes seguidos: ${esc(seg.join(', '))}.</p>` : ''}
      <div class="dos"><button type="button" class="secund" data-accion="cancelar-prop">Cancelar</button><button type="button" class="secund confirmar" data-accion="confirmar-prop">Confirmar</button></div>
    </section><div class="dias-lista">`;
    propuesta.dias.forEach((fISO, i) => {
      const k = propuesta.despues[i];
      const cambia = k !== propuesta.antes[i];
      const f = parseISO(fISO);
      h += `<div class="dia prev-dia${cambia ? ' cambia' : ''}"><div class="dia-fila"><span class="dn">${DIAS[f.getDay()].slice(0, 3)}<small>${f.getDate()}</small></span>
        <span class="ses"><b>${esc(titulo(k))}${fISO === propuesta.destino ? ' 📌' : ''}</b><span class="tipo-l"><i style="background:${colorDe(k)}"></i>${cambia ? `antes: ${esc(titulo(propuesta.antes[i]))}` : esc(tipoNombre(P.sesiones[k]))}</span></span><span class="est"></span><span></span></div></div>`;
    });
    return `${h}</div>`;
  }

  if (E.descarga) h += filaAviso('<b>Semana de descarga:</b> la mitad de las series y el viernes zona 2.');
  h += '<p class="ayuda">Tocá un día para ver o cambiar lo que tiene. Mantenelo apretado para moverlo: el resto se reacomoda solo.</p>';
  if (dias.some((f) => movido(f) || fijado(f))) h += '<button type="button" class="link chico" data-accion="restaurar">↺ Volver la semana al orden original</button>';

  h += '<div class="dias-lista">';
  dias.forEach((f) => {
    const dia = f.getDay();
    const fISO = iso(f);
    const S = armarSesion(f);
    const esHoy = fISO === hISO;
    const pasado = fISO < hISO;
    const bloq = bloqueado(f);
    const prevD = addDays(f, -1);
    const seguidos = pesada(f) && pesada(prevD) && (movido(f) || movido(prevD));
    const abierto = diaAbierto === fISO;
    const est = hechoEl(f) ? '✓ Hecha' : fijado(f) ? '📌 fijo' : movido(f) ? 'movido' : (pasado ? '' : esc(S.s.duracion || ''));
    h += `<div class="dia${esHoy ? ' hoy' : ''}${bloq ? ' bloq' : ''}${pasado ? ' pasado' : ''}" data-dia="${dia}" data-fecha="${fISO}">
      <div class="dia-fila"${bloq ? '' : ` data-arr="${fISO}"`} data-abrir="${fISO}">
        <span class="dn">${DIAS[dia].slice(0, 3)}<small${esHoy ? ' class="hoy-t"' : ''}>${esHoy ? 'Hoy' : f.getDate()}</small></span>
        <span class="ses"><b>${esc(S.s.titulo)}</b><span class="tipo-l"><i style="background:${colorDe(S.clave)}"></i>${esc(tipoNombre(S.s))}${S.s.pesada ? ' · fuerte' : ''}${seguidos ? ' · <span class="aviso-t">2 fuertes seguidos</span>' : ''}</span></span>
        <span class="est">${est}</span>
        ${bloq ? CHEV : '<span class="asa" aria-hidden="true">⋮⋮</span>'}
      </div>
      <div class="dia-body"${abierto ? '' : ' hidden'}>
        ${editable(f) ? `<p class="k">${pasado ? 'Ese día hiciste' : 'Cambiar por'}</p><div class="mover poner">${Object.keys(P.sesiones).filter((k) => k !== S.clave).map((k) => `<button type="button" class="secund chico" data-poner="${fISO}|${k}"><i class="pto" style="background:${colorDe(k)}"></i>${esc(P.sesiones[k].corto || titulo(k))}</button>`).join('')}</div>` : ''}
        ${bloq ? '' : `<p class="k">Mover a</p><div class="mover">${dias.filter((g) => g !== f && !bloqueado(g)).map((g) => `<button type="button" class="secund chico" data-mover="${fISO}|${iso(g)}">${DIAS[g.getDay()].slice(0, 3)}</button>`).join('')}</div>`}
        ${pasado ? `<button type="button" class="link chico" data-ver-dia-ir="${fISO}">Ver lo que hiciste ese día</button>` : ''}
        ${S.s.sub ? `<p class="meta">${esc(S.s.sub)}</p>` : ''}${S.items.map((x) => cardVer(x, S.dISO)).join('')}
      </div>
    </div>`;
  });
  h += '</div>';

  const guia = (t, cuerpo, der = '') => `<details class="guia-f"><summary><span>${t}</span><span class="fr-d">${der}${CHEV}</span></summary><div class="guia-c">${cuerpo}</div></details>`;
  h += '<p class="k guia-t">El plan</p><div class="guia">';
  h += guia('Bloques', P.bloques.map((b) => `<div class="bloque-f${b === E.b && E.fase === 'plan' ? ' actual-b' : ''}"><b>${esc(b.etiqueta)}</b><p class="meta">${fechaCorta(b.desde)} – ${fechaCorta(b.hasta)}${b.descarga ? ` · descarga ${fechaCorta(b.descarga.desde)}–${fechaCorta(b.descarga.hasta)}` : ''}</p><p>Fuerza: ${esc(b.fuerza)}</p><p>Viernes: ${esc(b.viernesTxt)}</p><p>Comida: ${esc(b.comida)}</p></div>`).join(''), `<span class="v">${esc(E.b.etiqueta.split(' · ')[0])}</span>`);
  h += guia('Reglas de ajuste', `<ul class="reglas">${P.reglas.ajuste.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  h += guia('Seguridad (disautonomía)', `<ul class="reglas">${P.reglas.seguridad.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  h += guia('Progresión', `<p class="meta">${esc(P.reglas.progresion)}</p>`);
  h += '</div>';
  return h;
}

// ---------- pantalla: COMIDA ----------
let catSel = null;
let aliSel = null;

function frecuentes() {
  const cuenta = {};
  Object.values(DB.comida).forEach((l) => l.forEach((e) => { cuenta[e.id] = (cuenta[e.id] || 0) + 1; }));
  return Object.keys(cuenta).filter((id) => ALI[id]).sort((a, b) => cuenta[b] - cuenta[a]).slice(0, 8);
}

let pickerMom = null; // momento del día donde se está agregando
let editAli = null; // alimento cuyos valores se están editando
let creando = false;
let editEnt = null; // índice de lo comido que se está corrigiendo
let busqueda = '';
const campoNum = (id, val, unidad, label) => `<label class="cn"><span>${label}</span><input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${val ?? ''}"><small>${unidad}</small></label>`;

function picker() {
  const frec = frecuentes();
  const mios = DB.misAli.length ? ['Mis alimentos'] : [];
  const cats = (frec.length ? ['Frecuentes'] : []).concat(mios, P.alimentosCats);
  const cat = catSel && cats.includes(catSel) ? catSel : cats[0];
  const lista = cat === 'Frecuentes' ? frec.map((id) => ALI[id]) : todosAli().filter((a) => (a.cat || 'Mis alimentos') === cat);
  let h = `<div class="picker">
    <input id="buscar" type="search" placeholder="Buscar: huevo, pollo, pizza…" autocomplete="off" aria-label="Buscar alimento" value="${esc(busqueda)}">
    <div class="segmentos chico" id="cats"${busqueda ? ' hidden' : ''}>${cats.map((c) => `<button type="button" class="${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <ul class="ali-lista" id="ali-lista">${todosAli().map((a) => {
      const visible = lista.includes(a);
      const editado = !!DB.aliEdit[a.id];
      const t = sinTildes(busqueda.trim());
      const oculto = t ? !sinTildes(a.nombre).includes(t) : !visible;
      return `<li data-n="${esc(sinTildes(a.nombre))}" data-vis="${visible ? 1 : 0}"${oculto ? ' hidden' : ''}>
        <button type="button" class="ali" data-ali="${a.id}"><span><b>${esc(a.nombre)}</b><small>${esc(a.porcion)}${editado ? ' · editado' : ''}</small></span><span class="mut">${fmt(a.prot)} g · ${fmt(a.kcal, 0)} kcal</span></button>
        ${aliSel === a.id ? `<div class="cant"><span class="k">¿Cuánto?</span>${[0.5, 1, 1.5, 2, 3].map((c) => `<button type="button" data-add="${a.id}|${c}">${fmtC(c)}</button>`).join('')}</div>
          ${editAli === a.id ? `<div class="edit-v"><p class="k">Valores por ${esc(a.porcion)}</p>
            <div class="cn-fila">${campoNum('ed-p', a.prot, 'g', 'Proteína')}${campoNum('ed-k', a.kcal, 'kcal', 'Calorías')}</div>
            <div class="dos"><button type="button" class="secund" data-edit-ali="${a.id}">Cancelar</button><button type="button" class="secund confirmar" data-guardar-ali="${a.id}">Guardar</button></div>
            ${editado && !a.id.startsWith('u-') ? `<button type="button" class="link chico" data-reset-ali="${a.id}">↺ Volver a los valores originales</button>` : ''}
            ${a.id.startsWith('u-') ? `<button type="button" class="link chico rojo" data-borrar-ali="${a.id}">Borrar este alimento</button>` : ''}
          </div>` : `<button type="button" class="link chico" data-edit-ali="${a.id}">✎ Editar valores</button>`}` : ''}
      </li>`;
    }).join('')}</ul>`;
  if (creando) {
    h += `<div class="edit-v nuevo"><p class="k">Alimento nuevo</p>
      <label class="cn ancho"><span>Nombre</span><input id="nv-n" type="text" autocomplete="off" value="${esc(busqueda)}" placeholder="Prota (barrita)"></label>
      <label class="cn ancho"><span>Porción</span><input id="nv-po" type="text" autocomplete="off" value="1 unidad"></label>
      <div class="cn-fila">${campoNum('nv-p', '', 'g', 'Proteína')}${campoNum('nv-k', '', 'kcal', 'Calorías')}</div>
      <p class="error" id="nv-err" hidden></p>
      <div class="dos"><button type="button" class="secund" data-accion="crear-ali">Cancelar</button><button type="button" class="secund confirmar" data-accion="guardar-nuevo">Guardar</button></div>
    </div>`;
  } else {
    h += '<button type="button" class="secund crear" data-accion="crear-ali">+ Crear alimento</button>';
  }
  return `${h}</div>`;
}

function vistaNutri() {
  const hISO = iso(hoy());
  const dISO = comidaDia && comidaDia < hISO ? comidaDia : hISO;
  const d = parseISO(dISO);
  const E = estado(dISO);
  const N = P.nutricion;
  const m = E.b.macros;
  const { prot, kcal } = totales(dISO);
  const metaP = N.proteinaMeta;
  const metaK = m?.kcal;
  const lista = DB.comida[dISO] || [];
  const momIds = P.momentos.map((x) => x.id);
  const esHoy = dISO === hISO;
  const X = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let h = `<header class="cab"><div><h1>Comida</h1><span class="k">${esHoy ? `${DIAS[d.getDay()]} ${d.getDate()}` : `${DIAS[d.getDay()]} ${d.getDate()} · ${cuandoFue(dISO)}`} · ${esc(E.b.etiqueta.split(' · ')[0])}</span></div>${esHoy ? '' : BTN_HOY('data-comida-dia="hoy"')}</header>`;
  h += tiraDias(dISO, 'comida');

  // héroe: proteína
  const marca = Math.min(96, (prot / metaP) * 80); // la meta queda al 80 % de la regla
  const falta = metaP - prot;
  h += `<section class="t heroe-com" style="background-color:var(--comida)">
    <span class="heroe-k">Proteína</span>
    <span class="heroe-n"><span class="dot">${prot}</span><span class="heroe-u">/ ${metaP} g</span></span>
    <span class="ruler"><span class="tri" style="left:calc(${marca}% - 7px)"></span><span class="mk" style="left:calc(${marca}% - 1.5px)"></span><span class="meta-l"></span></span>
    <span class="com-txt">${falta > 0 ? `Te faltan ${falta} g${falta >= 20 ? ' · si no llegás: whey' : ''}` : 'Proteína cubierta'}</span>
    <span class="sep"></span>
    <span class="com-pie"><span><span class="t-n chico">${fmt(kcal, 0)}</span><span class="t-u"> ${metaK ? `/ ${fmt(metaK, 0)} ` : ''}kcal${metaK && kcal > metaK * 1.05 ? ' · te pasaste' : ''}</span></span>
      <button type="button" class="secund chico${DB.crea[dISO] ? ' on' : ''}" data-accion="crea">${DB.crea[dISO] ? '✓ Creatina' : '○ Creatina'}</button></span>
  </section>`;

  // momentos del día
  h += '<div class="momentos">';
  for (const mo of P.momentos) {
    const items = lista.map((e, i) => ({ e, i })).filter(({ e }) => (momIds.includes(e.m) ? e.m : 'extras') === mo.id && ALI[e.id]);
    const rapidas = mo.id === 'extras' ? DB.prot[dISO] || [] : [];
    let p = rapidas.reduce((a, b) => a + b, 0);
    let k = 0;
    items.forEach(({ e }) => { const v = valE(e); p += v.p; k += v.k; });
    const tipo = mo.tipo != null ? P.comidasTipo[mo.tipo] : null;
    const abierto = pickerMom === mo.id;
    const btnTipo = tipo ? `<button type="button" class="secund chico" data-tipo="${mo.tipo}" data-mom="${mo.id}">Tipo</button>` : '';
    const btnAgregar = `<button type="button" class="secund chico${abierto ? ' on-mom' : ''}" data-picker="${mo.id}">${abierto ? 'Listo' : '+ Alimento'}</button>`;
    if (!items.length && !rapidas.length && !abierto) {
      h += `<div class="vacio"><span class="vacio-n">${esc(mo.nombre)}</span><span class="vacio-b">${btnTipo}${btnAgregar}</span></div>`;
      continue;
    }
    h += `<section class="mom"><div class="mh"><h3>${esc(mo.nombre)}</h3><span class="k">${items.length || rapidas.length ? `${fmt(p, 0)} g · ${Math.round(k)} kcal` : ''}</span></div><div class="mom-items">`;
    h += items.map(({ e, i }) => {
      const a = ALI[e.id];
      const v = valE(e);
      let fila = `<div class="it"><button type="button" class="item-n" data-edit-ent="${i}"><b>${esc(a.nombre)}</b><small>${fmtC(e.c)} × ${esc(a.porcion)}${e.p != null ? ' · corregido' : ''}</small></button><span class="v">${fmt(v.p)} g · ${Math.round(v.k)}</span><button type="button" class="x" data-borrar="${i}" aria-label="Borrar ${esc(a.nombre)}">${X}</button></div>`;
      if (editEnt === i) {
        fila += `<div class="edit-v"><p class="k">Lo que comiste (${fmtC(e.c)} × ${esc(a.porcion)})</p>
          <div class="cn-fila">${campoNum('ee-p', +fmt(v.p).replace(',', '.'), 'g', 'Proteína')}${campoNum('ee-k', Math.round(v.k), 'kcal', 'Calorías')}</div>
          <div class="dos"><button type="button" class="secund" data-guardar-ent="${i}|hoy">Solo esta vez</button><button type="button" class="secund confirmar" data-guardar-ent="${i}|siempre">Usar siempre</button></div>
          <p class="mut chico">"Usar siempre" cambia los valores de ${esc(a.nombre)} para las próximas veces.</p></div>`;
      }
      return fila;
    }).join('');
    h += rapidas.map((g, i) => `<div class="it"><span class="item-n"><b>Carga rápida</b><small>versión anterior</small></span><span class="v">${g} g</span><button type="button" class="x" data-borrar-prot="${i}" aria-label="Borrar">${X}</button></div>`).join('');
    h += `</div><div class="mom-acc">${items.length ? '' : btnTipo}${btnAgregar}</div>${abierto ? picker() : ''}</section>`;
  }
  h += '</div>';

  // guía
  const sinCarbCena = ['z2', 'domingo'].includes(claveDe(d));
  const manana = claveDe(addDays(d, 1));
  const avisoAlc = ['piernas', 'viernes'].includes(manana) ? `Hoy no: mañana ${titulo(manana).toLowerCase()}` : d.getMonth() === 11 ? 'Diciembre: lo mínimo' : '';
  const guia = (titulo, cuerpo, derecha = '') => `<details class="guia-f"><summary><span>${titulo}</span><span class="fr-d">${derecha}${CHEV}</span></summary><div class="guia-c">${cuerpo}</div></details>`;
  h += '<p class="k guia-t">Guía</p><div class="guia">';
  if (m) h += guia('Macros del bloque', `<div class="tiles"><div class="tile"><b class="big">${fmt(m.kcal, 0)}</b><span>kcal</span></div><div class="tile"><b class="big">${m.prot} g</b><span>proteína</span></div><div class="tile"><b class="big">~${m.grasa} g</b><span>grasa</span></div><div class="tile"><b class="big">~${m.carbs} g</b><span>carbos</span></div></div><p class="meta">${esc(N.objetivo)}</p>`);
  else h += guia('Macros del bloque', `<p class="meta">${esc(N.mantenimiento)}</p>`);
  h += guia('Día tipo', `${sinCarbCena ? `<p class="aviso-t">Hoy es día liviano: sin papa ni arroz en la cena.</p>` : ''}<ul class="comidas-lista">${N.diaTipo.map((c) => `<li><div><b>${esc(c.comida)}</b><p>${esc(c.detalle)}</p></div><span>~${c.prot} g</span></li>`).join('')}</ul><ul class="reglas">${N.notasDia.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, sinCarbCena ? '<span class="aviso-t">Sin papa ni arroz</span>' : '');
  h += guia('Alcohol y comida libre', `<ul class="reglas">${N.alcohol.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, avisoAlc ? `<span class="aviso-t">${esc(avisoAlc)}</span>` : '');
  h += guia('Todos los días y suplementos', `<ul class="reglas">${N.otros.concat(N.suplementos).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  h += '</div>';
  return h;
}

function filtrarAlimentos(q) {
  const t = sinTildes(q.trim());
  document.querySelectorAll('#ali-lista li').forEach((li) => {
    li.hidden = t ? !li.dataset.n.includes(t) : li.dataset.vis !== '1';
  });
  const cats = $('#cats');
  if (cats) cats.hidden = !!t;
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

// ---------- pantalla: CUERPO (antes Progreso) ----------
let detalle = null; // null = grilla · 'peso' · 'sueno' · 'ejercicios' · 'ejercicio' · 'tests' · 'ajustes'
let volverA = null; // de dónde se abrió el detalle (para el botón ←)
let periodo = 7; // 7 días · 28 · 0 = todo
let ejLugar = null; // Gimnasio/Casa en el detalle de un ejercicio
const enPeriodo = (f) => !periodo || f >= iso(addDays(hoy(), -periodo + 1));
const ICON_ATRAS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>';
const cabDetalle = (tituloD) => `<header class="cab-det"><button type="button" class="ico" data-accion="det-volver" aria-label="Volver">${ICON_ATRAS}</button><h1>${esc(tituloD)}</h1><span></span></header>`;
const selPeriodo = () => `<div class="segm periodo" role="group" aria-label="Período">${[[7, '7 días'], [28, '4 semanas'], [0, 'Todo']].map(([v, t]) => `<button type="button" class="${periodo === v ? 'on' : ''}" data-periodo="${v}">${t}</button>`).join('')}</div>`;
const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const horaDe = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
const fmtHora = (x) => { const m = Math.round(((x % 24) + 24) % 24 * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

function vistaProgreso() {
  if (detalle === 'peso') return detallePeso();
  if (detalle === 'sueno') return detalleSueno();
  if (detalle === 'ejercicios') return detalleEjercicios();
  if (detalle === 'ejercicio') return detalleEjercicio();
  if (detalle === 'tests') return detalleTests();
  if (detalle === 'ajustes') return detalleAjustes();
  const dISO = iso(hoy());
  let h = `<header class="cab"><h1>Cuerpo</h1><button type="button" class="ico" data-detalle="ajustes" aria-label="Ajustes y backup"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></header>`;
  h += selPeriodo();

  // Peso
  const pesos = Object.keys(DB.peso).filter((f) => f <= dISO && enPeriodo(f) && num(DB.peso[f]) != null).sort().map((f) => num(DB.peso[f]));
  const sem = semanasPeso(dISO);
  const aj = ajustePeso(dISO);
  const ultPeso = sem.length ? sem[sem.length - 1].prom : pesos[pesos.length - 1];
  h += `<button type="button" class="t tarjeta alta-c" style="background-color:var(--cuerpo)" data-detalle="peso">${ICON_IR}<span class="t-k">Peso · promedio de la semana</span>
    ${pesos.length > 1 ? sparkline(pesos, P.tests.pesoObjetivo) : '<span class="t-u">Cargá tu peso en Hoy para ver la tendencia</span>'}
    <span class="t-fila"><span>${ultPeso != null ? `<span class="t-n">${fmt(ultPeso)}</span><span class="t-u"> kg</span>` : '<span class="t-n">—</span>'}</span><span class="t-der">${esc(aj.corto || '')}</span></span></button>`;

  // Sueño y pulso
  const noches = Object.keys(DB.salud).filter((f) => f <= dISO && enPeriodo(f)).sort();
  const horas = noches.map((f) => DB.salud[f].horas).filter((v) => v != null);
  const fcrs = noches.map((f) => DB.salud[f].fcr).filter((v) => v != null);
  const prom = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  h += `<div class="t-par">
    <button type="button" class="t tarjeta media" style="background-color:var(--sueno)" data-detalle="sueno">${ICON_IR}<span class="t-k">Sueño</span>
      ${horas.length ? `<span class="mini-barras">${horas.slice(-7).map((v) => `<i style="height:${Math.max(4, Math.min(34, (v / 9) * 34))}px"></i>`).join('')}</span>` : ''}
      <span>${horas.length ? `<span class="t-n">${hm(prom(horas))}</span><span class="t-u"> h prom.</span>` : '<span class="t-n">—</span>'}</span></button>
    <button type="button" class="t tarjeta media" style="background-color:var(--pulso)" data-detalle="sueno">${ICON_IR}<span class="t-k">Pulso</span>
      ${fcrs.length ? miniPuntos(fcrs.slice(-7)) : ''}
      <span>${fcrs.length ? `<span class="t-n">${Math.round(prom(fcrs))}</span><span class="t-u"> lpm prom.</span>` : '<span class="t-n">—</span>'}</span></button>
  </div>`;
  const conHorario = noches.filter((f) => DB.salud[f].inicio && DB.salud[f].fin);
  if (conHorario.length) {
    const a = conHorario.map((f) => { let x = horaDe(DB.salud[f].inicio); if (x < 12) x += 24; return x; });
    const b = conHorario.map((f) => horaDe(DB.salud[f].fin));
    const media = prom(a);
    const desv = Math.sqrt(prom(a.map((x) => (x - media) ** 2)));
    h += `<button type="button" class="t tarjeta chica-t" style="background-color:var(--sueno)" data-detalle="sueno">${ICON_IR}<span class="t-k">Horario de sueño</span>
      <span class="t-fila"><span><span class="t-n m">${fmtHora(media)}</span><span class="t-u"> → </span><span class="t-n m">${fmtHora(prom(b))}</span></span><span class="t-der">±${fmtMin(Math.round(desv * 60))}</span></span></button>`;
  }

  // Ejercicios
  const series = seriesEjercicios();
  const ids = Object.keys(series).sort((x, y) => series[y].length - series[x].length);
  h += `<section class="t tarjeta ejs" style="background-color:var(--entreno)"><span class="t-k">Ejercicios · mejor peso</span>`;
  if (!ids.length) h += '<span class="t-u">Cuando registres pesos, acá ves cómo evoluciona cada uno.</span>';
  ids.slice(0, 3).forEach((id) => {
    const pts = series[id];
    const mejor = Math.max(...pts.map((p) => p.v));
    const dl = mejor - pts[0].v;
    h += `<button type="button" class="fr" data-ej="${esc(id)}"><span>${esc(nombreEj(id))}</span><span class="fr-d"><span class="v">${fmt(mejor)} kg${dl > 0 ? ` · ▲ ${fmt(dl)}` : ''}</span>${CHEV}</span></button>`;
  });
  if (ids.length) h += `<button type="button" class="fr" data-detalle="ejercicios"><b>Ver los ${ids.length} ejercicios</b>${CHEV}</button>`;
  h += '</section>';

  // Tests
  const prox = P.tests.fechas.find((t) => t.fecha >= dISO);
  const ultT = [...P.tests.fechas].reverse().find((t) => t.fecha <= dISO);
  const dias = prox ? Math.round((parseISO(prox.fecha) - parseISO(dISO)) / 864e5) : null;
  h += `<button type="button" class="t tarjeta chica-t" style="background-color:var(--cuerpo)" data-detalle="tests">${ICON_IR}<span class="t-k">Tests cada 4 semanas</span>
    <span class="t-fila"><span>${prox ? `<span class="t-n m">${esc(prox.nombre.replace('de ', ''))}</span><span class="t-u"> · ${dias === 0 ? 'hoy' : `en ${dias} días`}</span>` : '<span class="t-n m">Terminados</span>'}</span><span class="t-der">${ultT ? `${esc(ultT.nombre)} ${testCompleto(ultT.id) ? '✓' : '· pendiente'}` : ''}</span></span></button>`;
  return h;
}

// --- mini gráficos de las tarjetas ---
function sparkline(vals, banda) {
  const W = 300, H = 60;
  let min = Math.min(...vals, ...(banda || []));
  let max = Math.max(...vals, ...(banda || []));
  if (min === max) { min -= 1; max += 1; }
  const y = (v) => 6 + ((max - v) / (max - min)) * (H - 12);
  const x = (i) => (i / (vals.length - 1)) * (W - 8) + 4;
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="spark" aria-hidden="true">${banda ? `<rect x="0" y="${y(banda[1])}" width="${W}" height="${y(banda[0]) - y(banda[1])}" fill="rgba(166,207,184,.18)"/>` : ''}<polyline points="${pts}" fill="none" stroke="#F4F3EF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="5" fill="#E7FE55"/></svg>`;
}
function miniPuntos(vals) {
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  return `<span class="mini-puntos">${vals.map((v) => `<i style="margin-top:${Math.round(((max - v) / (max - min)) * 24) - 12}px"></i>`).join('')}</span>`;
}

// --- Peso ---
function detallePeso() {
  const dISO = iso(hoy());
  const pts = Object.keys(DB.peso).filter((f) => f <= dISO && enPeriodo(f) && num(DB.peso[f]) != null).sort().map((f) => ({ f, v: num(DB.peso[f]) }));
  const aj = ajustePeso(dISO);
  let h = cabDetalle('Peso') + selPeriodo();
  const ult = pts[pts.length - 1];
  h += `<section class="t alta heroe-det" style="background-color:var(--cuerpo)"><span class="t-k">${ult ? `Último pesaje · ${fechaCorta(ult.f)}` : 'Peso en ayunas'}</span>
    <span class="heroe-n"><span class="dot">${ult ? fmt(ult.v) : '—'}</span><span class="heroe-u">kg</span></span>
    <span class="t-u">Objetivo: ${P.tests.pesoObjetivo.join('–')} kg en enero</span>`;
  if (pts.length) {
    const media = pts.map((p) => { const desde = iso(addDays(parseISO(p.f), -6)); const v = pts.filter((q) => q.f >= desde && q.f <= p.f).map((q) => q.v); return { f: p.f, v: v.reduce((a, b) => a + b, 0) / v.length }; });
    h += graficoSerie(pts, { linea: media, banda: P.tests.pesoObjetivo, unidad: 'kg' });
  }
  h += `<span class="sugerencia${aj.tipo === 'warn' ? ' aviso-s' : ''}">${esc(aj.txt)}</span></section>`;
  h += `<p class="k guia-t">Reglas de ajuste</p><div class="guia lista-reglas">${P.reglas.ajuste.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`;
  if (pts.length) h += `<p class="k guia-t">Pesajes</p><div class="guia">${pts.slice().reverse().slice(0, 14).map((p) => `<div class="fr"><span>${esc(cap(fechaMedia(parseISO(p.f))))}</span><span class="v">${fmt(p.v)} kg</span></div>`).join('')}</div>`;
  return h;
}

// --- Sueño y pulso ---
function detalleSueno() {
  const dISO = iso(hoy());
  const noches = Object.keys(DB.salud).filter((f) => f <= dISO && enPeriodo(f)).sort();
  const s = DB.salud[dISO] || DB.salud[noches[noches.length - 1]] || {};
  const fS = DB.salud[dISO] ? dISO : noches[noches.length - 1];
  let h = cabDetalle('Sueño y pulso') + selPeriodo();
  if (!noches.length) return `${h}<section class="c vacio-det"><p>Todavía no hay datos del Garmin. Traelos desde Hoy con "Traer" y "Pegar".</p></section>`;
  const conH = noches.filter((f) => DB.salud[f].horas != null);
  // sueño
  h += `<section class="t alta heroe-det" style="background-color:var(--sueno)"><span class="t-k">${fS === dISO ? 'Anoche' : `Noche al ${fechaCorta(fS)}`}</span>
    <span class="heroe-n"><span class="dot">${s.horas != null ? hm(s.horas) : '—'}</span></span>
    <span class="t-u">horas dormido · meta 7:30–8:00</span>
    ${conH.length ? barrasSueno(conH.map((f) => DB.salud[f].horas)) : ''}
    ${s.profundo != null ? `<div class="chips3"><span class="chip3"><span class="k">Profundo</span><b>${fmtMin(s.profundo)}</b></span><span class="chip3"><span class="k">REM</span><b>${fmtMin(s.rem)}</b></span><span class="chip3"><span class="k">Despierto</span><b>${fmtMin(s.despierto)}</b></span></div>` : ''}
  </section>`;
  // pulso
  const conF = noches.filter((f) => DB.salud[f].fcr != null);
  if (conF.length) {
    const r = recuperacion(fS);
    const base = r?.base;
    const vals = conF.map((f) => DB.salud[f].fcr);
    const hoyF = DB.salud[fS]?.fcr;
    const dif = base != null && hoyF != null ? hoyF - base : null;
    h += `<section class="t heroe-det izq" style="background-color:var(--pulso)">
      <span class="t-fila"><span class="t-k">Pulso en reposo</span><span class="t-der">${base != null ? `tu promedio: ${Math.round(base)}` : 'necesita 3 días para el promedio'}</span></span>
      ${puntosPulso(vals, base)}
      <span class="t-fila"><span><span class="t-n">${hoyF ?? '—'}</span><span class="t-u"> lpm hoy</span></span><span class="t-der">${dif != null ? `${dif >= 0 ? '+' : ''}${fmt(dif, 0)} sobre tu promedio<br>${dif >= 8 ? 'alto: día suave' : dif >= 4 ? 'algo alto' : 'normal'}` : ''}</span></span>
    </section>`;
  }
  // horario
  h += graficoHorario(noches.filter((f) => DB.salud[f].inicio && DB.salud[f].fin).slice(-14));
  return h;
}
function barrasSueno(vals) {
  const W = 300, H = 120, top = 9.5;
  const n = Math.min(vals.length, 28);
  const v = vals.slice(-n);
  const paso = W / n;
  const ancho = Math.max(4, Math.min(14, paso * 0.66));
  const y = (h) => H - (Math.min(h, top) / top) * H;
  return `<svg viewBox="0 0 ${W} ${H}" class="barras" role="img" aria-label="Horas dormido por noche"><rect x="0" y="${y(8)}" width="${W}" height="${y(7.5) - y(8)}" fill="rgba(231,254,85,.14)"/>${v.map((h, i) => `<rect x="${i * paso + (paso - ancho) / 2}" y="${y(h)}" width="${ancho}" height="${H - y(h)}" rx="4" fill="${i === v.length - 1 ? '#E7FE55' : 'rgba(244,243,239,.55)'}"/>`).join('')}</svg>`;
}
function puntosPulso(vals, base) {
  const W = 300, H = 70;
  const v = vals.slice(-28);
  let min = Math.min(...v, base ?? Infinity) - 2;
  let max = Math.max(...v, base ?? -Infinity) + 2;
  const y = (x) => 6 + ((max - x) / (max - min)) * (H - 12);
  const x = (i) => (v.length === 1 ? W / 2 : 6 + (i / (v.length - 1)) * (W - 12));
  return `<svg viewBox="0 0 ${W} ${H}" class="barras" role="img" aria-label="Pulso en reposo por día">${base != null ? `<line x1="0" y1="${y(base)}" x2="${W}" y2="${y(base)}" stroke="rgba(244,243,239,.35)" stroke-dasharray="3 5"/>` : ''}${v.map((p, i) => (i === v.length - 1 ? `<circle cx="${x(i)}" cy="${y(p)}" r="5.5" fill="#E7FE55"/>` : `<circle cx="${x(i)}" cy="${y(p)}" r="3.5" fill="#F4F3EF"/>`)).join('')}</svg>`;
}

// --- Ejercicios ---
function seriesEjercicios() {
  const series = {};
  for (const f of Object.keys(DB.logs).sort()) {
    for (const [id, e] of Object.entries(DB.logs[f])) {
      const w = pesoMax(e);
      if (w == null || !(e.d || []).some(Boolean)) continue;
      (series[id] ||= []).push({ f, v: w, e });
    }
  }
  return series;
}
const nombreEj = (id) => { const n = nombresEjercicios(); const [base, casa] = id.split('@'); return `${n[base] || base}${casa ? ' (casa)' : ''}`; };
// Definición del plan para un ejercicio registrado (para sugerir el próximo peso y la técnica).
function ejDef(logId) {
  const [base, casa] = logId.split('@');
  for (const k in P.sesiones) {
    for (const it of P.sesiones[k].items) {
      const v = it.id === base ? it : it.casa?.id === base ? { ...it, ...it.casa } : it.alt?.id === base ? { ...it, ...it.alt } : null;
      if (v) return { ...v, id: base, logId, enCasa: !!casa };
    }
  }
  return { id: base, logId, nombre: base, enCasa: !!casa };
}
function detalleEjercicios() {
  const series = seriesEjercicios();
  const ids = Object.keys(series).sort((a, b) => nombreEj(a).localeCompare(nombreEj(b)));
  let h = cabDetalle('Ejercicios');
  h += `<div class="guia">${ids.map((id) => `<button type="button" class="fr" data-ej="${esc(id)}"><span>${esc(nombreEj(id))}</span><span class="fr-d"><span class="v">${fmt(Math.max(...series[id].map((p) => p.v)))} kg · ${series[id].length} ses.</span>${CHEV}</span></button>`).join('') || '<p class="mut">Todavía no hay pesos registrados.</p>'}</div>`;
  return h;
}
function detalleEjercicio() {
  const series = seriesEjercicios();
  const base = ejSel.split('@')[0];
  const variantes = [base, `${base}@casa`].filter((id) => series[id]);
  const id = variantes.includes(ejLugar) ? ejLugar : series[ejSel] ? ejSel : variantes[0] || ejSel;
  const x = ejDef(id);
  const pts = series[id] || [];
  let h = cabDetalle(nombreEj(base));
  if (variantes.length > 1) h += `<div class="segm" role="group" aria-label="Versión">${variantes.map((v) => `<button type="button" class="${v === id ? 'on' : ''}" data-ej-lugar="${esc(v)}">${v.includes('@casa') ? 'Casa' : 'Gimnasio'}</button>`).join('')}</div>`;
  if (!pts.length) return `${h}<section class="c vacio-det"><p>Todavía no hay pesos registrados para este ejercicio.</p></section>`;
  const mejor = Math.max(...pts.map((p) => p.v));
  const dl = mejor - pts[0].v;
  const ult = pts[pts.length - 1];
  const sub = evaluarSubida(x, ult.e);
  const tope = topeReps(x);
  const prox = sub ? (sub.w ? `Próxima vez: ${sub.w} kg.` : `Próxima vez: ${sub.txt}`) : tope ? `Para subir: completá ${ult.e.n || x.series || ''} × ${tope} con ${fmt(pesoMax(ult.e))} kg.` : '';
  h += `<section class="t alta heroe-det" style="background-color:var(--entreno)"><span class="t-k">Mejor peso</span>
    <span class="heroe-n"><span class="dot">${fmt(mejor)}</span><span class="heroe-u">kg</span></span>
    <span class="t-u">${dl > 0 ? `▲ ${fmt(dl)} kg desde el ${fechaCorta(pts[0].f)}` : `desde el ${fechaCorta(pts[0].f)}`}</span>
    ${pts.length > 1 ? graficoSerie(pts, { unidad: 'kg' }) : ''}
    ${prox ? `<span class="sugerencia">${esc(prox)}</span>` : ''}
  </section>`;
  h += `<p class="k guia-t">Sesiones</p><div class="guia">${pts.slice().reverse().map((p) => `<button type="button" class="fr" data-ver-dia-ir="${p.f}"><span>${esc(cap(fechaMedia(parseISO(p.f))))}</span><span class="fr-d"><span class="v">${p.e.n || ''} × ${fmt(p.v)} kg${p.e.r ? ` · ${p.e.r.filter(Boolean).join('-')}` : ''}</span>${CHEV}</span></button>`).join('')}</div>`;
  const tec = tecDe(x);
  if (tec) h += `<div class="guia" style="margin-top:10px"><details class="guia-f"><summary><span>Técnica y video</span><span class="fr-d">${CHEV}</span></summary><div class="guia-c">${tecHTML(tec)}</div></details></div>`;
  return h;
}

// --- Tests ---
function detalleTests() {
  const dISO = iso(hoy());
  if (!testSel) {
    const pasados = P.tests.fechas.filter((t) => t.fecha <= dISO);
    testSel = (pasados[pasados.length - 1] || P.tests.fechas[0]).id;
  }
  const t = DB.tests[testSel] || {};
  const tInfo = P.tests.fechas.find((x) => x.id === testSel);
  let h = cabDetalle('Tests');
  h += `<div class="segm">${P.tests.fechas.map((x) => `<button type="button" class="${x.id === testSel ? 'on' : ''}" data-test="${x.id}">${esc(x.nombre.replace('de ', ''))}${testCompleto(x.id) ? ' ✓' : ''}</button>`).join('')}</div>`;
  h += `<section class="c tests"><h3>Test · ${esc(tInfo.nombre)} <small>${fechaCorta(tInfo.fecha)}</small></h3>`;
  for (const c of P.tests.campos) {
    if (c.tres) {
      const promP = valorTest(testSel, 'peso');
      h += `<div class="campo"><label>${esc(c.nombre)} <small>${esc(c.nota)}</small></label>
        <div class="tres">${[1, 2, 3].map((i) => `<input type="text" inputmode="decimal" data-tc="peso${i}" value="${esc(t['peso' + i] || '')}" placeholder="Día ${i}" aria-label="Peso día ${i}">`).join('')}</div>
        <p class="prom">Promedio: <b id="prom-peso">${promP == null ? '—' : fmt(promP) + ' kg'}</b></p></div>`;
    } else {
      h += `<div class="campo fila"><label>${esc(c.nombre)} <small>${esc(c.nota)}</small></label>
        <div class="kg-box"><input type="text" inputmode="decimal" data-tc="${c.id}" value="${esc(t[c.id] || '')}" aria-label="${esc(c.nombre)}"><span>${esc(c.unidad)}</span></div></div>`;
    }
  }
  h += `<button type="button" class="check-foto${t.foto ? ' on' : ''}" data-accion="foto">${t.foto ? '✓' : '○'} Foto de frente y de costado</button><p class="mut chico">La foto queda en tu galería, no en la app.</p></section>`;
  h += `<p class="k guia-t">Evolución</p><section class="c">
    <div class="segmentos chico">${P.tests.campos.map((c) => `<button type="button" class="${c.id === campoSel ? 'on' : ''}" data-campo="${c.id}">${esc(c.nombre)}</button>`).join('')}</div>
    <div id="grafico">${grafico(campoSel)}</div></section>`;
  return h;
}

// --- Ajustes y backup ---
function detalleAjustes() {
  const nc = nubeCfg();
  const resp = localStorage.getItem(`${KEY}.respaldo.fecha`);
  let h = cabDetalle('Ajustes y backup');
  h += `<p class="k guia-t">Copia en la nube</p><section class="c">
    ${nc.token ? `<p class="meta">${nc.ultima ? `Última copia ${hace(nc.ultima)}.` : 'Todavía no se subió ninguna copia.'}${nc.error ? ` <span class="warn">Último intento falló (${esc(nc.error)}).</span>` : ''} Se sube sola cuando hay cambios.</p>
      <div class="dos"><button type="button" class="secund" data-accion="nube-subir">Subir ahora</button><button type="button" class="secund" data-accion="nube-traer">Traer de la nube</button></div>
      <button type="button" class="link chico" data-accion="nube-salir">Desconectar</button>`
    : `<p class="meta">Guarda una copia automática en tu repo privado de GitHub. Pegá la clave una sola vez.</p>
      <label class="cn ancho"><span>Clave de GitHub</span><input id="nube-token" type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <button type="button" class="secund" data-accion="nube-conectar">Conectar</button>`}
  </section>
  <p class="k guia-t">Archivo</p><section class="c">
    <p class="meta">Exportá un backup cada tanto y guardalo en Archivos o mandátelo por mail.</p>
    <div class="dos"><button type="button" class="secund" data-accion="exportar">Exportar</button><button type="button" class="secund" data-accion="importar">Importar</button></div>
    <input type="file" id="archivo" accept="application/json,.json" hidden>
    ${resp ? `<p class="meta" style="margin-top:12px">Copia local automática: ${esc(new Date(resp).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))}. <button type="button" class="link chico" data-accion="restaurar-local">Restaurar</button></p>` : ''}
  </section>`;
  return h;
}

// ---------- peso diario ----------
const prom = (v) => v.reduce((a, b) => a + b, 0) / v.length;
function semanasPeso(hastaISO) {
  const map = {};
  for (const [f, v] of Object.entries(DB.peso)) {
    const n = num(v);
    if (n == null || f > hastaISO) continue;
    (map[iso(lunesDe(parseISO(f)))] ||= []).push(n);
  }
  return Object.keys(map).sort().map((l) => ({ l, prom: prom(map[l]), n: map[l].length }));
}
// Aplica las reglas de ajuste del plan con los promedios semanales.
function ajustePeso(dISO) {
  const sem = semanasPeso(dISO).filter((x) => x.n >= 3);
  if (sem.length < 2) return { txt: 'Pesate 3 mañanas por semana: con 2 semanas te digo si vas en ritmo.', tipo: '', corto: 'Pesate 3 veces\npor semana' };
  const d1 = sem[sem.length - 1].prom - sem[sem.length - 2].prom;
  const d2 = sem.length >= 3 ? sem[sem.length - 2].prom - sem[sem.length - 3].prom : null;
  const vs = `${d1 > 0 ? '+' : '−'}${fmt(Math.abs(d1))} kg vs semana anterior`;
  if (d1 < -0.5) return { txt: `Bajaste ${fmt(-d1)} kg en la última semana (más de 0,5): subí 150 kcal.`, tipo: 'warn', corto: `Subí 150 kcal\n${vs}` };
  if (d2 != null && Math.abs(d1) < 0.15 && Math.abs(d2) < 0.15) return { txt: 'Peso sin moverse 2 semanas: bajá 150 kcal.', tipo: 'warn', corto: 'Sin moverse 2 semanas\nBajá 150 kcal' };
  if (d1 > 0.15) return { txt: `Subiste ${fmt(d1)} kg en la última semana. Revisá salidas y comida libre.`, tipo: 'warn', corto: `Subiendo\n${vs}` };
  if (d1 <= -0.2) return { txt: `Vas en ritmo: ${fmt(-d1)} kg menos que la semana anterior.`, tipo: 'ok', corto: `Vas en ritmo\n${vs}` };
  return { txt: `Última semana: ${d1 > 0 ? '+' : ''}${fmt(d1)} kg. El objetivo es bajar 0,25–0,4 por semana.`, tipo: '', corto: vs };
}
// Horario de sueño: una barra por noche, de la hora en que te dormiste a la que te despertaste.
function graficoHorario(fechas) {
  if (!fechas.length) return '';
  const hs = (t) => { const d = new Date(t); let x = d.getHours() + d.getMinutes() / 60; if (x < 18) x += 24; return x; }; // 18 → 42
  const hora = (x) => { const m = Math.round((x % 24) * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const noches = fechas.map((f) => ({ f, a: hs(DB.salud[f].inicio), b: hs(DB.salud[f].fin) }));
  const lo = Math.floor(Math.min(...noches.map((n) => n.a)) - 0.5);
  const hi = Math.ceil(Math.max(...noches.map((n) => n.b)) + 0.5);
  const W = 340, H = 190, L = 40, R = 10, T = 10, B = 22;
  const y = (v) => T + ((v - lo) / (hi - lo)) * (H - T - B);
  const paso = (W - L - R) / noches.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="svg-g" role="img" aria-label="Horario de sueño por noche">`;
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/><text x="${L - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${hora(v)}</text>`;
  noches.forEach((n, i) => {
    const x = L + i * paso + paso * 0.2;
    svg += `<rect x="${x}" y="${y(n.a)}" width="${paso * 0.6}" height="${Math.max(2, y(n.b) - y(n.a))}" rx="${Math.min(6, paso * 0.3)}" class="g-noche${i === noches.length - 1 ? ' ult' : ''}"/>`;
  });
  svg += `<text x="${L}" y="${H - 6}" class="g-eje">${fechaCorta(noches[0].f)}</text><text x="${W - R}" y="${H - 6}" class="g-eje" text-anchor="end">${fechaCorta(noches[noches.length - 1].f)}</text></svg>`;
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const desvio = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
  const dA = desvio(noches.map((n) => n.a));
  const txt = noches.length < 3 ? 'Con unas noches más te muestro cuánto varía tu horario.'
    : `Te dormís en promedio a las ${hora(media(noches.map((n) => n.a)))} y te despertás a las ${hora(media(noches.map((n) => n.b)))}. Variación: ±${fmtMin(Math.round(dA * 60))}${dA > 1 ? ' (bastante; acercar los horarios suele mejorar cómo te sentís)' : ''}.`;
  return `<section class="c horario"><span class="t-fila"><span class="t-k">Horario de sueño</span><span class="k">${noches.length >= 3 ? `±${fmtMin(Math.round(dA * 60))}` : ''}</span></span>${svg}<p class="meta">${esc(txt)}</p></section>`;
}

// ---------- historial por ejercicio ----------
let ejSel = null;
function nombresEjercicios() {
  const n = { ...(P.retirados || {}) };
  for (const k in P.sesiones) {
    for (const it of P.sesiones[k].items) {
      if (!it.id) continue;
      n[it.id] = it.nombre;
      if (it.casa?.id) n[it.casa.id] = it.casa.nombre;
    }
  }
  return n;
}
// Gráfico de una serie de fechas: puntos, línea opcional (tendencia) y banda objetivo.
function graficoSerie(pts, { linea, banda, unidad } = {}) {
  const W = 340, H = 170, L = 38, R = 14, T = 16, B = 24;
  const f0 = parseISO(pts[0].f);
  const dias = (f) => Math.round((parseISO(f) - f0) / 864e5);
  const span = Math.max(1, dias(pts[pts.length - 1].f));
  const vals = pts.map((p) => p.v).concat(banda || []);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;
  const x = (f) => (pts.length === 1 ? (L + W - R) / 2 : L + (dias(f) / span) * (W - L - R));
  const y = (v) => T + ((max - v) / (max - min)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="svg-g" role="img" aria-label="Evolución en ${unidad}">`;
  for (let k = 0; k <= 2; k++) {
    const v = min + ((max - min) * k) / 2;
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/><text x="${L - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${fmt(v)}</text>`;
  }
  if (banda) s += `<rect x="${L}" width="${W - L - R}" y="${y(banda[1])}" height="${y(banda[0]) - y(banda[1])}" class="g-obj"/>`;
  s += `<text x="${L}" y="${H - 6}" class="g-eje">${fechaCorta(pts[0].f)}</text>`;
  if (pts.length > 1) s += `<text x="${W - R}" y="${H - 6}" class="g-eje" text-anchor="end">${fechaCorta(pts[pts.length - 1].f)}</text>`;
  const ln = linea || (pts.length > 1 ? pts : null);
  if (ln && ln.length > 1) s += `<polyline points="${ln.map((p) => `${x(p.f)},${y(p.v)}`).join(' ')}" class="g-linea"/>`;
  pts.forEach((p, i) => { s += i === pts.length - 1 ? `<circle cx="${x(p.f)}" cy="${y(p.v)}" r="5.5" class="g-ult"/>` : `<circle cx="${x(p.f)}" cy="${y(p.v)}" r="${linea ? 2.5 : 4}" class="${linea ? 'g-dia' : 'g-punto'}"/>`; });
  const ultimo = pts[pts.length - 1];
  s += `<text x="${Math.min(x(ultimo.f), W - R - 14)}" y="${y(ultimo.v) - 8}" class="g-val" text-anchor="middle">${fmt(ultimo.v)}</text>`;
  return `${s}</svg>`;
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

// ---------- copia en la nube (repo privado de GitHub) ----------
const NUBE = { repo: 'nico-caride/entreno-datos', archivo: 'datos.json' };
const nubeCfg = () => { try { return JSON.parse(localStorage.getItem(`${KEY}.nube`)) || {}; } catch (e) { return {}; } };
const setNube = (c) => { try { localStorage.setItem(`${KEY}.nube`, JSON.stringify({ ...nubeCfg(), ...c })); } catch (e) { /* nada */ } };
const b64 = (t) => btoa(unescape(encodeURIComponent(t)));
const deB64 = (b) => decodeURIComponent(escape(atob(b.replace(/\s/g, ''))));
function ghFetch(metodo, cuerpo, token = nubeCfg().token) {
  return fetch(`https://api.github.com/repos/${NUBE.repo}/contents/${NUBE.archivo}`, {
    method: metodo,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}
let subiendo = false;
async function subirNube(manual) {
  if (DEMO) { if (manual) toast('Modo demo: no se sube nada'); return; }
  const cfg = nubeCfg();
  if (!cfg.token || subiendo) return;
  if (!navigator.onLine) { if (manual) toast('Sin conexión'); return; }
  subiendo = true;
  try {
    const contenido = JSON.stringify({ app: 'entreno', version: 2, fecha: new Date().toISOString(), datos: DB });
    const put = (sha) => ghFetch('PUT', { message: `Copia ${new Date().toISOString().slice(0, 16)}`, content: b64(contenido), ...(sha ? { sha } : {}) });
    let r = await put(cfg.sha);
    if (r.status === 409 || r.status === 422) {
      const g = await ghFetch('GET');
      r = await put(g.ok ? (await g.json()).sha : null);
    }
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    setNube({ sha: j.content.sha, ultima: Date.now(), error: null });
    if (manual) toast('Copia subida a la nube');
  } catch (e) {
    setNube({ error: e.message });
    if (manual) toast(e.message === '401' ? 'La clave no sirve o venció' : 'No se pudo subir la copia');
  } finally {
    subiendo = false;
    if (manual && tab === 'progreso') render('progreso', true);
  }
}
// Sube sola si hubo cambios y pasaron 10 minutos desde la última copia.
function autoNube() {
  if (DEMO) return;
  const cfg = nubeCfg();
  if (!cfg.token) return;
  const cambio = +localStorage.getItem(`${KEY}.cambio`) || 0;
  if (cambio > (cfg.ultima || 0) && Date.now() - (cfg.ultima || 0) > 10 * 6e4) subirNube(false);
}
const hace = (ts) => {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 48 * 60) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} días`;
};
function reemplazarDatos(datos) {
  DB = Object.assign(blank(), datos);
  armarALI();
  cantGuardada = 0; // es una restauración a propósito: no aplica el candado
  save();
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
      reemplazarDatos(datos);
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
  if (sinClick) { sinClick = false; ev.preventDefault(); return; }
  const filaDia = ev.target.closest('[data-abrir]');
  if (filaDia && !propuesta) {
    const body = filaDia.parentElement.querySelector('.dia-body');
    body.hidden = !body.hidden;
    diaAbierto = body.hidden ? null : filaDia.dataset.abrir;
    return;
  }
  const el = ev.target.closest('button, summary');
  if (!el) return;
  const dISO = iso(hoy());
  const fC = comidaDia && comidaDia < dISO ? comidaDia : dISO; // fecha con la que trabaja Comida

  if (el.dataset.tab) {
    propuesta = null;
    // tocar una pestaña de la barra vuelve a hoy
    if (el.closest('.nav')) { diaVer = null; comidaDia = null; semanaVista = 0; semanaS = 0; resumenDia = null; detalle = null; volverA = null; }
    return render(el.dataset.tab);
  }

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

  if (el.dataset.opcion) {
    const [base, k] = el.dataset.opcion.split('|');
    const ent = DB.entrenos[dISO];
    (ent.cambios ||= {})[base] = k;
    const nuevo = ejerciciosDe(armarSesion(hoy())).find((x) => x.base === base);
    if (nuevo) ent.actual = nuevo.logId;
    save();
    render('entreno', true);
    irAlActual();
    return toast(`Cambiado por: ${nuevo?.nombre || ''}`);
  }
  if (el.dataset.lugar) { lugarSel = el.dataset.lugar; return render('inicio', true); }

  if (el.dataset.ali) { aliSel = aliSel === el.dataset.ali ? null : el.dataset.ali; editAli = null; return render('nutri', true); }
  if (el.dataset.add) {
    const [id, c] = el.dataset.add.split('|');
    (DB.comida[fC] ||= []).push({ id, c: +c, m: pickerMom || 'extras', t: Date.now() });
    save();
    aliSel = null;
    render('nutri', true);
    return toast(`Agregado: ${fmtC(+c)} × ${ALI[id].nombre}`);
  }
  if (el.classList.contains('item-n')) {
    editEnt = editEnt === +el.dataset.editEnt ? null : +el.dataset.editEnt;
    return render('nutri', true);
  }
  if (el.dataset.guardarEnt) {
    const [i, modo] = el.dataset.guardarEnt.split('|');
    const e = DB.comida[fC][+i];
    const pv = num($('#ee-p').value);
    const kv = num($('#ee-k').value);
    if (pv == null || kv == null) return toast('Poné proteína y calorías');
    if (modo === 'siempre') {
      DB.aliEdit[e.id] = { prot: Math.round((pv / e.c) * 10) / 10, kcal: Math.round(kv / e.c) };
      delete e.p; delete e.k;
      armarALI();
    } else { e.p = pv; e.k = kv; }
    editEnt = null;
    save();
    render('nutri', true);
    return toast(modo === 'siempre' ? `Guardado: ${ALI[e.id].nombre} ahora tiene ${fmt(ALI[e.id].prot)} g · ${ALI[e.id].kcal} kcal` : 'Corregido');
  }
  if (el.dataset.editAli) { editAli = editAli === el.dataset.editAli ? null : el.dataset.editAli; return render('nutri', true); }
  if (el.dataset.guardarAli) {
    const id = el.dataset.guardarAli;
    const pv = num($('#ed-p').value);
    const kv = num($('#ed-k').value);
    if (pv == null || kv == null) return toast('Poné proteína y calorías');
    const mio = DB.misAli.find((a) => a.id === id);
    if (mio) { mio.prot = pv; mio.kcal = kv; } else DB.aliEdit[id] = { prot: pv, kcal: kv };
    editAli = null;
    save(); armarALI();
    render('nutri', true);
    return toast('Valores guardados');
  }
  if (el.dataset.resetAli) { delete DB.aliEdit[el.dataset.resetAli]; editAli = null; save(); armarALI(); return render('nutri', true); }
  if (el.dataset.borrarAli) {
    if (!confirm('¿Borrar este alimento? Lo que ya cargaste con él deja de contar.')) return;
    DB.misAli = DB.misAli.filter((a) => a.id !== el.dataset.borrarAli);
    aliSel = null; editAli = null;
    save(); armarALI();
    return render('nutri', true);
  }
  if (el.dataset.tipo) {
    const c = P.comidasTipo[+el.dataset.tipo];
    c.items.forEach(([id, n]) => (DB.comida[fC] ||= []).push({ id, c: n, m: el.dataset.mom, t: Date.now() }));
    save();
    render('nutri', true);
    return toast(`Agregado: ${c.nombre}`);
  }
  if (el.dataset.borrar) { (DB.comida[fC] || []).splice(+el.dataset.borrar, 1); editEnt = null; save(); return render('nutri', true); }
  if (el.dataset.borrarProt) { (DB.prot[fC] || []).splice(+el.dataset.borrarProt, 1); save(); return render('nutri', true); }
  if (el.dataset.picker) { pickerMom = pickerMom === el.dataset.picker ? null : el.dataset.picker; aliSel = null; catSel = null; busqueda = ''; creando = false; editAli = null; return render('nutri', true); }
  if (el.dataset.cat) { catSel = el.dataset.cat; aliSel = null; return render('nutri', true); }

  if (el.dataset.test) { testSel = el.dataset.test; return render('progreso', true); }
  if (el.dataset.campo) { campoSel = el.dataset.campo; return render('progreso', true); }

  if (el.dataset.sesion) {
    const msg = cambiarDia(hoy(), el.dataset.sesion);
    render('inicio');
    toast(msg ? `Semana reacomodada: ${msg}` : 'Listo, cambiado');
    return;
  }
  if (el.hasAttribute('data-semana-s')) {
    semanaS = el.dataset.semanaS === '0' ? 0 : semanaS + (+el.dataset.semanaS);
    diaAbierto = null;
    return render('semana', true);
  }
  if (el.hasAttribute('data-semana')) {
    semanaVista = el.dataset.semana === '0' ? 0 : semanaVista + (+el.dataset.semana);
    return render(tab, true);
  }
  if (el.dataset.verDia) {
    diaVer = el.dataset.verDia === dISO ? null : el.dataset.verDia;
    if (!diaVer) semanaVista = 0;
    return render('inicio');
  }
  if (el.dataset.comidaDia) {
    comidaDia = el.dataset.comidaDia === 'hoy' || el.dataset.comidaDia === dISO ? null : el.dataset.comidaDia;
    if (!comidaDia) semanaVista = 0;
    else semanaVista = Math.min(0, Math.floor((parseISO(iso(lunesDe(parseISO(comidaDia)))) - parseISO(iso(lunesDe(hoy())))) / (7 * 864e5)));
    pickerMom = null; editEnt = null;
    return render('nutri');
  }
  if (el.dataset.resumen) { resumenDia = el.dataset.resumen; return render('resumen'); }
  if (el.dataset.cambiarDia) { diaAbierto = el.dataset.cambiarDia; semanaS = 0; return render('semana'); }
  if (el.dataset.ej || el.dataset.historial) {
    ejSel = el.dataset.ej || el.dataset.historial;
    ejLugar = null;
    volverA = tab === 'progreso' ? { tab: 'progreso', detalle } : { tab };
    detalle = 'ejercicio';
    return render('progreso');
  }
  if (el.dataset.ejLugar) { ejLugar = el.dataset.ejLugar; return render('progreso', true); }
  if (el.dataset.detalle) {
    volverA = tab === 'progreso' ? { tab: 'progreso', detalle: detalle } : { tab };
    detalle = el.dataset.detalle;
    return render('progreso');
  }
  if (el.dataset.periodo) { periodo = +el.dataset.periodo; return render('progreso', true); }
  if (el.dataset.verDiaIr) {
    diaVer = el.dataset.verDiaIr;
    semanaVista = Math.min(0, Math.round((parseISO(iso(lunesDe(parseISO(diaVer)))) - parseISO(iso(lunesDe(hoy())))) / (7 * 864e5)));
    return render('inicio');
  }
  if (el.dataset.ignorarPadel) { DB.garmin.ignorados.push(el.dataset.ignorarPadel); save(); return render('inicio', true); }
  if (el.dataset.poner) {
    const [f, k] = el.dataset.poner.split('|');
    propuesta = reorganizar(parseISO(f), k, null);
    return render('semana');
  }
  if (el.dataset.mover) {
    const [a, b] = el.dataset.mover.split('|').map(parseISO);
    return proponer(a, b);
  }

  const acc = el.dataset.accion;
  if (!acc) return;
  const ent = DB.entrenos[dISO];
  if (acc === 'ver-opciones') { const o = el.closest('article').querySelector('.opc-ej'); o.hidden = !o.hidden; return; }
  if (acc === 'ver-tec') { const o = el.closest('article').querySelector(':scope > .tec'); o.hidden = !o.hidden; return; }
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
    resumenDia = null;
    if (ent) { ent.fin = Date.now(); save(); setTimeout(() => subirNube(false), 500); }
    return render('resumen');
  }
  if (acc === 'det-volver') {
    const v = volverA || { tab: 'progreso', detalle: null };
    volverA = null;
    detalle = v.tab === 'progreso' ? (v.detalle && v.detalle !== detalle ? v.detalle : null) : null;
    render(v.tab);
    if (v.tab === 'entreno') irAlActual();
    return;
  }
  if (acc === 'resumen') { resumenDia = null; return render('resumen'); }
  if (acc === 'volver-resumen') { const f = resumenDia; resumenDia = null; diaVer = f; return render('inicio'); }
  if (acc === 'reabrir') { if (ent) { delete ent.fin; save(); } return render('entreno'); }
  if (acc === 'confirmar-prop') { aplicar(propuesta); const m = textoCambios(propuesta); propuesta = null; render('semana', true); return toast(m ? `Listo: ${m}` : 'Listo'); }
  if (acc === 'cancelar-prop') { propuesta = null; return render('semana', true); }
  if (acc === 'restaurar') { restaurarSemana(addDays(hoy(), semanaS * 7)); render('semana', true); return toast('Semana restaurada'); }

  if (acc === 'crear-ali') { creando = !creando; render('nutri', true); if (creando) $('#nv-n')?.focus(); return; }
  if (acc === 'guardar-nuevo') {
    const nombre = $('#nv-n').value.trim();
    const pv = num($('#nv-p').value);
    const kv = num($('#nv-k').value);
    const err = $('#nv-err');
    if (!nombre || pv == null || kv == null) { err.textContent = 'Completá nombre, proteína y calorías.'; err.hidden = false; return; }
    const id = `u-${Date.now()}`;
    DB.misAli.push({ id, nombre, porcion: $('#nv-po').value.trim() || '1 unidad', cat: 'Mis alimentos', prot: pv, kcal: kv });
    save(); armarALI();
    creando = false; busqueda = ''; catSel = 'Mis alimentos'; aliSel = id;
    render('nutri', true);
    return toast(`Creado: ${nombre}. Elegí cuánto comiste.`);
  }
  if (acc === 'correr-atajo') { location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(ATAJO)}`; return; }
  if (acc === 'pegar-garmin') {
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then(guardarSync).catch(() => { const t = $('#pegar-txt'); t.hidden = false; t.focus(); });
    } else { const t = $('#pegar-txt'); t.hidden = false; t.focus(); }
    return;
  }
  if (acc === 'crea') { DB.crea[fC] = !DB.crea[fC]; save(); return render('nutri', true); }
  if (acc === 'foto') { const t = (DB.tests[testSel] ||= {}); t.foto = !t.foto; save(); return render('progreso', true); }
  if (acc === 'nube-conectar') {
    const token = $('#nube-token').value.trim();
    if (!token) return toast('Pegá la clave primero');
    ghFetch('GET', null, token).then((r) => {
      if (r.status === 401 || r.status === 403) return toast('Esa clave no tiene permiso. Revisá los pasos.');
      setNube({ token, sha: null, error: null });
      if (r.ok) r.json().then((j) => setNube({ sha: j.sha }));
      subirNube(true);
    }).catch(() => toast('Sin conexión'));
    return;
  }
  if (acc === 'nube-subir') return subirNube(true);
  if (acc === 'nube-salir') { if (confirm('¿Desconectar la copia en la nube? Tus datos quedan en el celular.')) { localStorage.removeItem(`${KEY}.nube`); render('progreso', true); } return; }
  if (acc === 'nube-traer') {
    ghFetch('GET').then(async (r) => {
      if (!r.ok) return toast('No encontré una copia en la nube');
      const j = await r.json();
      const datos = JSON.parse(deB64(j.content));
      if (!confirm(`¿Reemplazar los datos del celular por la copia de la nube del ${new Date(datos.fecha).toLocaleString('es-AR')}?`)) return;
      reemplazarDatos(datos.datos || datos);
      setNube({ sha: j.sha });
      render('inicio');
      toast('Datos restaurados desde la nube');
    }).catch(() => toast('Sin conexión'));
    return;
  }
  if (acc === 'restaurar-local') {
    if (!confirm('¿Volver a la copia local automática? Se pierde lo que cargaste después.')) return;
    reemplazarDatos(JSON.parse(localStorage.getItem(`${KEY}.respaldo`)));
    render('inicio');
    return toast('Copia local restaurada');
  }
  if (acc === 'exportar') return exportar();
  if (acc === 'importar') return $('#archivo').click();
});

// ---------- arrastrar días en la semana ----------
function proponer(a, b) {
  if (iso(a) === iso(b) || bloqueado(b)) return;
  propuesta = reorganizar(b, claveDe(a), a);
  render('semana');
}
let arrastre = null;
let espera = null; // toque en una fila que todavía no es arrastre
let sinClick = false;
function empezarArrastre(fila, desde, y) {
  const r = fila.getBoundingClientRect();
  const fantasma = fila.cloneNode(true);
  fantasma.querySelector('.dia-body')?.remove();
  fantasma.classList.add('fantasma');
  Object.assign(fantasma.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` });
  document.body.appendChild(fantasma);
  fila.classList.add('origen');
  arrastre = { desde, fantasma, dy: y - r.top, destino: null };
  sinClick = true;
  try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* nada */ }
}
document.addEventListener('pointerdown', (ev) => {
  const zona = ev.target.closest('[data-arr]');
  if (!zona || propuesta) return;
  const fila = zona.closest('.dia');
  const desde = zona.dataset.arr;
  if (ev.target.closest('.asa')) { ev.preventDefault(); empezarArrastre(fila, desde, ev.clientY); return; }
  const x0 = ev.clientX;
  const y0 = ev.clientY;
  espera = { x0, y0, t: setTimeout(() => { espera = null; empezarArrastre(fila, desde, y0); }, 350) };
});
function moverArrastre(x, y) {
  arrastre.fantasma.style.top = `${y - arrastre.dy}px`;
  const bajo = document.elementFromPoint(x, y)?.closest('.dia[data-fecha]');
  document.querySelectorAll('.dia.destino').forEach((el) => el.classList.remove('destino'));
  arrastre.destino = null;
  if (bajo && !bajo.classList.contains('bloq') && bajo.dataset.fecha !== arrastre.desde) {
    bajo.classList.add('destino');
    arrastre.destino = bajo.dataset.fecha;
  }
  if (y < 90) window.scrollBy(0, -10);
  else if (y > window.innerHeight - 110) window.scrollBy(0, 10);
}
document.addEventListener('pointermove', (ev) => {
  if (espera && Math.hypot(ev.clientX - espera.x0, ev.clientY - espera.y0) > 10) { clearTimeout(espera.t); espera = null; }
  if (!arrastre) return;
  ev.preventDefault();
  moverArrastre(ev.clientX, ev.clientY);
}, { passive: false });
// En iPhone, frenar el scroll mientras arrastrás.
document.addEventListener('touchmove', (ev) => { if (arrastre) ev.preventDefault(); }, { passive: false });
function finArrastre() {
  if (espera) { clearTimeout(espera.t); espera = null; }
  if (!arrastre) return;
  const { desde, destino, fantasma } = arrastre;
  arrastre = null;
  setTimeout(() => { sinClick = false; }, 60); // solo ignora el click que sale de soltar el dedo
  fantasma.remove();
  document.querySelectorAll('.dia.origen, .dia.destino').forEach((x) => x.classList.remove('origen', 'destino'));
  if (destino) proponer(parseISO(desde), parseISO(destino));
}
document.addEventListener('pointerup', finArrastre);
document.addEventListener('pointercancel', finArrastre);
document.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-arr]')) ev.preventDefault(); });



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
  if (el.id === 'pegar-txt') { if (/ENTRENO/i.test(el.value)) guardarSync(el.value); return; }
  if (el.id === 'buscar') { busqueda = el.value; return filtrarAlimentos(el.value); }
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
  if (ev.target.id === 'ej-sel') { ejSel = ev.target.value; render('progreso', true); }
  if (ev.target.dataset.tc) $('#grafico').innerHTML = grafico(campoSel);
  if (ev.target.id === 'archivo' && ev.target.files[0]) importar(ev.target.files[0]);
});

// Si la app quedó abierta de un día para el otro, refresca
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (T.int) { tick(); pedirWakeLock(); }
  if (tab === 'entreno') pedirWakeLock();
  if (iso(hoy()) !== fechaRender) render(tab === 'entreno' || tab === 'resumen' ? 'inicio' : tab);
  autoNube();
});
setTimeout(autoNube, 3000);
setInterval(autoNube, 10 * 6e4);

// ---------- datos de ejemplo (?demo=1) ----------
function datosDemo() {
  const h0 = hoy();
  const desde = parseISO(P.lunesSemana1);
  let peso = 72.6;
  for (let d = new Date(desde); iso(d) < iso(h0); d = addDays(d, 1)) {
    const f = iso(d);
    const i = Math.round((d - desde) / 864e5);
    const S = armarSesion(d, 'gym');
    if (S.s.tipo !== 'descanso' && i % 9 !== 4) {
      const t0 = new Date(d); t0.setHours(19, 0, 0, 0);
      DB.entrenos[f] = { lugar: 'gym', inicio: +t0, fin: +t0 + (55 + (i % 4) * 5) * 6e4 };
      const log = (DB.logs[f] = {});
      ejerciciosDe(S).forEach((x, j) => {
        const n = x.series || 1;
        const e = { w: '', d: rango(n).map(() => true), n };
        if (!x.sinPeso && usaReps(x)) {
          const w = 10 + ((j * 7 + x.id.length * 3) % 40) + Math.floor(i / 7) * 2.5;
          e.k = rango(n).map(() => fmt(w));
          e.r = rango(n).map((k) => topeReps(x) - (k === n - 1 && i % 2 ? 1 : 0));
          e.t = topeReps(x);
          e.w = fmt(w);
        }
        log[x.logId] = e;
      });
    }
    DB.comida[f] = [{ id: 'huevo', c: 3, m: 'desayuno' }, { id: 'avena', c: 1, m: 'desayuno' }, { id: 'pollo', c: 2, m: 'almuerzo' }, { id: 'arroz', c: 1, m: 'almuerzo' }, { id: 'yogur', c: 1, m: 'pre' }, { id: 'carne', c: 2, m: 'cena' }, { id: 'papa', c: 1, m: 'cena' }];
    if (i % 2) DB.crea[f] = true;
    peso -= 0.04 + ((i * 13) % 7 - 3) * 0.03;
    if (i % 2 === 0) DB.peso[f] = fmt(peso);
    const dormir = new Date(d); dormir.setHours(23 + (i % 3), (i * 17) % 60, 0, 0);
    const horas = 6.5 + ((i * 7) % 5) * 0.35;
    DB.salud[iso(addDays(d, 1))] = { fcr: 55 + ((i * 3) % 5), horas, inicio: dormir.toISOString(), fin: new Date(+dormir + (horas + 0.4) * 36e5).toISOString(), profundo: 55 + (i % 4) * 10, rem: 80 + (i % 3) * 15, despierto: 20 + (i % 5) * 5, despertares: i % 3 };
  }
  const f0 = iso(h0);
  DB.comida[f0] = [{ id: 'huevo', c: 3, m: 'desayuno' }, { id: 'avena', c: 1, m: 'desayuno' }, { id: 'pollo', c: 2, m: 'almuerzo' }];
  DB.tests.t1 = { peso1: '72,6', peso2: '72,4', peso3: '72,5', cintura: '86', dominadas: '4', skierg: '1080', popups: '14', foto: true };
  DB.misAli = [{ id: 'u-demo', nombre: 'Prota (barrita)', porcion: '1 unidad', cat: 'Mis alimentos', prot: 23, kcal: 197 }];
  armarALI();
}
if (DEMO) datosDemo();

// Al abrir: si quedó un entrenamiento a medias hoy, vuelve directo a él.
const entHoy = DB.entrenos[iso(hoy())];
render(entHoy?.inicio && !entHoy.fin ? 'entreno' : 'inicio');
if (tab === 'entreno') irAlActual();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
