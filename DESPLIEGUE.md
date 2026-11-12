# Guía de Despliegue y Creación de Usuarios por Tienda

Este repositorio está preparado para operar **múltiples tiendas independientes** a partir de un mismo código fuente privado en GitHub, ya sea **100% gratis en Vercel + Supabase** o **instalado en la computadora local** de cada tienda.

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

## 2. Opción A (Recomendada): Vercel + Supabase (Frontend + Backend en la nube gratis)

Un solo proyecto de Vercel sirve tanto el frontend React (`dist/`) como el backend FastAPI (`api/index.py`), guardando automáticamente cada tienda aislada por `TIENDA_SLUG` en tu proyecto PostgreSQL de **Supabase**:

1. **Crea un nuevo proyecto en Vercel** conectado a tu repositorio privado `jhwismar12-cell/Mi-Tienda`.
2. **Para agregar una nueva tienda independiente**, crea un proyecto en Vercel apuntando al **mismo repositorio** y configura estas variables de entorno para esa tienda:
   - `ENTORNO=produccion`
   - `TIENDA_SLUG=nombre-unico-tienda` *(ej. `minimarket-norte`, `tienda-sur` — aísla los datos en Supabase)*
   - `TIENDA_NOMBRE=Minimarket El Sol`
   - `TIENDA_RUC=1790000000001`
   - `ADMIN_USERNAME=admin_sol`
   - `ADMIN_PASSWORD=UnaClaveSegura2026!` *(mínimo 8 caracteres)*
   - `SECRET_KEY=` *(una clave aleatoria larga y distinta por tienda)*
   - `SUPABASE_URL=` *(URL de tu proyecto Supabase)*
   - `SUPABASE_KEY=` *(Publishable / Anon Key de Supabase)*
   - `SUPABASE_SYNC_SECRET=` *(clave compartida configurada en `public.app_secrets`)*
   - `GEMINI_API_KEY=...` *(opcional, para lectura de facturas con IA)*
   - Deja `VITE_API_URL` vacío para usar `/api/*` del mismo dominio.

---

## 3. Opción B: Entregar en Local en la Computadora de cada Tienda

Cada tienda opera en su propia PC sin depender de internet ni requerir Supabase:

1. Clona el repositorio en la PC de la tienda (sin copiar tu `tienda.db` ni tus archivos `catalogo_productos_*`).
2. Opcionalmente copia `.env.example` a `.env` para personalizar `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `TIENDA_NOMBRE`.
3. Instala dependencias una sola vez (`pip install -r requirements.txt` y `npm install`).
4. Arranca con `iniciar_tienda.bat`, inicia sesión y crea los usuarios/cajeros de esa tienda desde **Ajustes**.
