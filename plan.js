// ============================================================
//  PLAN DE ENTRENAMIENTO Y NUTRICIÓN — sep 2026 a ene 2027
//  Este es el único archivo que tenés que tocar para cambiar
//  ejercicios, series, descansos, bloques o comidas.
//
//  Campos de un ejercicio:
//    id        identificador único (no lo cambies si ya cargaste pesos,
//              porque el historial se guarda con ese id)
//    nombre    lo que se ve en pantalla
//    series    cantidad de casillas para tildar
//    reps      repeticiones (texto)
//    descanso  segundos del temporizador
//    descansoTxt  (opcional) cómo se muestra el descanso, ej. "2–3 min"
//    texto     (opcional) reemplaza "series × reps"; {s} = series, {r} = reps
//    nota      (opcional) aclaración chica
//    sinPeso   true si no hace falta anotar kilos
//    piernas   true para que la progresión sugiera +5 kg (si no, +2,5 kg)
//    casa      versión para entrenar en casa (lo que no se define, queda igual)
// ============================================================

window.PLAN = {
  lunesSemana1: '2026-09-28', // para numerar las semanas

  // 0 = domingo … 6 = sábado. Desde la app podés cambiar o mover días.
  // prioridad: qué sesión se conserva si hay que pisar otra (3 fuerza > 2 intervalos > 1 zona 2; 0 no se pisa)
  // pesada: para avisar si quedan dos días fuertes seguidos
  semana: { 1: 'supA', 2: 'z2', 3: 'piernas', 4: 'supB', 5: 'viernes', 6: 'sabado', 0: 'domingo' },

  movilidad: [
    { id: 'm1', nombre: 'Cadera 90/90', dosis: '1 min por lado' },
    { id: 'm2', nombre: 'Estocada de sofá', dosis: '1 min por lado' },
    { id: 'm3', nombre: 'Tobillo, rodilla a la pared', dosis: '10 por lado' },
    { id: 'm4', nombre: 'Sentadilla cosaca', dosis: '8 por lado' },
    { id: 'm5', nombre: 'Extensión de espalda alta sobre foam roller', dosis: '10' },
    { id: 'm6', nombre: 'Libro abierto', dosis: '8 por lado' },
    { id: 'm7', nombre: 'Estiramiento de pecho en el marco de la puerta', dosis: '45 s por lado' },
    { id: 'm8', nombre: 'Dislocaciones de hombro con banda', dosis: '12' },
    { id: 'm9', nombre: 'Cobra con respiración + pop-up lento con pausa abajo', dosis: '5' },
  ],
  // Movilidad corta al arrancar cada sesión de gimnasio (5–8 min)
  movilidadEntrada: ['m1', 'm3', 'm6', 'm8'],

  sesiones: {
    supA: {
      corto: 'Sup A', prioridad: 3,
      titulo: 'Tren superior A', sub: 'Tracción + pop-ups', duracion: '70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'dominadas', nombre: 'Dominadas', series: 4, reps: '3–8', descanso: 120, nota: 'Las que te salgan estrictas. Si no llegás a 5, completá con negativas de 5 s', casa: { id: 'jalon-banda', nombre: 'Jalón con banda anclada arriba', reps: '10–15', sinPeso: true } },
        { id: 'press-incl', nombre: 'Press inclinado con mancuernas', series: 3, reps: '8–10', descanso: 120 },
        { id: 'remo-pecho', nombre: 'Remo con pecho apoyado', series: 3, reps: '8–10', descanso: 90 },
        { id: 'press-militar', nombre: 'Press militar de pie con mancuernas', series: 3, reps: '8–10', descanso: 90 },
        { id: 'pullover-manc', nombre: 'Pullover con mancuerna en banco', series: 3, reps: '12', descanso: 60 },
        { id: 'facepull-trx', nombre: 'Face pull en TRX', series: 3, reps: '12–15', descanso: 45, sinPeso: true, casa: { id: 'facepull-banda', nombre: 'Face pull con banda', reps: '15', tec: 'facepull' } },
        { id: 'rot-ext', nombre: 'Rotación externa con banda', series: 2, reps: '15', descanso: 45, sinPeso: true },
        { id: 'curl', nombre: 'Curl de bíceps con mancuernas', series: 3, reps: '10–12', descanso: 60 },
        { id: 'popups-tec', nombre: 'Pop-ups técnicos', series: 3, reps: '5', descanso: 45, nota: 'Lentos y perfectos', sinPeso: true },
      ],
    },

    z2: {
      corto: 'Z2', prioridad: 1,
      titulo: 'Zona 2 + movilidad', sub: '45 min de cardio suave + 15 min de movilidad', duracion: '60 min',
      tipo: 'cardio',
      items: [
        { id: 'z2', nombre: 'Zona 2', series: 1, texto: '45 min', sinPeso: true, nota: 'SkiErg, remo, bici o crol. Ritmo que te deje hablar (60–70 % de la FC máx.)' },
        { seccion: 'Movilidad completa (15 min)' },
        { movilidadCompleta: true },
      ],
    },

    piernas: {
      corto: 'Piernas', prioridad: 3, pesada: true,
      titulo: 'Piernas + potencia', sub: 'Con pop-ups', duracion: '70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'saltos', nombre: 'Saltos al cajón', series: 4, reps: '3', descanso: 90, nota: 'Siempre primero', sinPeso: true, casa: { id: 'saltos-vert', nombre: 'Saltos verticales', nota: 'Caé suave, rodillas flexionadas' } },
        { id: 'sentadilla', piernas: true, nombre: 'Sentadilla trasera o frontal', series: 4, reps: '5–6', descanso: 150, descansoTxt: '2–3 min', casa: { id: 'goblet', nombre: 'Sentadilla goblet con mancuerna', reps: '10–12', nota: 'Bajada en 3 s y pausa abajo', descansoTxt: '' } },
        { id: 'rumano', piernas: true, nombre: 'Peso muerto rumano', series: 3, reps: '8', descanso: 120, casa: { id: 'rumano-1p', nombre: 'Peso muerto rumano a una pierna', reps: '8–10 por pierna' } },
        { id: 'bulgara', piernas: true, nombre: 'Sentadilla búlgara', series: 3, reps: '8 por pierna', descanso: 90 },
        { id: 'balon', nombre: 'Lanzamiento rotacional de balón medicinal a la pared', series: 3, reps: '6 por lado', descanso: 60, casa: { id: 'pelota-arena', nombre: 'Lanzamiento rotacional con pelota de arena', reps: '8 por lado', sinPeso: true, nota: 'Pelota de 3 kg, contra una pared firme o al piso' } },
        { id: 'pallof', nombre: 'Pallof press con banda', series: 3, reps: '10 por lado', descanso: 45, sinPeso: true },
        { id: 'popups-exp', nombre: 'Pop-ups explosivos', series: 4, reps: '5', descanso: 60, sinPeso: true },
      ],
    },

    supB: {
      corto: 'Sup B', prioridad: 3,
      titulo: 'Tren superior B', sub: 'Empuje + hombro + core', duracion: '60–70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'banca', nombre: 'Press banca con barra', series: 4, reps: '5–8', descanso: 150, descansoTxt: '2–3 min', casa: { id: 'press-manc', nombre: 'Press con mancuernas en banco plano', reps: '10–12', nota: 'Bajada en 3 s', descansoTxt: '' } },
        { id: 'dom-asist', nombre: 'Dominadas asistidas con banda', series: 3, reps: '6–8', descanso: 90, sinPeso: true, nota: 'Banda que te deje hacer 6–8 limpias; cuando hagas 8, pasá a una más fina', casa: { id: 'jalon-banda', nombre: 'Jalón con banda anclada arriba', reps: '12–15' } },
        { id: 'remo-una', nombre: 'Remo a una mano con mancuerna', series: 3, reps: '8–10 por lado', descanso: 90 },
        { id: 'triceps-ext', nombre: 'Extensión de tríceps sobre la cabeza con mancuerna', series: 3, reps: '10–12', descanso: 60 },
        { id: 'laterales', nombre: 'Elevaciones laterales', series: 4, reps: '12–15', descanso: 45 },
        { id: 'remo-trx', nombre: 'Remo invertido en TRX', series: 3, reps: '10–12', descanso: 60, sinPeso: true, nota: 'Más acostado = más difícil', casa: { id: 'remo-banda', nombre: 'Remo con banda', reps: '12–15' } },
        { id: 'core', nombre: 'Core', series: 3, texto: '{s} rondas', descanso: 60, nota: 'Rueda abdominal + plancha lateral + hollow hold', sinPeso: true, casa: { id: 'core-casa', nota: 'Dead bug + plancha lateral + hollow hold' } },
      ],
    },

    viernes: {
      corto: 'Interv.', prioridad: 2, pesada: true,
      titulo: 'Intervalos de remada', sub: 'SkiErg, remo o crol + pop-ups bajo fatiga', duracion: '50 min',
      tipo: 'cardio', movilidadEntrada: true,
      items: [
        { id: 'vie-entrada', nombre: 'Entrada en calor', series: 1, texto: '8 min suaves + 2 aceleraciones de 15 s', sinPeso: true, fijo: true },
        { intervalos: true }, // acá van los intervalos del bloque actual
        { id: 'vie-popups', nombre: 'Pop-ups bajo fatiga', series: 4, texto: '{s} rondas', descanso: 30, descansoTxt: '30 s de pausa', nota: '30 s de SkiErg a fondo → 3 pop-ups → 30 s de pausa', sinPeso: true, casa: { nota: '30 s de bici o trote fuerte → 3 pop-ups → 30 s de pausa' } },
        { id: 'vie-surf', nombre: 'Remada de surf en banco inclinado con bandas', series: 3, texto: '{s} × 60 s', descanso: 60, sinPeso: true },
        { id: 'vie-calma', nombre: 'Vuelta a la calma', series: 1, texto: '5 min caminando', nota: 'Nunca parar de golpe', sinPeso: true, fijo: true },
      ],
    },

    sabado: {
      corto: 'Pádel', prioridad: 0, pesada: true,
      titulo: 'Pádel', sub: 'Si no hay pádel: zona 2 de 40 min', duracion: '',
      tipo: 'cardio',
      items: [
        { id: 'padel', nombre: 'Pádel', series: 1, texto: 'Partido', nota: 'Si no hay: zona 2 de 40 min', sinPeso: true },
      ],
    },

    domingo: {
      corto: 'Desc.', prioridad: 0,
      titulo: 'Descanso real', sub: 'Movilidad suave 15–20 min', duracion: '',
      tipo: 'descanso',
      items: [
        { seccion: 'Movilidad suave (15–20 min)' },
        { movilidadCompleta: true },
      ],
    },
  },

  // Ejercicios que ya no están en el plan, para mostrar bien el historial
  retirados: { 'bici-tri': 'Bíceps + tríceps en superserie', fondos: 'Fondos en paralelas', ytw: 'Y-T-W', pullover: 'Pullover en polea', facepull: 'Face pull en polea', jalon: 'Jalón al pecho' },

  // ------------------------------------------------------------
  //  CASA — lo que tenés para entrenar en casa
  // ------------------------------------------------------------
  casa: {
    equipo: 'Mancuernas de 5, 7,5, 10 y 12,5 kg · banco regulable · bandas elásticas · pelota de arena de 3 kg',
    mancuernas: [5, 7.5, 10, 12.5], // para sugerir la siguiente cuando llegás al tope de reps
    notaIntervalos: 'Bici o trote afuera, a 7–8/10 de esfuerzo',
  },

  // Viernes de descarga: zona 2 en lugar de los intervalos
  viernesDescarga: [
    { id: 'vie-z2', nombre: 'Zona 2 (en vez de intervalos)', series: 1, texto: '20–25 min a ritmo de charla', sinPeso: true },
  ],

  // ------------------------------------------------------------
  //  BLOQUES — la app detecta el bloque por la fecha.
  //  "ajustes" cambia series/reps/descanso de un ejercicio por su id.
  // ------------------------------------------------------------
  bloques: [
    {
      etiqueta: 'Bloque 1 · Base',
      desde: '2026-09-29', hasta: '2026-10-25',
      descarga: { desde: '2026-10-19', hasta: '2026-10-25' },
      fuerza: 'Todo como está escrito. Primera ronda al 70 %.',
      viernesTxt: '4 × 3 min fuerte / 2 min suave',
      comida: '~2.400 kcal',
      macros: { kcal: 2400, prot: 140, grasa: 70, carbs: 300 },
      intervalos: [
        { id: 'int-3min', nombre: 'Intervalos', series: 4, texto: '{s} × 3 min fuerte / 2 min suave', descanso: 120, descansoTxt: '2 min suave', nota: 'A 7–8/10 de esfuerzo' },
      ],
      ajustes: {},
    },
    {
      etiqueta: 'Bloque 2 · Fuerza y potencia',
      desde: '2026-10-26', hasta: '2026-11-22',
      descarga: { desde: '2026-11-16', hasta: '2026-11-22' },
      fuerza: 'Primer ejercicio de fuerza del día a 4–6 reps. Saltos al cajón 5 × 3.',
      viernesTxt: '5 × 4 min / 90 s + 6 sprints de 15 s',
      comida: '~2.400 kcal',
      macros: { kcal: 2400, prot: 140, grasa: 70, carbs: 300 },
      intervalos: [
        { id: 'int-4min', nombre: 'Intervalos', series: 5, texto: '{s} × 4 min fuerte / 90 s suave', descanso: 90, descansoTxt: '90 s suave', nota: 'A 7–8/10 de esfuerzo' },
        { id: 'spr-15', nombre: 'Sprints', series: 6, texto: '{s} × 15 s', sinPeso: true },
      ],
      ajustes: {
        dominadas: { reps: '4–6' },
        sentadilla: { reps: '4–6' },
        banca: { reps: '4–6' },
        saltos: { series: 5 },
      },
    },
    {
      etiqueta: 'Bloque 3 · Pico y definición',
      desde: '2026-11-23', hasta: '2026-12-20',
      descarga: null,
      fuerza: '+1 serie de laterales, bíceps y tríceps. Accesorios con 45 s de descanso.',
      viernesTxt: '3 × 5 min / 2 min + 8 sprints de 20 s',
      comida: '~2.250 kcal',
      macros: { kcal: 2250, prot: 140, grasa: 70, carbs: 265 },
      intervalos: [
        { id: 'int-5min', nombre: 'Intervalos', series: 3, texto: '{s} × 5 min fuerte / 2 min suave', descanso: 120, descansoTxt: '2 min suave', nota: 'A 7–8/10 de esfuerzo' },
        { id: 'spr-20', nombre: 'Sprints', series: 8, texto: '{s} × 20 s', sinPeso: true },
      ],
      ajustes: {
        laterales: { series: 5 },
        curl: { series: 4, descanso: 45 },
        'triceps-ext': { series: 4, descanso: 45 },
        // accesorios a 45 s
        'pullover-manc': { descanso: 45 },
        'facepull-trx': { descanso: 45 },
        'remo-trx': { descanso: 45 },
        pallof: { descanso: 45 },
      },
    },
    {
      etiqueta: 'Llegada',
      desde: '2026-12-21', hasta: '2027-01-03',
      descarga: null,
      volumenBajo: true, // la mitad de las series
      aviso: 'Llegada: 3–4 sesiones por semana, volumen bajo (la mitad de las series).',
      fuerza: '3–4 sesiones por semana, volumen bajo.',
      viernesTxt: '1 sesión corta',
      comida: 'Mantenimiento',
      macros: null,
      intervalos: [
        { id: 'int-corta', nombre: 'Sesión corta', series: 1, texto: '15–20 min', nota: 'Un par de tramos a 7/10, sin ir al fondo' },
      ],
      ajustes: {},
    },
  ],

  // ------------------------------------------------------------
  //  NUTRICIÓN
  // ------------------------------------------------------------
  nutricion: {
    objetivo: 'Bajar 0,25–0,4 kg por semana y llegar a enero con 69–70 kg (arranque: 72 kg).',
    mantenimiento: 'Mantenimiento: sostené el peso. Proteína 140 g.',
    proteinaMeta: 140,
    botonesProteina: [10, 25, 50],
    diaTipo: [
      { comida: 'Desayuno', detalle: '3 huevos + avena (50 g) o 2 tostadas integrales + fruta', prot: 25 },
      { comida: 'Almuerzo', detalle: '200 g de pollo cocido + verduras + arroz o papa', prot: 55 },
      { comida: 'Pre-entreno', detalle: '1–2 h antes: yogur griego o skyr 200 g + banana + tostadas con miel', prot: 20 },
      { comida: 'Cena', detalle: '200 g de carne, pollo o pescado + verduras + papa o batata', prot: 50 },
    ],
    notasDia: [
      'Martes y domingo: sin papa ni arroz en la cena.',
      'Pescado 2 veces por semana.',
    ],
    alcohol: [
      'Una salida por semana, tope de 3 tragos.',
      'Fernet con coca zero, agua entre trago y trago.',
      'Nunca la noche antes del miércoles o del viernes.',
      'En diciembre, lo mínimo posible.',
      'Una comida libre por semana.',
    ],
    otros: [
      'Unos 3 L de agua por día.',
      'Dormir 7,5–8 h.',
      'No recortar la sal (disautonomía).',
    ],
    suplementos: [
      'Creatina 5 g por día.',
      'Whey 25 g si no llegás a 140 g de proteína.',
      'Nada de pre-entrenos.',
    ],
  },

  // ------------------------------------------------------------
  //  ALIMENTOS — valores aproximados por porción (prot en g, kcal)
  //  Agregá o corregí lo que quieras: el id no se tiene que repetir.
  // ------------------------------------------------------------
  alimentosCats: ['Proteínas', 'Lácteos', 'Carbohidratos', 'Frutas y verduras', 'Grasas y extras', 'Salidas'],
  alimentos: [
    { id: 'huevo', nombre: 'Huevo', porcion: '1 unidad', cat: 'Proteínas', prot: 6, kcal: 75 },
    { id: 'clara', nombre: 'Clara de huevo', porcion: '1 clara', cat: 'Proteínas', prot: 3.5, kcal: 17 },
    { id: 'pollo', nombre: 'Pollo cocido', porcion: '100 g', cat: 'Proteínas', prot: 28, kcal: 160 },
    { id: 'carne', nombre: 'Carne vacuna magra', porcion: '100 g cocida', cat: 'Proteínas', prot: 28, kcal: 200 },
    { id: 'picada', nombre: 'Carne picada especial', porcion: '100 g cocida', cat: 'Proteínas', prot: 25, kcal: 230 },
    { id: 'cerdo', nombre: 'Cerdo magro', porcion: '100 g cocido', cat: 'Proteínas', prot: 27, kcal: 190 },
    { id: 'merluza', nombre: 'Pescado blanco (merluza)', porcion: '100 g cocido', cat: 'Proteínas', prot: 20, kcal: 100 },
    { id: 'salmon', nombre: 'Salmón', porcion: '100 g cocido', cat: 'Proteínas', prot: 22, kcal: 210 },
    { id: 'atun', nombre: 'Atún al natural', porcion: '1 lata escurrida', cat: 'Proteínas', prot: 25, kcal: 120 },
    { id: 'jamon', nombre: 'Jamón cocido', porcion: '2 fetas', cat: 'Proteínas', prot: 7, kcal: 50 },
    { id: 'whey', nombre: 'Whey', porcion: '1 scoop (25 g)', cat: 'Proteínas', prot: 20, kcal: 100 },
    { id: 'legumbres', nombre: 'Lentejas o garbanzos', porcion: '1 taza cocida', cat: 'Proteínas', prot: 15, kcal: 230 },
    { id: 'yogur', nombre: 'Yogur griego o skyr', porcion: '200 g', cat: 'Lácteos', prot: 20, kcal: 130 },
    { id: 'leche', nombre: 'Leche descremada', porcion: '1 vaso (250 ml)', cat: 'Lácteos', prot: 8, kcal: 90 },
    { id: 'queso', nombre: 'Queso (port salut light)', porcion: '30 g', cat: 'Lácteos', prot: 7, kcal: 75 },
    { id: 'ricota', nombre: 'Ricota descremada', porcion: '100 g', cat: 'Lácteos', prot: 11, kcal: 130 },
    { id: 'avena', nombre: 'Avena', porcion: '50 g', cat: 'Carbohidratos', prot: 6.5, kcal: 190 },
    { id: 'tostada', nombre: 'Tostada integral', porcion: '1 rebanada', cat: 'Carbohidratos', prot: 3.5, kcal: 75 },
    { id: 'arroz', nombre: 'Arroz cocido', porcion: '1 taza', cat: 'Carbohidratos', prot: 4, kcal: 205 },
    { id: 'fideos', nombre: 'Fideos cocidos', porcion: '1 plato (200 g)', cat: 'Carbohidratos', prot: 10, kcal: 300 },
    { id: 'papa', nombre: 'Papa', porcion: '200 g', cat: 'Carbohidratos', prot: 4, kcal: 170 },
    { id: 'batata', nombre: 'Batata', porcion: '200 g', cat: 'Carbohidratos', prot: 3, kcal: 180 },
    { id: 'banana', nombre: 'Banana', porcion: '1 mediana', cat: 'Frutas y verduras', prot: 1, kcal: 105 },
    { id: 'fruta', nombre: 'Fruta (manzana, naranja…)', porcion: '1 unidad', cat: 'Frutas y verduras', prot: 0.5, kcal: 70 },
    { id: 'verduras', nombre: 'Verduras', porcion: '1 plato', cat: 'Frutas y verduras', prot: 3, kcal: 60 },
    { id: 'palta', nombre: 'Palta', porcion: '½ unidad', cat: 'Grasas y extras', prot: 2, kcal: 160 },
    { id: 'aceite', nombre: 'Aceite de oliva', porcion: '1 cucharada', cat: 'Grasas y extras', prot: 0, kcal: 120 },
    { id: 'frutos-secos', nombre: 'Frutos secos', porcion: '30 g', cat: 'Grasas y extras', prot: 6, kcal: 180 },
    { id: 'miel', nombre: 'Miel', porcion: '1 cucharada', cat: 'Grasas y extras', prot: 0, kcal: 60 },
    { id: 'barrita', nombre: 'Barrita de proteína', porcion: '1 unidad', cat: 'Grasas y extras', prot: 15, kcal: 200 },
    { id: 'milanesa', nombre: 'Milanesa de carne al horno', porcion: '1 unidad', cat: 'Salidas', prot: 30, kcal: 330 },
    { id: 'empanada', nombre: 'Empanada', porcion: '1 unidad', cat: 'Salidas', prot: 9, kcal: 280 },
    { id: 'pizza', nombre: 'Pizza', porcion: '1 porción', cat: 'Salidas', prot: 12, kcal: 300 },
    { id: 'hamburguesa', nombre: 'Hamburguesa con pan', porcion: '1 unidad', cat: 'Salidas', prot: 28, kcal: 550 },
    { id: 'fernet', nombre: 'Fernet con coca zero', porcion: '1 trago', cat: 'Salidas', prot: 0, kcal: 130 },
    { id: 'cerveza', nombre: 'Cerveza', porcion: '1 vaso (330 ml)', cat: 'Salidas', prot: 1, kcal: 140 },
  ],
  // Comidas armadas: [id del alimento, cantidad de porciones]
  comidasTipo: [
    { nombre: 'Desayuno tipo', items: [['huevo', 3], ['avena', 1], ['fruta', 1]] },
    { nombre: 'Almuerzo tipo', items: [['pollo', 2], ['verduras', 1], ['arroz', 1]] },
    { nombre: 'Pre-entreno tipo', items: [['yogur', 1], ['banana', 1], ['tostada', 2], ['miel', 1]] },
    { nombre: 'Cena tipo', items: [['carne', 2], ['verduras', 1], ['papa', 1]] },
  ],

  // ------------------------------------------------------------
  //  TESTS cada 4 semanas
  // ------------------------------------------------------------
  tests: {
    fechas: [
      { id: 't1', nombre: 'Semana 1', fecha: '2026-09-29' },
      { id: 't2', nombre: '26 de oct', fecha: '2026-10-26' },
      { id: 't3', nombre: '23 de nov', fecha: '2026-11-23' },
      { id: 't4', nombre: '21 de dic', fecha: '2026-12-21' },
    ],
    campos: [
      { id: 'peso', nombre: 'Peso', unidad: 'kg', nota: 'Promedio de 3 mañanas en ayunas', tres: true },
      { id: 'cintura', nombre: 'Cintura', unidad: 'cm', nota: 'A la altura del ombligo' },
      { id: 'dominadas', nombre: 'Dominadas', unidad: 'reps', nota: 'Estrictas, máximas' },
      { id: 'skierg', nombre: 'SkiErg 5 min', unidad: 'm', nota: 'Metros en 5 min' },
      { id: 'popups', nombre: 'Pop-ups', unidad: 'reps', nota: 'Limpios en 60 s' },
    ],
    pesoObjetivo: [69, 70],
  },

  // ------------------------------------------------------------
  //  REGLAS
  // ------------------------------------------------------------
  reglas: {
    progresion: 'Cuando completás el tope de reps en todas las series, subí 2–2,5 kg en tren superior o 5 kg en piernas.',
    ajuste: [
      'Peso sin moverse 2 semanas: bajar 150 kcal.',
      'Bajás más de 0,5 kg por semana o perdés fuerza: subir 150 kcal.',
      'Cargado, sin explosión o durmiendo mal: adelantar la descarga.',
      'Si faltás un día, seguí con el siguiente. No lo recuperes.',
    ],
    seguridad: [
      'Primera ronda de cada sesión al 70 %.',
      'Después de intervalos, caminar 3–5 min. Nunca parar de golpe.',
      'Mareo, visión borrosa o FC que no baja: cortar la sesión y consultar al médico.',
      'En la pileta, nunca entrenar apnea solo.',
    ],
  },
  // ------------------------------------------------------------
  //  TÉCNICA — se ve al tocar el nombre de cada ejercicio.
  //  pasos: claves cortas · error: error típico · video: qué buscar en YouTube
  // ------------------------------------------------------------
  tecnica: {
    dominadas: {
      pasos: ['Agarre prono apenas más ancho que los hombros, brazos bien estirados abajo.', 'Arrancá bajando las escápulas y llevá el pecho hacia la barra hasta pasar el mentón.', 'Bajá controlado (2 s) hasta estirar del todo.'],
      error: 'Balancearte o cortar el recorrido a la mitad.', video: 'dominadas técnica correcta',
    },
    'press-incl': {
      pasos: ['Banco a 30–45°, escápulas juntas y apoyadas.', 'Bajá las mancuernas al pecho alto, codos a ~45° del torso.', 'Empujá arriba y un poco hacia adentro, sin chocarlas.'],
      error: 'Abrir los codos a 90°: carga el hombro.', video: 'press inclinado con mancuernas técnica',
    },
    'remo-pecho': {
      pasos: ['Pecho apoyado en el banco inclinado, brazos colgando.', 'Llevá los codos hacia atrás y hacia la cadera, juntando las escápulas.', 'Pausa de 1 s arriba y bajá controlado.'],
      error: 'Despegar el pecho del banco para tironear.', video: 'chest supported row dumbbell',
    },
    'press-militar': {
      pasos: ['De pie, glúteos y abdomen apretados, mancuernas a la altura de los hombros.', 'Empujá vertical hasta estirar los brazos.', 'Bajá controlado hasta los hombros.'],
      error: 'Arquear la zona lumbar para ayudarte.', video: 'press militar de pie con mancuernas técnica',
    },
    pullover: {
      pasos: ['Polea alta, inclinado levemente hacia adelante, brazos casi rectos.', 'Llevá la barra en arco hasta los muslos usando los dorsales.', 'Volvé lento hasta sentir el estiramiento arriba.'],
      error: 'Doblar los codos y convertirlo en un ejercicio de tríceps.', video: 'straight arm pulldown cable',
    },
    facepull: {
      pasos: ['Polea a la altura de la cara, soga con agarre neutro.', 'Tirá hacia la frente separando las manos, codos altos.', 'Terminá con los puños al lado de las orejas, pausa de 1 s.'],
      error: 'Inclinarte hacia atrás y tirar con la espalda baja.', video: 'face pull técnica',
    },
    'rot-ext': {
      pasos: ['Banda a la altura del codo, codo pegado al costado y doblado a 90°.', 'Rotá el antebrazo hacia afuera sin despegar el codo.', 'Volvé lento.'],
      error: 'Separar el codo del cuerpo.', video: 'rotación externa hombro banda',
    },
    'bici-tri': {
      pasos: ['Bíceps: codos quietos al costado, subí sin balancear el torso.', 'Tríceps: codos fijos, extendé del todo.', 'Pasá de uno al otro sin pausa; el descanso va al final del par.'],
      error: 'Usar impulso con la espalda.', video: 'superserie bíceps tríceps',
    },
    'popups-tec': {
      pasos: ['Boca abajo, manos debajo del pecho, como en la tabla.', 'Empujá y llevá los pies debajo del cuerpo en un solo movimiento.', 'Caé en posición de surf: pie delantero entre las manos, rodillas flexionadas, mirada al frente.'],
      error: 'Apoyar las rodillas o pararte en dos tiempos.', video: 'surf pop up técnica',
    },
    'popups-exp': {
      pasos: ['Misma técnica que el pop-up técnico, a máxima velocidad.', 'Empujá explosivo: el pecho se despega y los pies caen juntos en posición.', 'Si una rep sale sucia, cortá la serie.'],
      error: 'Sacrificar la técnica por velocidad.', video: 'explosive surf pop up drill',
    },
    saltos: {
      pasos: ['A un paso del cajón, brazos atrás.', 'Balanceá los brazos y saltá explosivo; caé suave con las rodillas flexionadas.', 'Bajá caminando, no saltando. Cada salto, a fondo.'],
      error: 'Usar un cajón tan alto que te obliga a caer en sentadilla profunda.', video: 'box jump técnica',
    },
    sentadilla: {
      pasos: ['Barra sobre los trapecios (trasera) o adelante sobre los hombros (frontal); pies al ancho de los hombros.', 'Tomá aire, apretá el abdomen y bajá con las rodillas en la línea de los pies hasta por lo menos la paralela.', 'Subí empujando el piso, pecho arriba.'],
      error: 'Rodillas hacia adentro o talones que se levantan.', video: 'sentadilla con barra técnica',
    },
    rumano: {
      pasos: ['Barra en las manos, rodillas apenas flexionadas.', 'Llevá la cadera hacia atrás con la espalda neutra y la barra pegada a las piernas.', 'Bajá hasta sentir tensión en los isquios y subí apretando los glúteos.'],
      error: 'Redondear la espalda o convertirlo en sentadilla.', video: 'peso muerto rumano técnica',
    },
    bulgara: {
      pasos: ['Pie de atrás apoyado en un banco, el de adelante a un paso largo.', 'Bajá vertical hasta que la rodilla de atrás casi toque el piso.', 'Subí empujando con el talón de adelante.'],
      error: 'Pie de adelante demasiado cerca del banco.', video: 'sentadilla búlgara técnica',
    },
    balon: {
      pasos: ['De costado a la pared, a 1–2 m, balón a la altura de la cadera.', 'Cargá rotando hacia atrás y soltá girando primero la cadera, después el torso y los brazos.', 'Atrapá el rebote y repetí.'],
      error: 'Tirar solo con los brazos, sin rotar la cadera.', video: 'rotational medicine ball throw',
    },
    pallof: {
      pasos: ['De costado a la polea o la banda, agarre a la altura del pecho.', 'Estirá los brazos al frente sin dejar que el torso gire.', 'Pausa de 2 s y volvé.'],
      error: 'Dejar que la cadera o el torso giren hacia la polea.', video: 'pallof press técnica',
    },
    banca: {
      pasos: ['Ojos debajo de la barra, escápulas juntas y abajo, pies firmes en el piso.', 'Bajá la barra controlada hasta el esternón, codos a ~45–70°.', 'Empujá arriba y levemente hacia la cara.'],
      error: 'Rebotar la barra en el pecho o despegar la cola del banco.', video: 'press banca técnica correcta',
    },
    'remo-una': {
      pasos: ['Mano y rodilla apoyadas en el banco, espalda plana.', 'Llevá la mancuerna hacia la cadera, codo cerca del cuerpo.', 'Bajá hasta estirar el dorsal, sin rotar el torso.'],
      error: 'Rotar el torso para subir más peso.', video: 'remo a una mano con mancuerna técnica',
    },
    fondos: {
      pasos: ['Brazos estirados en las paralelas, hombros abajo.', 'Bajá con el torso levemente inclinado hasta que los hombros queden a la altura de los codos.', 'Subí hasta estirar los brazos.'],
      error: 'Bajar de más con los hombros hacia adelante.', video: 'fondos en paralelas técnica',
    },
    jalon: {
      pasos: ['Agarre neutro, pecho arriba, apenas inclinado hacia atrás.', 'Llevá la barra al pecho alto bajando los codos hacia las costillas.', 'Subí controlado hasta estirar.'],
      error: 'Tirar con impulso hacia atrás.', video: 'jalón al pecho agarre neutro',
    },
    laterales: {
      pasos: ['De pie, mancuernas al costado, codos apenas flexionados.', 'Subí hacia los costados hasta la altura de los hombros, guiando con los codos.', 'Bajá lento (2 s).'],
      error: 'Subir con impulso o encogiendo los hombros.', video: 'elevaciones laterales técnica',
    },
    ytw: {
      pasos: ['Boca abajo en banco inclinado, pulgares arriba, peso muy liviano o sin peso.', 'Y: brazos en diagonal arriba. T: al costado. W: codos flexionados hacia atrás, juntando las escápulas.', 'Pausa de 1–2 s en cada posición.'],
      error: 'Usar mucho peso y encoger el cuello.', video: 'YTW incline bench',
    },
    core: {
      pasos: ['Rueda: desde las rodillas, rodá adelante con la cola apretada y la lumbar firme, y volvé.', 'Plancha lateral: codo debajo del hombro, cuerpo en línea recta.', 'Hollow hold: lumbar pegada al piso, brazos y piernas estirados y despegados.'],
      error: 'Arquear la zona lumbar.', video: 'hollow hold rueda abdominal plancha lateral',
    },
    'vie-popups': {
      pasos: ['30 s de SkiErg a fondo.', 'Bajá a la colchoneta y hacé 3 pop-ups limpios.', '30 s de pausa y repetí.'],
      error: 'Pop-ups desprolijos por el cansancio: mejor más lentos pero perfectos.', video: 'surf pop up',
    },
    'vie-surf': {
      pasos: ['Boca abajo en banco inclinado, bandas enganchadas adelante.', 'Remá alternando brazos como en la tabla: entra la mano y tirás hasta la cadera.', 'Pecho arriba, mirada al frente, ritmo constante.'],
      error: 'Bajar la cabeza y perder la extensión de la espalda.', video: 'surf paddle training resistance bands',
    },
    // reemplazos (oct 2026)
    'pullover-manc': { pasos: ['Espalda alta apoyada en el banco, mancuerna con las dos manos sobre el pecho.', 'Bajala en arco por detrás de la cabeza con los codos apenas flexionados, hasta sentir los dorsales.', 'Volvé al pecho apretando la espalda, sin arquear la lumbar.'], error: 'Doblar mucho los codos y convertirlo en tríceps.', video: 'pullover con mancuerna técnica' },
    'facepull-trx': { pasos: ['Agarrá las manijas con las palmas hacia abajo, cuerpo inclinado hacia atrás y recto.', 'Tirá hacia la frente abriendo los codos alto y juntando las escápulas.', 'Volvé lento. Más inclinado = más difícil.'], error: 'Tirar con los brazos sin juntar las escápulas.', video: 'TRX face pull' },
    curl: { pasos: ['De pie, mancuernas al costado, palmas hacia adelante.', 'Subí doblando solo el codo, sin mover los hombros ni balancear.', 'Bajá lento (2 s) hasta estirar del todo.'], error: 'Balancear el torso para subir más peso.', video: 'curl de bíceps con mancuernas técnica' },
    'triceps-ext': { pasos: ['Sentado o de pie, una mancuerna con las dos manos arriba de la cabeza.', 'Bajala por detrás de la cabeza doblando solo los codos, que apuntan al techo.', 'Subí hasta estirar los brazos.'], error: 'Abrir los codos hacia los costados.', video: 'extensión de tríceps sobre la cabeza mancuerna' },
    'dom-asist': { pasos: ['Banda enganchada en la barra, un pie o rodilla apoyado en la banda.', 'Arrancá bajando las escápulas y subí hasta pasar el mentón.', 'Bajá controlado hasta estirar los brazos.'], error: 'Rebotar abajo usando el impulso de la banda.', video: 'dominadas asistidas con banda' },
    'remo-trx': { pasos: ['Manijas al pecho, cuerpo recto inclinado hacia atrás, talones apoyados.', 'Tirá llevando el pecho hacia las manos, codos cerca del cuerpo y escápulas juntas.', 'Bajá lento sin que se caiga la cadera.'], error: 'Dejar caer la cadera o encoger los hombros.', video: 'TRX row técnica' },
    'remo-banda': { pasos: ['Banda anclada a la altura del pecho, de frente.', 'Tirá hacia el abdomen juntando las escápulas.', 'Volvé lento.'], error: 'Inclinarte hacia atrás para tirar.', video: 'remo con banda elástica' },

    // versiones de casa
    'jalon-banda': { pasos: ['Banda anclada arriba de la puerta, arrodillado o sentado frente a ella.', 'Tirá llevando los codos hacia las costillas, pecho arriba.', 'Volvé lento hasta estirar los brazos.'], error: 'Tirar con los brazos sin bajar las escápulas.', video: 'banded lat pulldown' },
    'pullover-banda': { pasos: ['Banda anclada arriba, brazos casi rectos al frente.', 'Llevá la banda en arco hasta los muslos usando los dorsales.', 'Volvé lento.'], error: 'Doblar los codos.', video: 'banded straight arm pulldown' },
    'saltos-vert': { pasos: ['Pies al ancho de la cadera, brazos atrás.', 'Saltá lo más alto posible balanceando los brazos.', 'Caé suave y frená en media sentadilla antes del próximo.'], error: 'Caer con las piernas rectas.', video: 'squat jump técnica' },
    goblet: { pasos: ['Mancuerna vertical pegada al pecho, codos abajo.', 'Bajá en 3 s entre las rodillas, pecho arriba, pausa de 1 s abajo.', 'Subí empujando el piso.'], error: 'Despegar los talones o redondear la espalda.', video: 'sentadilla goblet técnica' },
    'rumano-1p': { pasos: ['Mancuerna en la mano contraria a la pierna de apoyo.', 'Llevá la cadera atrás y la pierna libre estirada hacia atrás, espalda neutra.', 'Bajá hasta sentir el isquio y subí apretando el glúteo.'], error: 'Abrir la cadera hacia un costado.', video: 'single leg romanian deadlift dumbbell' },
    'pelota-arena': { pasos: ['De costado a la pared, pelota a la altura de la cadera.', 'Rotá primero la cadera y después el torso para soltarla.', 'Si no tenés pared, hacé slams rotacionales al piso.'], error: 'Tirar solo con los brazos.', video: 'rotational slam ball throw' },
    'press-manc': { pasos: ['Acostado en el banco plano, escápulas juntas.', 'Bajá las mancuernas en 3 s al costado del pecho.', 'Empujá arriba sin chocarlas.'], error: 'Bajar rápido y rebotar.', video: 'press con mancuernas banco plano técnica' },
    'flex-elev': { pasos: ['Pies apoyados en el banco, manos un poco más anchas que los hombros.', 'Cuerpo en línea recta, bajá el pecho hasta casi tocar el piso.', 'Empujá hasta estirar los brazos.'], error: 'Dejar caer la cadera.', video: 'decline push up técnica' },
    'core-casa': { pasos: ['Dead bug: boca arriba, lumbar pegada al piso, estirá brazo y pierna contrarios.', 'Plancha lateral: codo debajo del hombro, cuerpo en línea recta.', 'Hollow hold: lumbar pegada al piso, brazos y piernas estirados y despegados.'], error: 'Arquear la zona lumbar.', video: 'dead bug ejercicio' },
    // movilidad
    m1: { pasos: ['Sentado, una pierna adelante y otra al costado, las dos rodillas a 90°.', 'Torso erguido, inclinate un poco sobre la pierna de adelante.', 'Respirá lento y cambiá de lado.'], error: 'Encorvar la espalda.', video: 'cadera 90 90 movilidad' },
    m2: { pasos: ['Rodilla de atrás contra la pared o el sofá, empeine arriba.', 'Pie de adelante firme; apretá el glúteo de la pierna de atrás.', 'Llevá la cadera adelante con el torso erguido.'], error: 'Arquear la lumbar en vez de apretar el glúteo.', video: 'couch stretch' },
    m3: { pasos: ['Pie a unos centímetros de la pared.', 'Llevá la rodilla a tocar la pared sin despegar el talón.', 'Si toca fácil, alejá el pie.'], error: 'Levantar el talón.', video: 'knee to wall ankle mobility' },
    m4: { pasos: ['Piernas bien abiertas.', 'Bajá hacia un lado flexionando esa rodilla; la otra pierna estirada con la punta arriba.', 'Pasá al otro lado sin pararte del todo.'], error: 'Que se levante el talón de la pierna flexionada.', video: 'sentadilla cosaca' },
    m5: { pasos: ['Rolo debajo de la espalda alta (no de la lumbar), manos detrás de la cabeza.', 'Extendé hacia atrás sobre el rolo, costillas abajo.', 'Mové el rolo un poco y repetí.'], error: 'Extender desde la lumbar.', video: 'thoracic extension foam roller' },
    m6: { pasos: ['De costado, rodillas flexionadas a 90°, brazos juntos adelante.', 'Abrí el brazo de arriba hacia el otro lado siguiéndolo con la mirada.', 'Rodillas juntas y apoyadas todo el tiempo.'], error: 'Separar las rodillas.', video: 'open book stretch' },
    m7: { pasos: ['Antebrazo apoyado en el marco, codo a la altura del hombro.', 'Da un paso adelante hasta sentir el estiramiento en el pecho.', 'Hombro abajo, sin forzar.'], error: 'Encoger el hombro.', video: 'doorway pec stretch' },
    m8: { pasos: ['Banda con agarre bien ancho, brazos estirados.', 'Pasala por arriba de la cabeza hasta atrás y volvé.', 'Si molesta, abrí más el agarre.'], error: 'Doblar los codos.', video: 'shoulder dislocates band' },
    m9: { pasos: ['Boca abajo, manos debajo de los hombros.', 'Empujá y extendé la espalda, respirando profundo arriba.', 'Bajá y hacé un pop-up lento con 2 s de pausa abajo.'], error: 'Hombros encogidos hacia las orejas.', video: 'cobra stretch' },
  },
};
