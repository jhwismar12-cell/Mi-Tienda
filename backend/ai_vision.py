import os
import json
import base64
import re
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher
from typing import Dict, Any, List, Optional
from backend.database import get_db

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
]


def get_api_key() -> Optional[str]:
    """Obtiene la API key de Gemini desde entorno o base de datos."""
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT Valor FROM CONFIGURACION_SISTEMA WHERE Clave = 'GEMINI_API_KEY'")
        row = cursor.fetchone()
        if row and row["Valor"] and row["Valor"].strip():
            return row["Valor"].strip()

    return None


def set_api_key(key: str) -> None:
    """Guarda la API key en la base de datos local."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO CONFIGURACION_SISTEMA (Clave, Valor, Descripcion)
               VALUES ('GEMINI_API_KEY', ?, 'Clave de Google Gemini API para visión artificial')
               ON CONFLICT(Clave) DO UPDATE SET Valor = excluded.Valor""",
            (key.strip(),)
        )


def normalize_text(text: str) -> str:
    """Normaliza texto para comparación difusa."""
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r'[áàäâ]', 'a', t)
    t = re.sub(r'[éèëê]', 'e', t)
    t = re.sub(r'[íìïî]', 'i', t)
    t = re.sub(r'[óòöô]', 'o', t)
    t = re.sub(r'[úùüû]', 'u', t)
    t = re.sub(r'[^a-z0-9\s]', ' ', t)
    return ' '.join(t.split())


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    s = re.sub(r"[^0-9,.\-]", "", s)
    if not s:
        return default
    # Handle comma decimal (e.g. "2,35") when no dot or comma after dot
    if "," in s and "." not in s:
        s = s.replace(",", ".")
    elif "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return default


def _normalize_date(raw_date: Any) -> str:
    s = str(raw_date or "").strip()
    if not s:
        return ""
    # DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    m2 = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})", s)
    if m2:
        y, mo, d = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}"
    return s


def match_products_and_supplier(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Empareja los productos y el proveedor detectados por la IA o XML SRI con la base de datos local.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Obtener Proveedores
        cursor.execute("SELECT IDProveedor, RUC_CI, RazonSocial FROM PROVEEDORES WHERE Activo = 1")
        db_suppliers = cursor.fetchall()

        # 2. Obtener Productos activos
        cursor.execute("""
            SELECT p.IDProducto, p.IDProveedor, p.CodigoInterno, p.Nombre, p.PrecioCompraActual, p.PrecioVentaActual, p.StockActual, c.Nombre as Categoria
            FROM PRODUCTOS p
            LEFT JOIN CATEGORIAS c ON p.IDCategoria = c.IDCategoria
            WHERE p.Activo = 1
        """)
        db_products = cursor.fetchall()

        # 3. Obtener Códigos de barra
        cursor.execute("SELECT IDProducto, CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS")
        barcode_rows = cursor.fetchall()
        barcode_map = {b["CodigoBarras"]: b["IDProducto"] for b in barcode_rows}

    # Match Proveedor
    detected_prov_name = str(raw_data.get("proveedor_nombre", "") or "").strip()
    detected_prov_ruc = re.sub(r"\D", "", str(raw_data.get("proveedor_ruc", "") or ""))
    norm_detected_prov = normalize_text(detected_prov_name)

    matched_supplier_id = None
    matched_supplier_name = detected_prov_name

    for s in db_suppliers:
        s_ruc = re.sub(r"\D", "", s["RUC_CI"] or "")
        s_name = s["RazonSocial"] or ""
        norm_s_name = normalize_text(s_name)

        if detected_prov_ruc and s_ruc and (detected_prov_ruc == s_ruc or detected_prov_ruc in s_ruc or s_ruc in detected_prov_ruc):
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break

        if norm_detected_prov and norm_s_name and (norm_detected_prov in norm_s_name or norm_s_name in norm_detected_prov):
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break

        tokens_det = {t for t in norm_detected_prov.split() if len(t) > 2}
        tokens_s = {t for t in norm_s_name.split() if len(t) > 2}
        if tokens_det and tokens_s and len(tokens_det.intersection(tokens_s)) >= 2:
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break

    # Pre-normalize catalog products once
    prepared_prods = []
    for p in db_products:
        p_norm = normalize_text(p["Nombre"])
        p_tokens = set(p_norm.split())
        prepared_prods.append((p, p_norm, p_tokens))

    # Match Items
    processed_items = []
    raw_items = raw_data.get("items") or []
    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            continue
        code = str(item.get("codigo", "") or "").strip()
        name = str(item.get("nombre", "") or "").strip()
        if not name and not code:
            continue

        qty = _safe_float(item.get("cantidad"), 1.0)
        if qty <= 0:
            qty = 1.0
        cost = _safe_float(item.get("costo_unitario"), 0.0)
        desc = _safe_float(item.get("descuento"), 0.0)
        subtotal = _safe_float(item.get("subtotal"), 0.0)

        # Reconcile missing unit cost or subtotal
        if cost <= 0 and subtotal > 0 and qty > 0:
            cost = round(subtotal / qty, 4)
        if subtotal <= 0 and cost > 0:
            subtotal = round(max(0.0, qty * cost - desc), 2)

        matched_prod = None

        # 1. Exact barcode or internal code match
        if code and code in barcode_map:
            pid = barcode_map[code]
            matched_prod = next((p for p, _, _ in prepared_prods if p["IDProducto"] == pid), None)

        if not matched_prod and code:
            c_low = code.lower()
            matched_prod = next((p for p, _, _ in prepared_prods if (p["CodigoInterno"] or "").lower() == c_low), None)

        # 2. Fuzzy name match (token overlap + SequenceMatcher, boosting same supplier)
        if not matched_prod and name:
            norm_name = normalize_text(name)
            tokens_item = set(norm_name.split())
            best_score = 0.0
            best_p = None

            for p, p_norm, p_tokens in prepared_prods:
                if not p_norm:
                    continue
                same_prov_bonus = 0.08 if (matched_supplier_id and p["IDProveedor"] == matched_supplier_id) else 0.0

                if norm_name == p_norm:
                    best_p = p
                    best_score = 2.0
                    break

                if len(norm_name) >= 6 and (norm_name in p_norm or p_norm in norm_name):
                    score = 0.92 + same_prov_bonus
                else:
                    overlap = len(tokens_item.intersection(p_tokens))
                    union = len(tokens_item.union(p_tokens)) or 1
                    jaccard = overlap / union
                    seq = SequenceMatcher(None, norm_name, p_norm).ratio()
                    score = (jaccard * 0.55 + seq * 0.45) + same_prov_bonus
                    if overlap < 2 and seq < 0.72:
                        continue

                if score > best_score:
                    best_score = score
                    best_p = p

            if best_p and best_score >= 0.52:
                matched_prod = best_p

        if matched_prod:
            prev_cost = float(matched_prod["PrecioCompraActual"] or 0.0)
            curr_sale = float(matched_prod["PrecioVentaActual"] or 0.0)
            final_cost = round(cost, 4) if cost > 0 else prev_cost
            sug_sale = curr_sale if curr_sale > 0 else round(final_cost * 1.30, 2)
            processed_items.append({
                "id_producto": matched_prod["IDProducto"],
                "codigo": matched_prod["CodigoInterno"],
                "nombre": matched_prod["Nombre"],
                "descripcion_factura": name,
                "categoria": matched_prod["Categoria"] or "Abarrotes",
                "cantidad": round(qty, 3),
                "costo_unitario": final_cost,
                "costo_anterior": prev_cost,
                "precio_venta_actual": curr_sale,
                "precio_venta_sugerido": sug_sale,
                "stock_actual": float(matched_prod["StockActual"] or 0.0),
                "descuento": round(desc, 2),
                "subtotal": round(subtotal, 2),
                "es_nuevo": False
            })
        else:
            sug_sale = round(cost * 1.30, 2) if cost > 0 else 0.50
            processed_items.append({
                "id_producto": None,
                "codigo": code or f"AUT-FAC-{idx + 1}",
                "nombre": name or code,
                "descripcion_factura": name or code,
                "categoria": "Abarrotes",
                "cantidad": round(qty, 3),
                "costo_unitario": round(cost, 4),
                "costo_anterior": round(cost, 4),
                "precio_venta_actual": sug_sale,
                "precio_venta_sugerido": sug_sale,
                "stock_actual": 0.0,
                "descuento": round(desc, 2),
                "subtotal": round(subtotal, 2),
                "es_nuevo": True
            })

    calc_total = round(sum(it["subtotal"] for it in processed_items), 2)
    raw_total = _safe_float(raw_data.get("total"), 0.0)

    return {
        "proveedor_nombre": matched_supplier_name,
        "id_proveedor": matched_supplier_id,
        "proveedor_ruc": detected_prov_ruc,
        "numero_factura": str(raw_data.get("numero_factura", "") or "").strip(),
        "fecha_emision": _normalize_date(raw_data.get("fecha_emision", "")),
        "subtotal": round(_safe_float(raw_data.get("subtotal"), calc_total), 2),
        "descuento": round(_safe_float(raw_data.get("descuento"), 0.0), 2),
        "impuestos": round(_safe_float(raw_data.get("impuestos"), 0.0), 2),
        "total": round(raw_total if raw_total > 0 else calc_total, 2),
        "items": processed_items,
        "total_items": len(processed_items)
    }


def parse_sri_invoice_xml(xml_bytes: bytes) -> Dict[str, Any]:
    """
    Parsea una factura electrónica XML del SRI (Ecuador) de forma determinista y sin necesidad de API Key.
    Soporta tanto el XML autorizado (<autorizacion><comprobante>...</comprobante></autorizacion>)
    como el XML directo (<factura>...</factura>).
    """
    text = xml_bytes.decode("utf-8-sig", errors="replace").strip()
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise ValueError(f"El archivo XML no es válido: {e}")

    # Si viene envuelto en <autorizacion>, extraer el <comprobante> interno
    comp_el = root.find(".//comprobante")
    if comp_el is not None and comp_el.text and "<factura" in comp_el.text:
        try:
            root = ET.fromstring(comp_el.text.strip())
        except ET.ParseError as e:
            raise ValueError(f"No se pudo leer el comprobante XML interno del SRI: {e}")

    def _txt(parent, tag: str) -> str:
        el = parent.find(tag) if parent is not None else None
        return (el.text or "").strip() if el is not None else ""

    info_trib = root.find("infoTributaria")
    info_fact = root.find("infoFactura")
    if info_trib is None and info_fact is None:
        raise ValueError("El XML no tiene estructura de factura electrónica SRI (<infoTributaria>/<infoFactura>).")

    razon = _txt(info_trib, "razonSocial") or _txt(info_trib, "nombreComercial")
    ruc = _txt(info_trib, "ruc")
    estab = _txt(info_trib, "estab")
    pto_emi = _txt(info_trib, "ptoEmi")
    secuencial = _txt(info_trib, "secuencial")
    num_factura = "-".join(p for p in (estab, pto_emi, secuencial) if p)

    fecha_emision = _txt(info_fact, "fechaEmision")
    subtotal = _safe_float(_txt(info_fact, "totalSinImpuestos"), 0.0)
    descuento = _safe_float(_txt(info_fact, "totalDescuento"), 0.0)
    total = _safe_float(_txt(info_fact, "importeTotal"), 0.0)
    impuestos = round(max(0.0, total - subtotal), 2)

    items = []
    detalles = root.find("detalles")
    if detalles is not None:
        for det in detalles.findall("detalle"):
            codigo = _txt(det, "codigoPrincipal") or _txt(det, "codigoAuxiliar")
            nombre = _txt(det, "descripcion")
            cantidad = _safe_float(_txt(det, "cantidad"), 1.0)
            p_unit = _safe_float(_txt(det, "precioUnitario"), 0.0)
            desc_item = _safe_float(_txt(det, "descuento"), 0.0)
            sub_item = _safe_float(_txt(det, "precioTotalSinImpuesto"), round(cantidad * p_unit - desc_item, 2))
            items.append({
                "codigo": codigo,
                "nombre": nombre,
                "cantidad": cantidad,
                "costo_unitario": p_unit,
                "descuento": desc_item,
                "subtotal": sub_item,
            })

    if not items:
        raise ValueError("La factura XML no contiene ítems en <detalles>.")

    return match_products_and_supplier({
        "proveedor_nombre": razon,
        "proveedor_ruc": ruc,
        "numero_factura": num_factura,
        "fecha_emision": fecha_emision,
        "subtotal": subtotal,
        "descuento": descuento,
        "impuestos": impuestos,
        "total": total,
        "items": items,
    })


def _format_gemini_http_error(code: int, body: str) -> str:
    low = body.lower()
    if code == 400 and ("api key not valid" in low or "api_key_invalid" in low):
        return "La API Key de Gemini no es válida. Revísala o genera una nueva en Google AI Studio."
    if code == 403:
        return "Acceso denegado por Gemini API (403). Verifica que tu API Key tenga permisos activos."
    if code == 429:
        return "Límite de cuota de Gemini API alcanzado temporalmente (429). Espera unos segundos e intenta de nuevo."
    if code == 404:
        return "Modelo de Gemini no disponible (404)."
    return f"Error HTTP {code} de Gemini API."


def process_invoice_with_gemini(image_bytes: bytes, mime_type: str = "image/jpeg", api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Envía la imagen o PDF a Google Gemini Multimodal para extraer datos estructurados de la factura.
    """
    key = (api_key or "").strip() or get_api_key()
    if not key:
        raise ValueError("No se ha configurado la API Key de Gemini. Ingrésala abajo o en Ajustes para analizar fotos y PDFs (los archivos XML del SRI funcionan sin API Key).")

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    system_prompt = (
        "Eres un sistema experto en OCR y visión artificial especializado en facturas comerciales, "
        "notas de entrega y tickets de compra de tiendas y distribuidores en Ecuador "
        "(como Arca Continental / Coca-Cola, Tesalia CBC, Azende, Corporación La Favorita / Titán, "
        "DINADEC, Cervecería Nacional, Nutri, Superior, CONORQUE, La Bodega, Distribuidoras de Snacks, etc.).\n\n"
        "Analiza minuciosamente el documento proporcionado y extrae TODOS los datos legibles. "
        "Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:\n"
        "{\n"
        '  "proveedor_nombre": "Razón social o nombre comercial del proveedor/distribuidor",\n'
        '  "proveedor_ruc": "RUC del proveedor (13 dígitos) si aparece",\n'
        '  "numero_factura": "Número de factura completo (ej: 029-001-001309343 o número de nota de entrega)",\n'
        '  "fecha_emision": "Fecha en formato YYYY-MM-DD",\n'
        '  "subtotal": 0.0,\n'
        '  "descuento": 0.0,\n'
        '  "impuestos": 0.0,\n'
        '  "total": 0.0,\n'
        '  "items": [\n'
        "    {\n"
        '      "codigo": "Código, referencia o SKU si aparece",\n'
        '      "nombre": "Descripción clara del producto",\n'
        '      "cantidad": 1.0,\n'
        '      "costo_unitario": 0.0,\n'
        '      "descuento": 0.0,\n'
        '      "subtotal": 0.0\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "REGLAS IMPORTANTES:\n"
        "1. Extrae TODAS las filas de productos de la factura sin omitir ninguna.\n"
        "2. Convierte cantidades y precios a números decimales con punto (ej: 2.35 en lugar de '$2,35').\n"
        "3. Si una línea tiene total pero no precio unitario, calcula costo_unitario = subtotal / cantidad.\n"
        "4. No agregues texto explicativo ni bloques markdown, devuelve solo el JSON puro."
    )

    last_err = None

    for model in GEMINI_MODELS:
        gen_config: Dict[str, Any] = {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        }
        if model.startswith("gemini-2.5"):
            gen_config["thinkingConfig"] = {"thinkingBudget": 0}

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": system_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_image
                            }
                        }
                    ]
                }
            ],
            "generationConfig": gen_config,
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=28) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if not candidates:
                    raise ValueError("El modelo de IA no generó ninguna respuesta para esta imagen.")

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise ValueError("Respuesta vacía del modelo de IA.")

                text_resp = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
                if text_resp.startswith("```"):
                    text_resp = re.sub(r"^```(?:json)?", "", text_resp).rstrip("`").strip()

                parsed_json = json.loads(text_resp)
                if not isinstance(parsed_json, dict):
                    raise ValueError("La IA no devolvió un objeto JSON válido.")
                return match_products_and_supplier(parsed_json)

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
            friendly = _format_gemini_http_error(e.code, err_body)
            last_err = friendly
            # Si la API key es inválida o 403, no tiene sentido reintentar otros modelos
            if e.code in (400, 403) and ("api key" in friendly.lower() or "denegado" in friendly.lower()):
                raise ValueError(friendly)
            continue
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"No se pudo procesar la factura con IA: {last_err}")
