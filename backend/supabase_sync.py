"""Sincronizacion transaccional entre SQLite y Supabase PostgreSQL (HTTPS RPC).

Usa unicamente la libreria estandar de Python (urllib, gzip, base64, sqlite3)
para funcionar en Vercel Serverless y en servidores locales sin dependencias C adicionales.
"""
import base64
import gzip
import json
import os
import sqlite3
import tempfile
import urllib.error
import urllib.request
from typing import Optional


def get_store_slug() -> str:
    raw = os.environ.get("TIENDA_SLUG", "tienda-principal").strip().lower()
    clean = "".join(ch if (ch.isalnum() or ch == "-") else "-" for ch in raw).strip("-")
    return clean or "tienda-principal"


def is_supabase_enabled() -> bool:
    return bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_KEY", "").strip()
        and os.environ.get("SUPABASE_SYNC_SECRET", "").strip()
    )


def _version_file(db_path: str) -> str:
    return f"{db_path}.ver"


def _read_local_version(db_path: str) -> int:
    try:
        with open(_version_file(db_path), "r", encoding="utf-8") as f:
            return int(f.read().strip() or "0")
    except Exception:
        return 0


def _write_local_version(db_path: str, version: int) -> None:
    try:
        with open(_version_file(db_path), "w", encoding="utf-8") as f:
            f.write(str(int(version)))
    except Exception:
        pass


def _rpc_call(fn_name: str, payload: dict, timeout: float = 8.0) -> Optional[dict]:
    base_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    api_key = os.environ.get("SUPABASE_KEY", "").strip()
    if not base_url or not api_key:
        return None

    url = f"{base_url}/rest/v1/rpc/{fn_name}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def pull_db_from_supabase(db_path: str) -> bool:
    """Descarga el estado mas reciente de la tienda desde Supabase si existe."""
    if not is_supabase_enabled():
        return False
    secret = os.environ.get("SUPABASE_SYNC_SECRET", "").strip()
    slug = get_store_slug()
    try:
        res = _rpc_call("obtener_estado_tienda", {"p_secret": secret, "p_slug": slug})
        if not res or not res.get("found") or not res.get("db_gzip_b64"):
            return False

        raw_bytes = gzip.decompress(base64.b64decode(res["db_gzip_b64"]))
        parent = os.path.dirname(os.path.abspath(db_path))
        if parent:
            os.makedirs(parent, exist_ok=True)

        tmp_path = f"{db_path}.tmp.{os.getpid()}"
        with open(tmp_path, "wb") as f:
            f.write(raw_bytes)
        os.replace(tmp_path, db_path)
        for ext in ("-wal", "-shm"):
            wal_file = f"{db_path}{ext}"
            if os.path.exists(wal_file):
                try:
                    os.remove(wal_file)
                except OSError:
                    pass
        _write_local_version(db_path, int(res.get("version") or 1))
        return True
    except Exception as exc:
        print(f"[SupabaseSync] Aviso al descargar estado de '{slug}': {exc}")
        return False


def pull_if_newer(db_path: str) -> bool:
    """Verifica rapidamente si hay una version mas reciente en Supabase y la descarga."""
    if not is_supabase_enabled():
        return False
    if not os.path.exists(db_path):
        return pull_db_from_supabase(db_path)

    secret = os.environ.get("SUPABASE_SYNC_SECRET", "").strip()
    slug = get_store_slug()
    local_ver = _read_local_version(db_path)
    try:
        res = _rpc_call("obtener_version_tienda", {"p_secret": secret, "p_slug": slug}, timeout=4.0)
        if not res or not res.get("found"):
            return False
        remote_ver = int(res.get("version") or 0)
        if remote_ver > local_ver:
            return pull_db_from_supabase(db_path)
        return False
    except Exception as exc:
        print(f"[SupabaseSync] Aviso al verificar version de '{slug}': {exc}")
        return False


def push_db_to_supabase(db_path: str) -> bool:
    """Empaqueta una copia consistente de SQLite y actualiza las tablas en Supabase."""
    if not is_supabase_enabled() or not os.path.exists(db_path):
        return False
    secret = os.environ.get("SUPABASE_SYNC_SECRET", "").strip()
    slug = get_store_slug()

    tmp_fd, tmp_snapshot = tempfile.mkstemp(prefix="tienda_sync_", suffix=".db")
    os.close(tmp_fd)
    try:
        src = sqlite3.connect(db_path)
        src.row_factory = sqlite3.Row
        dst = sqlite3.connect(tmp_snapshot)
        with dst:
            src.backup(dst)
        dst.close()

        cfg = {}
        try:
            for r in src.execute("SELECT Clave, Valor FROM CONFIGURACION_SISTEMA").fetchall():
                cfg[r["Clave"]] = r["Valor"]
        except Exception:
            pass

        usuarios = []
        try:
            for u in src.execute(
                "SELECT IDRole, Username, PasswordHash, NombreCompleto, Activo FROM USUARIOS"
            ).fetchall():
                usuarios.append(
                    {
                        "id_role": int(u["IDRole"]),
                        "username": str(u["Username"]),
                        "password_hash": str(u["PasswordHash"]),
                        "nombre_completo": str(u["NombreCompleto"]),
                        "activo": bool(u["Activo"]),
                    }
                )
        except Exception:
            pass

        resumen = {}
        try:
            prod_count = src.execute("SELECT COUNT(*) FROM PRODUCTOS WHERE Activo = 1").fetchone()[0]
            ventas_count = src.execute("SELECT COUNT(*) FROM VENTAS").fetchone()[0]
            resumen = {"productos_activos": int(prod_count), "ventas_totales": int(ventas_count)}
        except Exception:
            pass

        src.close()

        with open(tmp_snapshot, "rb") as f:
            compressed = gzip.compress(f.read(), compresslevel=6)
        b64_data = base64.b64encode(compressed).decode("ascii")

        res = _rpc_call(
            "guardar_estado_tienda",
            {
                "p_secret": secret,
                "p_slug": slug,
                "p_nombre": cfg.get("NOMBRE_TIENDA") or os.environ.get("TIENDA_NOMBRE", "Mi Tienda Familiar"),
                "p_ruc": cfg.get("RUC_TIENDA") or os.environ.get("TIENDA_RUC", ""),
                "p_direccion": cfg.get("DIRECCION_TIENDA") or os.environ.get("TIENDA_DIRECCION", ""),
                "p_telefono": cfg.get("TELEFONO_TIENDA") or os.environ.get("TIENDA_TELEFONO", ""),
                "p_db_gzip_b64": b64_data,
                "p_usuarios": usuarios,
                "p_resumen": resumen,
            },
        )
        if res and res.get("version"):
            _write_local_version(db_path, int(res["version"]))
        return True
    except Exception as exc:
        print(f"[SupabaseSync] Aviso al guardar estado de '{slug}': {exc}")
        return False
    finally:
        if os.path.exists(tmp_snapshot):
            try:
                os.remove(tmp_snapshot)
            except OSError:
                pass
