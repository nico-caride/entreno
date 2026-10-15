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
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return Object.assign(blank(), d);
  } catch (e) { /* sin datos */ }
  return blank();
}
let DB = load();
const VERSION = 10; // subirla junto con el ?v= de index.html
// Candado: si de golpe hay muchos menos registros que los guardados, no pisa los datos.
const cantidad = (d) => ['logs', 'comida', 'salud', 'peso', 'entrenos'].reduce((a, k) => a + Object.keys(d?.[k] || {}).length, 0);
let cantGuardada = cantidad(DB);
function save() {
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
  verde: 'Dormiste bien y el pulso está normal: entrená como está planeado.',
  amarillo: 'Primera ronda al 70 % y escuchá el cuerpo. Si no levanta, sacá una serie por ejercicio.',
  rojo: 'Pulso alto o poco sueño: hoy mejor zona 2 suave o descanso. Si te sentís mareado, cortá.',
};
function padelPendiente(d) {
  return diasSemana(d).map(iso).filter((f) => DB.garmin.padel.includes(f) && !DB.garmin.ignorados.includes(f) && claveDe(parseISO(f)) !== 'sabado');
}
function tarjetaGarmin(d, clave, ent) {
  const dISO = iso(d);
  const r = recuperacion(dISO);
  let h = '';
  if (r) {
    const z = zonaR(r.p);
    const fases = [r.profundo != null && `profundo ${fmtMin(r.profundo)}`, r.rem != null && `REM ${fmtMin(r.rem)}`, r.despierto != null && `despierto ${fmtMin(r.despierto)}`].filter(Boolean).join(', ');
    const det = [r.horas != null && `Dormiste ${fmtHoras(r.horas)}${fases ? ` (${fases})` : ''}`, r.fcr != null && `pulso en reposo ${r.fcr}${r.dif != null ? ` (${r.dif >= 0 ? '+' : ''}${fmt(r.dif, 0)} vs tu promedio)` : ''}`].filter(Boolean).join(' · ');
    h += `<p class="reco" style="--z:${COLOR_R[z]}">${esc(RECO_R[z])}<small class="det">${esc(det)}</small></p>`;
    if (z === 'rojo' && !['z2', 'domingo'].includes(clave) && !ent?.inicio) h += '<button type="button" class="link" data-sesion="z2">Cambiar hoy por zona 2 →</button>';
  }
  for (const f of padelPendiente(d)) {
    h += `<div class="aviso garmin">⌚ Garmin registró pádel el ${esc(diaNombre(parseISO(f)))} ${fechaCorta(f)}.
      <div class="dos"><button type="button" class="secund" data-ignorar-padel="${f}">Ignorar</button><button type="button" class="secund confirmar" data-poner="${f}|sabado">Marcar en la semana</button></div></div>`;
  }
  if (!DB.salud[dISO]) {
    h += `<div class="c garmin-sync"><span>⌚ <b>Datos del Garmin</b><small>Sueño y pulso de hoy</small></span>
      <span class="g-btns"><button type="button" class="secund" data-accion="correr-atajo">Traer</button><button type="button" class="secund confirmar" data-accion="pegar-garmin">Pegar</button></span></div>
      <details class="ayuda-g"><summary>¿Cómo funciona?</summary><p class="mut chico">"Traer" corre el Atajo "${ATAJO}" de tu iPhone, que copia el sueño y el pulso de la app Salud. Volvé con ◀ y tocá "Pegar". Si programaste el Atajo para que corra solo a la mañana, con "Pegar" alcanza.</p></details>
      <textarea id="pegar-txt" class="pegar-txt" hidden placeholder="Mantené apretado acá y pegá"></textarea>`;
  }
  return h;
}

// ---------- pantalla: INICIO ----------
const colorDe = (k) => P.sesiones[k].color || 'var(--acc)';
const tipoNombre = (s) => ({ fuerza: 'Fuerza', cardio: 'Cardio', descanso: 'Descanso' }[s.tipo] || '');
function vistaInicio() {
  const d = hoy();
  const dISO = iso(d);
  const S = armarSesion(d);
  const { s, E, clave } = S;
  const ent = DB.entrenos[dISO];
  const ejercicios = ejerciciosDe(S);
  const hechos = ejercicios.filter((x) => completo(x, dISO)).length;
  const { prot, kcal } = totales(dISO);
  const metaP = P.nutricion.proteinaMeta;
  const metaK = E.b.macros?.kcal;

  let h = `<header class="ini-top"><span class="k fuerte">Hoy · ${esc(fechaMedia(d))}</span><span class="k">${chipBloque(E)}</span></header>`;
  const rec = recuperacion(dISO);
  h += `<div class="diales${rec ? ' cuatro' : ''}">
    ${rec ? dial(rec.p / 100, COLOR_R[zonaR(rec.p)], `${rec.p}%`, 'Recuper.', '') : ''}
    ${dial(ejercicios.length ? hechos / ejercicios.length : 0, colorDe(clave), `${hechos}/${ejercicios.length}`, 'Sesión', ent?.inicio && !ent.fin ? 'data-accion="continuar"' : '')}
    ${dial(prot / metaP, 'var(--prot)', `${prot}g`, 'Proteína', 'data-tab="nutri"')}
    ${dial(metaK ? kcal / metaK : 0, 'var(--kcal)', kcal >= 1000 ? `${fmt(kcal / 1000)}k` : `${kcal}`, 'Kcal', 'data-tab="nutri"')}
  </div>`;
  h += tarjetaGarmin(d, clave, ent);
  h += avisoUnico(d, E, clave);
  h += `<p class="titulo-sec" style="--tc:${colorDe(clave)}">Hoy entrenás</p>`;
  h += tarjetaSesion(S, ent, hechos, ejercicios.length);
  h += '<p class="titulo-sec">Tu semana</p>';
  h += tiraSemana(d);
  h += '<p class="titulo-sec" style="--tc:var(--ok)">Peso</p>';
  h += tarjetaPeso(dISO);
  return h;
}

// Un solo aviso a la vez: el más importante.
function avisoUnico(d, E, clave) {
  const dISO = iso(d);
  const t = P.tests.fechas.find((x) => dISO >= x.fecha && dISO <= iso(addDays(parseISO(x.fecha), 6)));
  let a = null;
  if (E.fase === 'antes') a = `El plan arranca el ${fechaCorta(P.bloques[0].desde)}.`;
  else if (E.descarga) a = `<b>Semana de descarga:</b> la mitad de las series${clave === 'viernes' ? ' y hoy zona 2 en vez de intervalos' : ''}.`;
  else if (E.fase === 'plan' && E.b.volumenBajo) a = esc(E.b.aviso);
  else if (t && !testCompleto(t.id)) a = `<button type="button" class="link" data-tab="progreso">📏 Semana de tests: cargalos en Progreso →</button>`;
  else if (avisoSeguidos(d)) a = `⚠︎ ${esc(avisoSeguidos(d))} Si llegás cargado, cambiá uno por zona 2.`;
  else if (rango(7).map((i) => recuperacion(iso(addDays(d, -i)))).filter((r) => r && r.p < 40).length >= 3) a = 'Varios días con recuperación baja esta semana: considerá adelantar la descarga.';
  return a ? `<div class="aviso">${a}</div>` : '';
}

function tarjetaSesion(S, ent, hechos, total) {
  const { s, clave, lugar, dISO } = S;
  const d = parseISO(dISO);
  const entrena = s.tipo === 'fuerza' || s.tipo === 'cardio';
  const tieneCasa = s.items.some((it) => it.casa) || clave === 'viernes';
  let h = `<section class="c sesion" style="--sc:${colorDe(clave)}">
    <div class="fila-k"><span class="k tipo-k">${esc(tipoNombre(s))}${movido(d) ? ' · movida' : ''}</span>${ent?.inicio ? `<span class="k">${lugar === 'casa' ? '🏠 Casa' : '🏋️ Gimnasio'}</span>` : ''}</div>
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
      <button type="button" class="link chico" data-tab="semana" style="grid-column:1/-1;text-align:left">¿Es otro día (ayer, mañana)? Cambialo en Semana →</button>
      ${Object.keys(P.sesiones).filter((k) => k !== clave).map((k) => `<button type="button" class="secund" data-sesion="${k}">${esc(titulo(k))}</button>`).join('')}
    </div>
  </section>`;
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
  if (x.opciones?.length) {
    h += `<button type="button" class="link chico" data-accion="ver-opciones">⇄ Cambiar ejercicio</button>
      <div class="opc-ej" hidden>${x.opciones.map(([k, n]) => `<button type="button" class="secund" data-opcion="${esc(x.base)}|${k}">${k === 'orig' ? '↺ ' : ''}${esc(n)}</button>`).join('')}</div>`;
  }
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

let propuesta = null;
function vistaSemana() {
  const d = hoy();
  const E = estado(iso(d));
  let h = `<header class="top"><h1 class="big">Semana</h1><p class="chip">${chipBloque(E)}</p></header>`;
  const dias = diasSemana(d);

  if (propuesta) {
    const seg = seguidosEn(propuesta);
    h += `<section class="c propuesta"><p class="k azul">Así queda la semana</p>
      <p class="chico mut">${esc(textoCambios(propuesta) || 'Sin otros cambios.')}</p>
      ${seg.length ? `<p class="chico warn">⚠︎ Quedan días fuertes seguidos: ${esc(seg.join(', '))}.</p>` : ''}
      <div class="dos"><button type="button" class="secund" data-accion="cancelar-prop">Cancelar</button><button type="button" class="secund confirmar" data-accion="confirmar-prop">Confirmar</button></div>
    </section>`;
    propuesta.dias.forEach((fISO, i) => {
      const k = propuesta.despues[i];
      const cambia = k !== propuesta.antes[i];
      h += `<div class="dia prev-dia${cambia ? ' cambia' : ''}${fISO === propuesta.destino ? ' destino-fijo' : ''}">
        <span class="dn">${DIAS[parseISO(fISO).getDay()]}${fISO === propuesta.destino ? ' 📌' : ''}</span>
        <span class="dt">${esc(titulo(k))}${cambia ? ` <span class="antes">antes ${esc(P.sesiones[propuesta.antes[i]].corto)}</span>` : ''}</span>
      </div>`;
    });
    return h;
  }

  if (E.descarga) h += '<div class="aviso"><b>Semana de descarga:</b> la mitad de las series y el viernes zona 2.</div>';
  h += '<p class="mut chico ayuda">Tocá un día para cambiar lo que tiene (también los que ya pasaron) o mantenelo apretado y arrastralo. El resto se reacomoda solo.</p>';
  if (dias.some((f) => movido(f) || fijado(f))) h += '<button type="button" class="cambiar" data-accion="restaurar">↺ Volver la semana al orden original</button>';

  dias.forEach((f) => {
    const dia = f.getDay();
    const fISO = iso(f);
    const S = armarSesion(f);
    const esHoy = fISO === iso(d);
    const bloq = bloqueado(f);
    const prevD = addDays(f, -1);
    const seguidos = pesada(f) && pesada(prevD) && (movido(f) || movido(prevD));
    const abierto = diaAbierto === dia;
    h += `<div class="dia${esHoy ? ' hoy' : ''}${bloq ? ' bloq' : ''}${fISO < iso(d) ? ' pasado' : ''}" data-dia="${dia}" data-fecha="${fISO}" style="--sc:${colorDe(S.clave)}">
      <div class="dia-fila"${bloq ? '' : ` data-arr="${fISO}"`} data-abrir="${dia}">
        ${bloq ? '<span class="asa off" aria-hidden="true"></span>' : `<span class="asa" aria-hidden="true">⋮⋮</span>`}
        <span class="dn">${DIAS[dia]}${esHoy ? ' <em>hoy</em>' : ''}${hechoEl(f) ? ' <span class="tag ok">✓</span>' : ''}${fijado(f) ? ' <span class="tag">📌 fijo</span>' : movido(f) ? ' <span class="tag">movido</span>' : ''}</span>
        <span class="dt"><span class="tipo-k">${esc(tipoNombre(S.s))}</span> ${esc(S.s.titulo)}${seguidos ? ' <span class="warn">⚠︎ 2 fuertes seguidos</span>' : ''}</span>
        <span class="dd">${esc(S.s.duracion || '')}</span>
      </div>
      <div class="dia-body"${abierto ? '' : ' hidden'}>
        ${editable(f) ? `<div class="mover poner"><span class="meta">${fISO < iso(d) ? 'Ese día hiciste:' : 'Cambiar por:'}</span>${Object.keys(P.sesiones).filter((k) => k !== S.clave).map((k) => `<button type="button" data-poner="${fISO}|${k}" style="--sc:${colorDe(k)}">${esc(P.sesiones[k].corto || titulo(k))}</button>`).join('')}</div>` : ''}
        ${bloq ? '' : `<div class="mover"><span class="meta">Mover a:</span>${dias.filter((g) => g !== f && !bloqueado(g)).map((g) => `<button type="button" data-mover="${fISO}|${iso(g)}">${DIAS[g.getDay()].slice(0, 3)}</button>`).join('')}</div>`}
        ${S.s.sub ? `<p class="meta">${esc(S.s.sub)}</p>` : ''}${S.items.map((x) => cardVer(x, S.dISO)).join('')}
      </div>
    </div>`;
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
  const d = hoy();
  const dISO = iso(d);
  const E = estado(dISO);
  const N = P.nutricion;
  const m = E.b.macros;
  const { prot, kcal } = totales(dISO);
  const metaP = N.proteinaMeta;
  const metaK = m?.kcal;
  const pctP = Math.min(100, (prot / metaP) * 100);
  const pctK = metaK ? Math.min(100, (kcal / metaK) * 100) : 0;
  const pasado = metaK && kcal > metaK * 1.05;
  const lista = DB.comida[dISO] || [];
  const momIds = P.momentos.map((x) => x.id);

  let h = `<header class="top"><h1 class="big">Comida</h1><p class="chip">${chipBloque(E)} · ${prot} g · ${fmt(kcal, 0)} kcal</p></header>`;

  for (const mo of P.momentos) {
    // lo cargado sin momento (versión anterior) va a Extras
    const items = lista.map((e, i) => ({ e, i })).filter(({ e }) => (momIds.includes(e.m) ? e.m : 'extras') === mo.id && ALI[e.id]);
    const rapidas = mo.id === 'extras' ? DB.prot[dISO] || [] : [];
    let p = rapidas.reduce((a, b) => a + b, 0);
    let k = 0;
    items.forEach(({ e }) => { const v = valE(e); p += v.p; k += v.k; });
    const tipo = mo.tipo != null ? P.comidasTipo[mo.tipo] : null;
    const abierto = pickerMom === mo.id;
    h += `<section class="c momento" style="--mc:${mo.color}">
      <div class="mom-top"><span class="mom-n">${esc(mo.nombre)}</span><span class="mut">${items.length || rapidas.length ? `${Math.round(p)} g · ${Math.round(k)} kcal` : 'vacío'}</span></div>
      ${items.map(({ e, i }) => {
        const a = ALI[e.id];
        const v = valE(e);
        let fila = `<div class="item-c"><button type="button" class="item-n" data-edit-ent="${i}"><b>${esc(a.nombre)}</b><small>${fmtC(e.c)} × ${esc(a.porcion)}${e.p != null ? ' · corregido' : ''} · ✎</small></button><span class="mut">${fmt(v.p)} g · ${Math.round(v.k)}</span><button type="button" class="x" data-borrar="${i}" aria-label="Borrar">✕</button></div>`;
        if (editEnt === i) {
          fila += `<div class="edit-v"><p class="k">Lo que comiste (${fmtC(e.c)} × ${esc(a.porcion)})</p>
            <div class="cn-fila">${campoNum('ee-p', +fmt(v.p).replace(',', '.'), 'g', 'Proteína')}${campoNum('ee-k', Math.round(v.k), 'kcal', 'Calorías')}</div>
            <div class="dos"><button type="button" class="secund" data-guardar-ent="${i}|hoy">Solo esta vez</button><button type="button" class="secund confirmar" data-guardar-ent="${i}|siempre">Usar siempre</button></div>
            <p class="mut chico">"Usar siempre" cambia los valores de ${esc(a.nombre)} para las próximas veces.</p>
          </div>`;
        }
        return fila;
      }).join('')}
      ${rapidas.map((g, i) => `<div class="item-c"><span><b>Carga rápida</b><small>versión anterior</small></span><span class="mut">${g} g</span><button type="button" class="x" data-borrar-prot="${i}" aria-label="Borrar">✕</button></div>`).join('')}
      <div class="mom-acc">
        ${tipo && !items.length ? `<button type="button" class="secund" data-tipo="${mo.tipo}" data-mom="${mo.id}">Cargar ${esc(mo.nombre.toLowerCase())} tipo</button>` : ''}
        <button type="button" class="secund${abierto ? ' on-mom' : ''}" data-picker="${mo.id}">${abierto ? 'Listo' : '+ Alimento'}</button>
      </div>
      ${abierto ? picker() : ''}
    </section>`;
  }

  h += `<p class="titulo-sec" style="--tc:var(--prot)">Resumen del día</p><section class="c">
    <div class="macro"><span class="k">Proteína</span><span><b class="big">${prot}</b> <span class="mut">/ ${metaP} g</span></span></div>
    <div class="bar${prot >= metaP ? ' llena' : ''}"><span style="width:${pctP}%"></span></div>
    <div class="macro"><span class="k">Calorías</span><span><b class="big">${fmt(kcal, 0)}</b> <span class="mut">${metaK ? `/ ${fmt(metaK, 0)}` : 'mantenimiento'}</span></span></div>
    ${metaK ? `<div class="bar kcal${pasado ? ' pasado' : ''}"><span style="width:${pctK}%"></span></div>` : ''}
    <p class="meta">${prot >= metaP ? 'Proteína cubierta.' : `Te faltan ${metaP - prot} g de proteína.${metaP - prot >= 20 ? ' Si no llegás: whey.' : ''}`}${metaK ? (pasado ? ' Te pasaste de las kcal del día.' : ` Te quedan ${fmt(metaK - kcal, 0)} kcal.`) : ''}</p>
    <button type="button" class="check-foto mini${DB.crea[dISO] ? ' on' : ''}" data-accion="crea">${DB.crea[dISO] ? '✓ Creatina tomada' : '○ Creatina 5 g'}</button>
  </section>`;

  h += '<p class="titulo-sec" style="--tc:var(--mut)">Guía</p>';
  if (m) {
    h += `<details class="card plegable"><summary><h3>Macros · ${esc(E.b.etiqueta)}</h3></summary>
      <div class="tiles">
        <div class="tile"><b class="big">${fmt(m.kcal, 0)}</b><span>kcal</span></div>
        <div class="tile"><b class="big">${m.prot} g</b><span>proteína</span></div>
        <div class="tile"><b class="big">~${m.grasa} g</b><span>grasa</span></div>
        <div class="tile"><b class="big">~${m.carbs} g</b><span>carbos</span></div>
      </div>
      <p class="meta">${esc(N.objetivo)}</p></details>`;
  }
  const sinCarbCena = ['z2', 'domingo'].includes(claveDe(d));
  h += `<details class="card plegable"${sinCarbCena ? ' open' : ''}><summary><h3>Día tipo</h3></summary>
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

function vistaProgreso() {
  const dISO = iso(hoy());
  if (!testSel) {
    const pasados = P.tests.fechas.filter((t) => t.fecha <= dISO);
    testSel = (pasados[pasados.length - 1] || P.tests.fechas[0]).id;
  }
  const t = DB.tests[testSel] || {};
  const tInfo = P.tests.fechas.find((x) => x.id === testSel);

  let h = '<header class="top"><h1 class="big">Progreso</h1></header>';

  h += seccionPeso(dISO);
  h += seccionSalud(dISO);
  h += seccionEjercicios();

  h += `<p class="k sec">Tests cada 4 semanas</p><div class="segmentos">${P.tests.fechas.map((x) => `<button type="button" class="${x.id === testSel ? 'on' : ''}" data-test="${x.id}">${esc(x.nombre)}${testCompleto(x.id) ? ' ✓' : ''}</button>`).join('')}</div>`;

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

  const nc = nubeCfg();
  const resp = localStorage.getItem(`${KEY}.respaldo.fecha`);
  h += `<section class="card"><h3>Backup</h3>
    <p class="k">Copia en la nube</p>
    ${nc.token ? `<p class="meta">${nc.ultima ? `Última copia ${hace(nc.ultima)}.` : 'Todavía no se subió ninguna copia.'}${nc.error ? ` <span class="warn">Último intento falló (${esc(nc.error)}).</span>` : ''} Se sube sola cuando hay cambios.</p>
      <div class="botonera"><button type="button" class="btn" data-accion="nube-subir">Subir ahora</button><button type="button" class="btn sec" data-accion="nube-traer">Traer de la nube</button></div>
      <button type="button" class="link chico" data-accion="nube-salir">Desconectar</button>`
    : `<p class="meta">Guarda una copia automática en tu repo privado de GitHub. Pegá la clave una sola vez.</p>
      <label class="cn ancho"><span>Clave de GitHub</span><input id="nube-token" type="password" autocomplete="off" placeholder="github_pat_…"></label>
      <button type="button" class="btn" data-accion="nube-conectar">Conectar</button>`}
    <p class="k" style="margin-top:16px">Archivo</p>
    <p class="meta">Exportá un backup cada tanto y guardalo en Archivos o mandátelo por mail.</p>
    <div class="botonera">
      <button type="button" class="btn" data-accion="exportar">Exportar</button>
      <button type="button" class="btn sec" data-accion="importar">Importar</button>
    </div>
    <input type="file" id="archivo" accept="application/json,.json" hidden>
    ${resp ? `<p class="meta" style="margin-top:14px">Copia local automática: ${esc(new Date(resp).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))}. <button type="button" class="link chico" data-accion="restaurar-local">Restaurar</button></p>` : ''}
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
  if (sem.length < 2) return { txt: 'Pesate 3 mañanas por semana: con 2 semanas te digo si vas en ritmo.', tipo: '' };
  const d1 = sem[sem.length - 1].prom - sem[sem.length - 2].prom;
  const d2 = sem.length >= 3 ? sem[sem.length - 2].prom - sem[sem.length - 3].prom : null;
  if (d1 < -0.5) return { txt: `Bajaste ${fmt(-d1)} kg en la última semana (más de 0,5): subí 150 kcal.`, tipo: 'warn' };
  if (d2 != null && Math.abs(d1) < 0.15 && Math.abs(d2) < 0.15) return { txt: 'Peso sin moverse 2 semanas: bajá 150 kcal.', tipo: 'warn' };
  if (d1 > 0.15) return { txt: `Subiste ${fmt(d1)} kg en la última semana. Revisá salidas y comida libre.`, tipo: 'warn' };
  if (d1 <= -0.2) return { txt: `Vas en ritmo: ${fmt(-d1)} kg menos que la semana anterior.`, tipo: 'ok' };
  return { txt: `Última semana: ${d1 > 0 ? '+' : ''}${fmt(d1)} kg. El objetivo es bajar 0,25–0,4 por semana.`, tipo: '' };
}
function seccionPeso(dISO) {
  const pts = Object.keys(DB.peso).filter((f) => f <= dISO && num(DB.peso[f]) != null).sort().map((f) => ({ f, v: num(DB.peso[f]) }));
  const sem = semanasPeso(dISO);
  const aj = ajustePeso(dISO);
  const ult = sem[sem.length - 1];
  let h = `<section class="c"><div class="fila-k"><span class="k">Peso</span>${ult ? `<span class="k">prom. semana <b class="big blanco">${fmt(ult.prom)} kg</b></span>` : ''}</div>`;
  if (!pts.length) return `${h}<p class="meta vacio-g">Cargá tu peso en ayunas en Inicio y acá ves la tendencia.</p></section>`;
  // media móvil de 7 días para ver la tendencia sin el ruido diario
  const media = pts.map((p) => {
    const desde = iso(addDays(parseISO(p.f), -6));
    return { f: p.f, v: prom(pts.filter((q) => q.f >= desde && q.f <= p.f).map((q) => q.v)) };
  });
  h += graficoSerie(pts, { linea: media, banda: P.tests.pesoObjetivo, unidad: 'kg' });
  h += `<p class="reco" style="--z:${aj.tipo === 'warn' ? 'var(--warn)' : aj.tipo === 'ok' ? 'var(--ok)' : 'var(--line)'}">${esc(aj.txt)}</p></section>`;
  return h;
}

// ---------- sueño y pulso (Garmin) ----------
function seccionSalud(dISO) {
  const fechas = Object.keys(DB.salud).filter((f) => f <= dISO).sort();
  if (!fechas.length) return '';
  const fcr = fechas.filter((f) => DB.salud[f].fcr != null).map((f) => ({ f, v: DB.salud[f].fcr }));
  const sue = fechas.filter((f) => DB.salud[f].horas != null).map((f) => ({ f, v: DB.salud[f].horas }));
  let h = '';
  if (fcr.length) h += `<section class="c"><div class="fila-k"><span class="k">Pulso en reposo</span><span class="k">últ. <b class="big blanco">${fcr[fcr.length - 1].v}</b></span></div>${graficoSerie(fcr, { unidad: 'lpm' })}<p class="meta">Si amanece varios latidos arriba de tu promedio, es señal de cansancio o de que algo se está incubando.</p></section>`;
  if (sue.length) h += `<section class="c"><div class="fila-k"><span class="k">Horas dormido</span><span class="k">últ. <b class="big blanco">${fmtHoras(sue[sue.length - 1].v)}</b></span></div>${graficoSerie(sue, { unidad: 'h', banda: [7.5, 8] })}</section>`;
  h += graficoHorario(fechas.filter((f) => DB.salud[f].inicio && DB.salud[f].fin).slice(-14));
  return h;
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
    svg += `<rect x="${x}" y="${y(n.a)}" width="${paso * 0.6}" height="${Math.max(2, y(n.b) - y(n.a))}" rx="3" class="g-noche"/>`;
  });
  svg += `<text x="${L}" y="${H - 6}" class="g-eje">${fechaCorta(noches[0].f)}</text><text x="${W - R}" y="${H - 6}" class="g-eje" text-anchor="end">${fechaCorta(noches[noches.length - 1].f)}</text></svg>`;
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const desvio = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
  const dA = desvio(noches.map((n) => n.a));
  const txt = noches.length < 3 ? 'Con unas noches más te muestro cuánto varía tu horario.'
    : `Te dormís en promedio a las ${hora(media(noches.map((n) => n.a)))} y te despertás a las ${hora(media(noches.map((n) => n.b)))}. Variación: ±${fmtMin(Math.round(dA * 60))}${dA > 1 ? ' (bastante; acercar los horarios suele mejorar cómo te sentís)' : ''}.`;
  return `<section class="c"><span class="k">Horario de sueño</span>${svg}<p class="meta">${esc(txt)}</p></section>`;
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
function seccionEjercicios() {
  const nombres = nombresEjercicios();
  const series = {};
  for (const f of Object.keys(DB.logs).sort()) {
    for (const [id, e] of Object.entries(DB.logs[f])) {
      const w = pesoMax(e);
      if (w == null || !(e.d || []).some(Boolean)) continue;
      (series[id] ||= []).push({ f, v: w, e });
    }
  }
  const ids = Object.keys(series);
  let h = '<section class="c"><span class="k">Ejercicios</span>';
  if (!ids.length) return `${h}<p class="meta vacio-g">Cuando registres pesos en los entrenamientos, acá ves cómo evoluciona cada ejercicio.</p></section>`;
  if (!ejSel || !series[ejSel]) ejSel = ids.sort((a, b) => series[b].length - series[a].length)[0];
  const nom = (id) => { const [base, casa] = id.split('@'); return `${nombres[base] || base}${casa ? ' (casa)' : ''}`; };
  h += `<select id="ej-sel" class="sel">${ids.sort((a, b) => nom(a).localeCompare(nom(b))).map((id) => `<option value="${esc(id)}"${id === ejSel ? ' selected' : ''}>${esc(nom(id))}</option>`).join('')}</select>`;
  const pts = series[ejSel];
  h += graficoSerie(pts, { unidad: 'kg' });
  h += `<ul class="res-lista">${pts.slice(-5).reverse().map((p) => `<li><span>${fechaCorta(p.f)}</span><span class="mut">${fmt(p.v)} kg · ${(p.e.r || []).filter(Boolean).join('-') || '—'} reps</span></li>`).join('')}</ul></section>`;
  return h;
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
  pts.forEach((p) => { s += `<circle cx="${x(p.f)}" cy="${y(p.v)}" r="${linea ? 2.5 : 4}" class="${linea ? 'g-dia' : 'g-punto'}"/>`; });
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
  if (filaDia) {
    const dia = +filaDia.dataset.abrir;
    const body = filaDia.parentElement.querySelector('.dia-body');
    body.hidden = !body.hidden;
    diaAbierto = body.hidden ? null : dia;
    return;
  }
  const el = ev.target.closest('button, summary');
  if (!el) return;
  const dISO = iso(hoy());

  if (el.dataset.tab) { propuesta = null; return render(el.dataset.tab); }

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
    (DB.comida[dISO] ||= []).push({ id, c: +c, m: pickerMom || 'extras', t: Date.now() });
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
    const e = DB.comida[dISO][+i];
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
    c.items.forEach(([id, n]) => (DB.comida[dISO] ||= []).push({ id, c: n, m: el.dataset.mom, t: Date.now() }));
    save();
    render('nutri', true);
    return toast(`Agregado: ${c.nombre}`);
  }
  if (el.dataset.borrar) { (DB.comida[dISO] || []).splice(+el.dataset.borrar, 1); save(); return render('nutri', true); }
  if (el.dataset.borrarProt) { (DB.prot[dISO] || []).splice(+el.dataset.borrarProt, 1); save(); return render('nutri', true); }
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
  if (acc === 'ver-opciones') { const o = el.nextElementSibling; o.hidden = !o.hidden; return; }
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
    if (ent) { ent.fin = Date.now(); save(); setTimeout(() => subirNube(false), 500); }
    return render('resumen');
  }
  if (acc === 'resumen') return render('resumen');
  if (acc === 'reabrir') { if (ent) { delete ent.fin; save(); } return render('entreno'); }
  if (acc === 'confirmar-prop') { aplicar(propuesta); const m = textoCambios(propuesta); propuesta = null; render('semana', true); return toast(m ? `Listo: ${m}` : 'Listo'); }
  if (acc === 'cancelar-prop') { propuesta = null; return render('semana', true); }
  if (acc === 'restaurar') { restaurarSemana(hoy()); render('semana', true); return toast('Semana restaurada'); }

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
  if (acc === 'crea') { DB.crea[dISO] = !DB.crea[dISO]; save(); return render('nutri', true); }
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

// Al abrir: si quedó un entrenamiento a medias hoy, vuelve directo a él.
const entHoy = DB.entrenos[iso(hoy())];
render(entHoy?.inicio && !entHoy.fin ? 'entreno' : 'inicio');
if (tab === 'entreno') irAlActual();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
