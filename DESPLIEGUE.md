# Guía de Despliegue y Creación de Usuarios por Tienda

Este repositorio está preparado para operar **múltiples tiendas independientes** a partir de un mismo código fuente privado en GitHub, ya sea **en la nube** o **instalado en la computadora local** de cada tienda.

---

## 1. Seguridad y Credenciales de cada Nueva Tienda

El sistema protege todas las rutas `/api/*` con tokens firmados (HMAC-SHA256) y contraseñas cifradas con `PBKDF2-SHA256` (240,000 iteraciones) + bloqueo automático contra fuerza bruta:

- **En producción (`ENTORNO=produccion`)**: el servidor exige definir `ADMIN_PASSWORD` (mínimo 8 caracteres, distinta de `admin123`) para crear o actualizar el usuario administrador inicial de esa tienda.
- **En local / desarrollo**: si entras por primera vez con la clave inicial `admin123`, la pantalla te pedirá definir tu nueva contraseña segura de inmediato.
- **Creación de usuarios y cajeros dentro de la tienda**: una vez dentro, en **Ajustes → Usuarios y Personal de la Tienda**, el administrador puede:
  1. Crear nuevos usuarios con **usuario, contraseña propia (mín. 8 caracteres)** y rol (`ADMINISTRADOR`, `CAJERO`, `BODEGUERO`).
  2. Registrar trabajadores de turno sin contraseña (solo para seleccionar *"A cargo ahora"* en un mostrador compartido).
  3. Asignar o cambiar la contraseña de cualquier trabajador en cualquier momento, o revocar su acceso al instante eliminándolo.

---

## 2. Opción A: Publicar una Nueva Tienda en la Nube (Independiente)

Para cada nueva tienda creas un servicio de backend (y opcionalmente un sitio de frontend) conectado a tu repositorio privado de GitHub:

1. **Backend (Railway, Render o Fly.io):**
   - Comando de arranque (`Procfile` incluido):
     `uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}`
   - Montar un **volumen/disco persistente** (ej. `/data`) y configurar las variables de entorno de esa tienda:
     - `ENTORNO=produccion`
     - `TIENDA_DB_PATH=/data/tienda.db`
     - `ADMIN_USERNAME=admin_tienda1`
     - `ADMIN_PASSWORD=UnaClaveSegura2026!` *(mínimo 8 caracteres)*
     - `ADMIN_NOMBRE=encargado de Tienda 1`
     - `TIENDA_NOMBRE=Minimarket El Sol`
     - `TIENDA_RUC=1790000000001`
     - `ALLOWED_ORIGINS=https://tienda1.vercel.app`
     - `GEMINI_API_KEY=...` *(opcional, para lectura de facturas con IA)*
   - Healthcheck disponible en: `GET /api/health`

2. **Frontend (Vercel, Netlify o integrado en el mismo Backend):**
   - Si despliegas el frontend en Vercel/Netlify:
     - Build command: `npm run build`
     - Output directory: `dist`
     - Variable de entorno: `VITE_API_URL=https://api-tienda1.up.railway.app`
   - Si ejecutas `npm run build` en el propio servicio del backend antes de iniciar `uvicorn`, FastAPI sirve automáticamente la carpeta `dist/` en el mismo dominio sin necesitar `VITE_API_URL`.

---

## 3. Opción B: Entregar en Local en la Computadora de cada Tienda

Cada tienda opera en su propia PC sin depender de internet:

1. Clona el repositorio en la PC de la tienda (sin copiar tu `tienda.db` personal; al iniciar se crea una base limpia).
2. Opcionalmente copia `.env.example` a `.env` para personalizar `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `TIENDA_NOMBRE`.
3. Instala dependencias una sola vez (`pip install -r requirements.txt` y `npm install`).
4. Arranca con `iniciar_tienda.bat`, inicia sesión y crea los usuarios/cajeros de esa tienda desde **Ajustes**.
