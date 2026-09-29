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
// ============================================================

window.PLAN = {
  lunesSemana1: '2026-09-28', // para numerar las semanas

  // 0 = domingo … 6 = sábado
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
      titulo: 'Tren superior A', sub: 'Tracción + pop-ups', duracion: '70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'dominadas', nombre: 'Dominadas', series: 4, reps: '5–8', descanso: 120, nota: 'Con lastre si hacés más de 10' },
        { id: 'press-incl', nombre: 'Press inclinado con mancuernas', series: 3, reps: '8–10', descanso: 120 },
        { id: 'remo-pecho', nombre: 'Remo con pecho apoyado', series: 3, reps: '8–10', descanso: 90 },
        { id: 'press-militar', nombre: 'Press militar de pie con mancuernas', series: 3, reps: '8–10', descanso: 90 },
        { id: 'pullover', nombre: 'Pullover en polea con brazos rectos', series: 3, reps: '12', descanso: 60 },
        { id: 'facepull', nombre: 'Face pull', series: 3, reps: '15', descanso: 45 },
        { id: 'rot-ext', nombre: 'Rotación externa con banda', series: 2, reps: '15', descanso: 45, sinPeso: true },
        { id: 'bici-tri', nombre: 'Bíceps + tríceps en superserie', series: 3, reps: '10–12', descanso: 60 },
        { id: 'popups-tec', nombre: 'Pop-ups técnicos', series: 3, reps: '5', descanso: 45, nota: 'Lentos y perfectos', sinPeso: true },
      ],
    },

    z2: {
      titulo: 'Zona 2 + movilidad', sub: '45 min de cardio suave + 15 min de movilidad', duracion: '60 min',
      tipo: 'cardio',
      items: [
        { id: 'z2', nombre: 'Zona 2', series: 1, texto: '45 min', sinPeso: true, nota: 'SkiErg, remo, bici o crol. Ritmo que te deje hablar (60–70 % de la FC máx.)' },
        { seccion: 'Movilidad completa (15 min)' },
        { movilidadCompleta: true },
      ],
    },

    piernas: {
      titulo: 'Piernas + potencia', sub: 'Con pop-ups', duracion: '70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'saltos', nombre: 'Saltos al cajón', series: 4, reps: '3', descanso: 90, nota: 'Siempre primero', sinPeso: true },
        { id: 'sentadilla', nombre: 'Sentadilla trasera o frontal', series: 4, reps: '5–6', descanso: 150, descansoTxt: '2–3 min' },
        { id: 'rumano', nombre: 'Peso muerto rumano', series: 3, reps: '8', descanso: 120 },
        { id: 'bulgara', nombre: 'Sentadilla búlgara', series: 3, reps: '8 por pierna', descanso: 90 },
        { id: 'balon', nombre: 'Lanzamiento rotacional de balón medicinal a la pared', series: 3, reps: '6 por lado', descanso: 60 },
        { id: 'pallof', nombre: 'Pallof press', series: 3, reps: '10 por lado', descanso: 45 },
        { id: 'popups-exp', nombre: 'Pop-ups explosivos', series: 4, reps: '5', descanso: 60, sinPeso: true },
      ],
    },

    supB: {
      titulo: 'Tren superior B', sub: 'Empuje + hombro + core', duracion: '60–70 min',
      tipo: 'fuerza', movilidadEntrada: true,
      items: [
        { id: 'banca', nombre: 'Press banca con barra', series: 4, reps: '5–8', descanso: 150, descansoTxt: '2–3 min' },
        { id: 'remo-una', nombre: 'Remo a una mano con mancuerna', series: 3, reps: '8–10 por lado', descanso: 90 },
        { id: 'fondos', nombre: 'Fondos en paralelas', series: 3, reps: '8–12', descanso: 90, nota: 'Con lastre si hacés más de 12' },
        { id: 'jalon', nombre: 'Jalón al pecho con agarre neutro', series: 3, reps: '10', descanso: 90 },
        { id: 'laterales', nombre: 'Elevaciones laterales', series: 4, reps: '12–15', descanso: 45 },
        { id: 'ytw', nombre: 'Y-T-W boca abajo en banco inclinado', series: 2, reps: '8 de cada letra', descanso: 45 },
        { id: 'core', nombre: 'Core', series: 3, texto: '{s} rondas', descanso: 60, nota: 'Rueda abdominal + plancha lateral + hollow hold', sinPeso: true },
      ],
    },

    viernes: {
      titulo: 'Intervalos de remada', sub: 'SkiErg, remo o crol + pop-ups bajo fatiga', duracion: '50 min',
      tipo: 'cardio', movilidadEntrada: true,
      items: [
        { id: 'vie-entrada', nombre: 'Entrada en calor', series: 1, texto: '8 min suaves + 2 aceleraciones de 15 s', sinPeso: true, fijo: true },
        { intervalos: true }, // acá van los intervalos del bloque actual
        { id: 'vie-popups', nombre: 'Pop-ups bajo fatiga', series: 4, texto: '{s} rondas', descanso: 30, descansoTxt: '30 s de pausa', nota: '30 s de SkiErg a fondo → 3 pop-ups → 30 s de pausa', sinPeso: true },
        { id: 'vie-surf', nombre: 'Remada de surf en banco inclinado con bandas', series: 3, texto: '{s} × 60 s', descanso: 60, sinPeso: true },
        { id: 'vie-calma', nombre: 'Vuelta a la calma', series: 1, texto: '5 min caminando', nota: 'Nunca parar de golpe', sinPeso: true, fijo: true },
      ],
    },

    sabado: {
      titulo: 'Pádel', sub: 'Si no hay pádel: zona 2 de 40 min', duracion: '',
      tipo: 'cardio',
      items: [
        { id: 'padel', nombre: 'Pádel', series: 1, texto: 'Partido', nota: 'Si no hay: zona 2 de 40 min', sinPeso: true },
      ],
    },

    domingo: {
      titulo: 'Descanso real', sub: 'Movilidad suave 15–20 min', duracion: '',
      tipo: 'descanso',
      items: [
        { seccion: 'Movilidad suave (15–20 min)' },
        { movilidadCompleta: true },
      ],
    },
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
      fuerza: '+1 serie de laterales y brazos. Accesorios con 45 s de descanso.',
      viernesTxt: '3 × 5 min / 2 min + 8 sprints de 20 s',
      comida: '~2.250 kcal',
      macros: { kcal: 2250, prot: 140, grasa: 70, carbs: 265 },
      intervalos: [
        { id: 'int-5min', nombre: 'Intervalos', series: 3, texto: '{s} × 5 min fuerte / 2 min suave', descanso: 120, descansoTxt: '2 min suave', nota: 'A 7–8/10 de esfuerzo' },
        { id: 'spr-20', nombre: 'Sprints', series: 8, texto: '{s} × 20 s', sinPeso: true },
      ],
      ajustes: {
        laterales: { series: 5 },
        'bici-tri': { series: 4, descanso: 45 },
        // accesorios a 45 s
        pullover: { descanso: 45 },
        facepull: { descanso: 45 },
        ytw: { descanso: 45 },
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
};
