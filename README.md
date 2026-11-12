# 🛒 Mi Tienda Familiar - POS & ERP

Sistema integral de Punto de Venta (POS) y Gestión de Inventarios diseñado para comercio minorista/abarrotes en Ecuador.

> 📖 **Para documentación completa, arquitectura de código y contexto detallado para asistentes IA (Codex, Cursor, etc.), consulta el archivo [PROJECT_CONTEXT.md](file:///C:/Users/wisma/.gemini/antigravity/scratch/Mi-Tienda/PROJECT_CONTEXT.md).**

## 🚀 Inicio Rápido

Hacer doble clic en `iniciar_tienda.bat` en la raíz del proyecto.

O manualmente:
```bash
# Backend (FastAPI):
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (Vite + React):
npm run dev
```

## 🛠️ Stack Tecnológico
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React.
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2.
- **Base de Datos:** SQLite (`tienda.db`) con transacciones ACID y Kardex Perpetuo.

## Verificación

Desde la raíz del proyecto:

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -p test_backend.py
npm run test:frontend
npm run lint
npm run build
```

Las pruebas del backend crean una base temporal nueva para cada caso y no copian ni abren `tienda.db`.
Las pruebas del frontend usan respuestas simuladas, sin conectarse al negocio.

La caja se abre explícitamente con su fondo inicial. Consultar su estado, reiniciar el backend o intentar vender con caja cerrada no crea otro turno.
Los errores de cobro conservan el carrito; un reintento del mismo cobro usa el mismo identificador para recuperar el ticket sin duplicarlo.
Al iniciar el backend se crean las tablas nuevas de movimientos de caja y reintentos de cobro, preservando los registros existentes.

Después de modificar el código, ejecuta `npm run build` y reinicia el backend para actualizar la aplicación que abre `iniciar_tienda.bat`.
