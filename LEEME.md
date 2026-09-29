# Entreno — web app personal

## Archivos
- `plan.js` → **todo el contenido del plan**. Para cambiar un ejercicio, una serie, un descanso o una comida, editás solo este archivo.
- `app.js` → lógica (fecha y bloque, temporizador, guardado, gráfico, backup).
- `index.html`, `styles.css` → estructura y diseño.
- `sw.js`, `manifest.webmanifest`, `icons/` → instalable y offline.

Tus registros (pesos, series, proteína, tests) se guardan en el celular (localStorage). Exportá un backup desde **Progreso → Backup** cada tanto.

## Probar otro día
Agregá `?fecha=2026-10-21` al final de la URL para ver lo que muestra la app ese día.

## Publicar gratis en GitHub Pages
1. Creá una cuenta en https://github.com (si no tenés).
2. Arriba a la derecha: **+ → New repository**. Nombre: `entreno`. Dejalo **Public** (Pages gratis lo pide). Tocá **Create repository**.
3. En la pantalla del repo vacío: **uploading an existing file**. Arrastrá **todo el contenido** de la carpeta `entreno` (incluida la carpeta `icons`). **Commit changes**.
4. **Settings → Pages**. En *Branch* elegí `main` y `/ (root)` → **Save**.
5. Esperá 1–2 min y recargá: arriba aparece la URL, tipo `https://TU-USUARIO.github.io/entreno/`.

### Cambiar el plan después
En GitHub, abrí `plan.js` → ícono del lápiz → editás → **Commit changes**. En 1–2 min, al abrir la app con señal, ya ves el cambio.

## Agregar a la pantalla de inicio
**iPhone (Safari, no Chrome):** abrí la URL → botón Compartir (cuadrado con flecha) → **Agregar a inicio** → Agregar.
**Android (Chrome):** abrí la URL → menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).

Abrila siempre desde el ícono: en iPhone, los datos del ícono y los de Safari son independientes.
