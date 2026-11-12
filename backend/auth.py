"""Autenticacion: hash de claves, tokens firmados y bloqueo por intentos fallidos.

Solo usa la libreria estandar de Python (sin dependencias nuevas).
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from typing import Optional, Tuple

PBKDF2_ITERATIONS = 240_000
TOKEN_TTL_SECONDS = int(os.environ.get("SESION_HORAS", "16")) * 3600

# Claves que venian por defecto en versiones anteriores. Nunca deben servir en produccion.
CLAVES_POR_DEFECTO = ("admin123", "admin", "cajero123")

ROLES_ADMIN = {"ADMINISTRADOR"}


# --- Claves ---------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def _legacy_sha256(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, stored: str) -> bool:
    if not stored or not password:
        return False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, expected = stored.split("$", 3)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
            return hmac.compare_digest(digest.hex(), expected)
        except (ValueError, TypeError):
            return False
    # Formato antiguo (sha256 sin sal): se acepta una vez y se re-hashea al iniciar sesion.
    if len(stored) == 64:
        return hmac.compare_digest(_legacy_sha256(password), stored)
    return False


def needs_rehash(stored: str) -> bool:
    return not (stored or "").startswith("pbkdf2_sha256$")


def unusable_password() -> str:
    """Hash imposible de adivinar: el usuario existe pero no puede iniciar sesion."""
    return "!" + secrets.token_hex(32)


def is_default_password(stored: str) -> bool:
    return any(verify_password(p, stored) for p in CLAVES_POR_DEFECTO)


def validate_new_password(password: str) -> None:
    if not password or len(password) < 8:
        raise ValueError("La clave debe tener al menos 8 caracteres.")
    if password.lower() in CLAVES_POR_DEFECTO:
        raise ValueError("Esa clave es demasiado comun. Elige otra.")


# --- Tokens firmados -------------------------------------------------------
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_token(secret: str, user_id: int, password_hash: str, must_change: bool) -> str:
    payload = {
        "uid": user_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
        # Huella de la clave: al cambiar la clave, las sesiones anteriores dejan de valer.
        "pv": hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16],
        "mc": bool(must_change),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def decode_token(secret: str, token: str) -> Optional[dict]:
    try:
        body, sig = token.split(".", 1)
        expected = _b64(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(body))
        if int(payload.get("exp", 0)) < time.time():
            return None
        return payload
    except Exception:
        return None


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


# --- Bloqueo por intentos fallidos -----------------------------------------
_MAX_FAILURES = 5
_LOCK_SECONDS = 5 * 60
_failures: dict = {}
_lock = threading.Lock()


def check_lock(key: str) -> Tuple[bool, int]:
    with _lock:
        count, first, locked_until = _failures.get(key, (0, 0.0, 0.0))
        remaining = int(locked_until - time.time())
        return (remaining > 0, max(remaining, 0))


def register_failure(key: str) -> None:
    with _lock:
        now = time.time()
        count, first, locked_until = _failures.get(key, (0, now, 0.0))
        if now - first > _LOCK_SECONDS:
            count, first = 0, now
        count += 1
        if count >= _MAX_FAILURES:
            locked_until = now + _LOCK_SECONDS
            count, first = 0, now
        _failures[key] = (count, first, locked_until)


def clear_failures(key: str) -> None:
    with _lock:
        _failures.pop(key, None)


def reset_all_failures() -> None:
    with _lock:
        _failures.clear()
