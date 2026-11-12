@echo off
title Sistema de Gestion para Tienda POS
cd /d %~dp0

echo ===================================================
echo   SISTEMA INTEGRAL DE GESTION PARA TIENDA (POS)
echo   Punto de Venta + Inventario + Compras + Pedidos
echo ===================================================
echo.

:: Verificar si existe la base de datos o inicializarla
if not exist "tienda.db" (
    echo [*] Inicializando Base de Datos Relacional SQLite y Kardex...
    python -c "from backend.database import init_db; init_db()"
    echo.
)

:: Verificar si estan instaladas las dependencias de Python
echo [*] Verificando dependencias del sistema...
python -m pip install -r requirements.txt --quiet --no-warn-script-location

echo [*] Iniciando Servidor Local de Base de Datos y POS en http://localhost:8000...
start /b python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

timeout /t 3 /nobreak >nul

start http://localhost:8000

echo.
echo ===================================================
echo   [OK] Sistema ejecutandose correctamente en:
echo   - Aplicacion Web: http://localhost:8000
echo   - Documentacion API: http://localhost:8000/docs
echo ===================================================
echo.
echo Presione cualquier tecla para cerrar la ventana...
pause >nul
