# ⚡ Auto Test — Autonomous AI Browser Agent & Testing Edition

Bienvenido a **Auto Test**, la edición de pruebas y experimentación de la extensión de Chrome de última generación con soporte para conexión directa a APIs en la nube (Gemini, Claude, OpenAI) y al **Antigravity Bridge** local (`http://127.0.0.1:8765`).

---

## 🚀 ¿Qué novedades incluye?

### 1. Dos Modos Especializados (Inspirado en Claude / Antigravity)
- **💬 Modo Chat**:
  - **Ultrarrápido y sin retrasos**: No realiza acciones ni mutaciones en el DOM.
  - **Acceso a toda la pantalla en JSON**: Extrae de un solo golpe el título, la URL, los encabezados, los botones y campos interactivos, y el contenido legible en un formato estructurado ligero (< 15KB).
  - **Cero dependencia obligatoria de imágenes**: El modelo analiza la estructura de la página instantáneamente.
  - **Opción de foto bajo demanda (📸)**: Si quieres que el modelo vea el diseño visual, puedes activar el botón de captura con un solo clic.
- **🤖 Modo Cowork**:
  - **Agente autónomo de acción**: Planifica y ejecuta pasos reales en el navegador (clics en botones, escritura en campos, navegación y scroll).
  - Muestra tarjetas de pasos detalladas con razonamiento, acción y verificación.

### 2. Integración con Antigravity Bridge Local
- Totalmente compatible con tu servidor local en `http://127.0.0.1:8000` (FastAPI).
- **Cero problemas de CORS / Cross-Origin**: Los permisos `host_permissions: ["<all_urls>", "http://127.0.0.1:*/*"]` otorgan acceso directo y seguro.
- **Modelos Precargados y Dinámicos**:
  - `Gemini 3.8 Flash (High)` (Predeterminado, ultra rápido y eficaz)
  - `Gemini 3.8 Flash (Medium)`
  - `Gemini 3.7 Flash (High)`
  - `Gemini 3.1 Pro (High)`
  - `Claude Sonnet 5.5` / `Claude Opus 5.5`
  - `GPT-OSS 120B (Medium)`

### 3. Tema y Animaciones Oficiales Antigravity
- **Paleta Deep Space Obsidian**: Fondos oscuros con acentos *Electric Cyan* (`#00f2fe`) y *Cosmic Violet* (`#8b5cf6`).
- **Animaciones fluidas**:
  - `@keyframes antigravity-float`: Levitación suave del logotipo y componentes.
  - `@keyframes cosmic-pulse`: Brillo pulsante cósmico en el estado de conexión del bridge y elementos activos.
  - `@keyframes stream-shimmer`: Barrido de luz para los estados de pensamiento y generación.
- **Logotipo oficial Antigravity** en vector SVG y formatos de alta resolución (16, 32, 48, 128 px).

### 4. Persistencia en Segundo Plano
- El **Service Worker** (`background.js`) mantiene el estado de las tareas y conversaciones activas en `chrome.storage.local`.
- Si cierras el panel lateral o cambias de pestaña, **la sesión se mantiene iniciada y la tarea en ejecución continúa en segundo plano sin interrumpirse**.

---

## 🛠️ Cómo Cargar la Extensión en Google Chrome

1. Abre Google Chrome y escribe en la barra de direcciones:
   ```
   chrome://extensions
   ```
2. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"** (Developer mode).
3. Haz clic en el botón **"Cargar descomprimida"** (Load unpacked).
4. Selecciona la carpeta `Autotest` (dentro de este repositorio).
5. ¡Listo! Verás aparecer el icono con el logo de **Auto Test**.
6. Haz clic en el icono del puzzle en Chrome y fija el icono de Auto Test en tu barra de herramientas.

---

## ⚡ Conexión con Antigravity Bridge

1. Asegúrate de tener tu bridge activo ejecutando:
   `Iniciar-AntigravityBridge.bat` (o el acceso directo en el Escritorio).
2. Abre el panel lateral de Antigravity en Chrome.
3. El indicador mostrará:
   - 🟢 **Bridge: Activo (8000)** cuando esté listo.
   - Si dice 🔴 **Desconectado**, simplemente haz clic en el botón de estado para reconectar al momento.
