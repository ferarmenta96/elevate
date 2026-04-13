# 🌟 Mundo Mágico — Guía de Deploy en GitHub Pages

## Archivos del proyecto
```
mundo-magico/
├── index.html       ← Juego completo
├── manifest.json    ← Config PWA
├── sw.js            ← Service Worker (modo offline)
└── README.md        ← Esta guía
```

## 🚀 Pasos para subir a GitHub Pages

### 1. Crear repositorio en GitHub
1. Ve a github.com → "New repository"
2. Nombre: `mundo-magico`
3. Marca como **Public**
4. Click "Create repository"

### 2. Subir archivos
Opción A — Desde el navegador (más fácil):
1. En tu repo → "Add file" → "Upload files"
2. Arrastra los 3 archivos: `index.html`, `manifest.json`, `sw.js`
3. Click "Commit changes"

Opción B — Con Git:
```bash
git init
git add .
git commit -m "Mundo Mágico v1"
git remote add origin https://github.com/TU_USUARIO/mundo-magico.git
git push -u origin main
```

### 3. Activar GitHub Pages
1. Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Save

✅ En ~2 minutos tu juego estará en:
`https://TU_USUARIO.github.io/mundo-magico/`

---

## 📱 Instalar como app en iPhone/iPad

1. Abre Safari (no Chrome, debe ser Safari)
2. Ve a `https://TU_USUARIO.github.io/mundo-magico/`
3. Toca el botón **Compartir** (cuadrado con flecha)
4. Selecciona **"Agregar a pantalla de inicio"**
5. Nombra: "Mundo Mágico" → Agregar

¡Listo! Aparece como app en el home y se abre en pantalla completa sin Safari.

---

## 🎮 Mundos del juego

| Mundo | Contenido | Preguntas |
|-------|-----------|-----------|
| 🎨 Colores | Identificar 10 colores | 5 por ronda |
| 🔢 Números | Contar objetos del 1 al 5 | 5 por ronda |
| 🔷 Formas | 8 figuras geométricas | 5 por ronda |
| 🦁 Animales | Sonidos y características | 5 por ronda |

## 🏆 Sistema de puntos
- Respuesta correcta: +10 puntos + 2 estrellas
- 3 vidas por ronda
- Estrellas se guardan automáticamente (localStorage)

---

## 🔧 Personalizar el juego

Para agregar más preguntas, edita el objeto `WORLDS` en `index.html`:

```javascript
// Ejemplo: agregar pregunta en animales
{ 
  q: '¿Quién puede volar?', 
  answer: '🦅', 
  wrong: ['🐢','🐘','🐟'], 
  type: 'animal' 
}
```

Para cambiar el nombre del niño en los elogios, edita el array `PRAISES`:
```javascript
const PRAISES = ['¡Muy bien, Mateo!','¡Excelente, Mateo!', ...];
```
