# ScanX — Barcode & QR Scanner PWA

> Escáner de códigos de barras y QR progresivo para móvil. Funciona instalado desde el navegador, sin App Store.

![ScanX Preview](icons/icon-512.png)

## Características

- **Detección automática** de 12+ formatos: QR, EAN-13, EAN-8, Code 128, Code 39, UPC-A, UPC-E, ITF, Data Matrix, PDF 417, Aztec, Codabar
- **PWA instalable** — aparece en la pantalla de inicio como app nativa
- **Modo offline** — funciona sin internet gracias al Service Worker
- **Linterna** — control de torch integrado (dispositivos compatibles)
- **Cámara frontal/trasera** — flip instantáneo
- **Historial persistente** — últimas 50 detecciones guardadas en localStorage
- **Copiar y abrir URLs** — acción rápida sobre cada resultado
- **Vibración háptica** al detectar
- **Diseño oscuro** optimizado para luz ambiente baja

## Formatos Soportados

| Formato       | Uso común                          |
|---------------|------------------------------------|
| QR Code       | URLs, contactos, texto             |
| EAN-13        | Productos en tiendas               |
| EAN-8         | Productos pequeños                 |
| Code 128      | Logística, industria               |
| Code 39       | Inventario, automotriz             |
| UPC-A         | Productos EE.UU.                   |
| UPC-E         | Productos pequeños EE.UU.          |
| ITF           | Cajas de cartón / palets           |
| Data Matrix   | Industria / farmacéutica           |
| PDF 417       | ID, boarding passes                |
| Aztec         | Transporte público                 |
| Codabar       | Bibliotecas, bancos de sangre      |

## Deploy en GitHub Pages

### 1. Crear repositorio

```bash
git init
git add .
git commit -m "feat: initial ScanX PWA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/scanx.git
git push -u origin main
```

### 2. Activar GitHub Pages

1. Ve a **Settings → Pages**
2. Source: **Deploy from branch**
3. Branch: `main` → `/` (root)
4. Guarda — en ~1 minuto estará en:  
   `https://TU_USUARIO.github.io/scanx/`

### 3. Instalar en el teléfono

**Android (Chrome):**
1. Abre la URL en Chrome
2. Menú (⋮) → "Añadir a pantalla de inicio"

**iOS (Safari):**
1. Abre la URL en Safari
2. Compartir (↑) → "Añadir a pantalla de inicio"

> ⚠️ La cámara requiere HTTPS. GitHub Pages provee HTTPS automáticamente.

## Estructura del proyecto

```
scanx/
├── index.html        # App principal
├── app.js            # Lógica: cámara, ZXing decoder, historial
├── sw.js             # Service Worker (offline + cache)
├── manifest.json     # PWA manifest
├── icons/
│   ├── icon-192.png  # Icono app
│   └── icon-512.png  # Icono splash
└── README.md
```

## Stack técnico

- **ZXing** (`@zxing/library`) — decodificación de códigos de barras
- **MediaDevices API** — acceso a cámara con facingMode
- **Service Worker** — estrategia cache-first + network-first para CDN
- **Web App Manifest** — instalación PWA
- **Vibration API** — feedback háptico
- **Clipboard API** — copia rápida
- Vanilla HTML/CSS/JS — cero frameworks, carga instantánea

## Personalización

### Cambiar colores (variables CSS en `index.html`)

```css
:root {
  --accent: #C9A84C;    /* Color dorado principal */
  --bg: #0A0A0A;        /* Fondo oscuro */
  --success: #4ECDC4;   /* Flash de éxito */
}
```

### Límite de historial

En `app.js`, línea:
```js
if (state.history.length > 50) state.history.pop();
```

### Cooldown entre escaneos

```js
}, 1800); // ms de espera entre detecciones del mismo código
```

## Licencia

MIT — uso libre, comercial o personal.

---

Desarrollado con [Horus System Co.](https://horussystemco.com) · Reynosa, Tamaulipas
