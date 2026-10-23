# Partiditas — app web de registro de juegos

App web responsive hecha con React + Vite, preparada para publicarse en Vercel y guardar los datos en Google Sheets mediante Google Apps Script. No usa `localStorage` ni IndexedDB para las partidas.

## Qué incluye esta base

- Mesas/grupos independientes, cada uno con su propio historial.
- Juegos: Chinchón, Escoba de 15, Truco, Rummy y contador libre.
- Jugadores con nombres editables y cantidad variable.
- Carga de rondas con puntos positivos o negativos.
- Historial de partidas y ganador al finalizar.
- Configuración inicial de objetivo, unidad y si gana el puntaje más alto o más bajo.
- Diseño responsive tipo notas adhesivas.
- Proxy `/api/games` para que el navegador no llame directamente a Apps Script.

> **Estado de esta versión:** es un esqueleto funcional inicial. La regla de victoria se configura por dirección y objetivo, pero cada juego puede tener reglas particulares que requieren ajustes (por ejemplo, puntos por escoba, flor/envido/truco o cierre de Chinchón). El objetivo se muestra en la configuración; esta versión todavía no fuerza automáticamente el cierre al alcanzarlo.

## 1. Crear la planilla

1. En Google Drive, creá una planilla nueva llamada `Partiditas DB`.
2. Copiá el ID de la URL: en `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`.
3. En **Extensiones → Apps Script**, abrí el editor.
4. Reemplazá el contenido de `Code.gs` con `google-apps-script/Code.gs` de este proyecto.
5. En **Configuración del proyecto → Propiedades del script**, agregá una propiedad:
   - Nombre: `SPREADSHEET_ID`
   - Valor: el ID de tu planilla.
6. Guardá el proyecto.

El script crea automáticamente las pestañas `Groups`, `Games`, `Rounds` y `Rules` cuando recibe la primera solicitud.

## 2. Publicar Apps Script como aplicación web

1. En Apps Script, seleccioná **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: para la primera prueba podés seleccionar **Cualquier usuario** si tu cuenta ofrece esa opción.
5. Implementá y autorizá los permisos de Google Sheets.
6. Copiá la URL que termina en `/exec`.

**Seguridad:** esta opción permite que el endpoint sea invocado públicamente. El código incluye claves opcionales por mesa, pero el listado de grupos es público y las claves simples no son un sistema de autenticación fuerte. Para datos sensibles o una app de uso amplio, agregá autenticación real, límites de solicitudes y validación del lado servidor antes de publicarla. No guardes información personal sensible.

## 3. Configurar y probar en tu computadora

Requiere Node.js LTS instalado.

```bash
npm install
cp .env.example .env
```

Editá `.env` y reemplazá el valor de `GOOGLE_APPS_SCRIPT_URL` por la URL `/exec` de tu implementación.

```bash
npm run dev
```

Abrí la URL local que muestre Vite. Para comprobar la compilación:

```bash
npm run build
```

Nota: el endpoint `/api/games` usa formato de función serverless de Vercel. Para probar toda la integración en local, lo más simple es publicar una primera versión en Vercel; alternativamente, se puede instalar Vercel CLI y ejecutar `vercel dev`.

## 4. Subir a GitHub

1. Creá un repositorio nuevo, por ejemplo `partiditas`.
2. Descomprimí este proyecto y abrí una terminal en esa carpeta.
3. Ejecutá:

```bash
git init
git add .
git commit -m "Primera versión de Partiditas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/partiditas.git
git push -u origin main
```

No subas `.env` ni claves privadas al repositorio.

## 5. Publicar en Vercel con URL gratuita

1. Entrá a Vercel e iniciá sesión con GitHub.
2. Elegí **Add New → Project** y seleccioná el repositorio `partiditas`.
3. Vercel debería detectar Vite automáticamente. Build command: `npm run build`; output directory: `dist`.
4. En **Settings → Environment Variables**, agregá `GOOGLE_APPS_SCRIPT_URL` con la URL `/exec` de Apps Script.
5. Publicá. Vercel te asignará una URL gratuita con formato similar a `https://partiditas-tuusuario.vercel.app` (el nombre exacto depende de la disponibilidad).

Cada `git push` a la rama conectada puede disparar una nueva publicación.

## 6. Cómo se guardan los datos

- `Groups`: nombre e ID de cada mesa, hash de la clave opcional y configuración.
- `Games`: metadatos de cada partida, participantes, reglas y estado.
- `Rounds`: puntajes por ronda y notas.
- `Rules`: configuración por mesa.

Los datos se envían al servidor y se guardan en Sheets. El navegador no persiste partidas localmente. La caché técnica del navegador para recursos estáticos no es la base de datos.

## Próximas mejoras recomendadas

1. Login o invitaciones seguras por mesa.
2. Edición y eliminación de rondas con auditoría.
3. Reglas específicas de cada juego y desempates.
4. Vista de estadísticas por jugador.
5. Exportar el historial a CSV/PDF.
6. Pruebas de concurrencia si varias personas cargan puntajes al mismo tiempo.
