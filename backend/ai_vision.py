import os
import json
import base64
import re
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from backend.database import get_db

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
FALLBACK_GEMINI_MODEL = "gemini-1.5-flash"

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

def match_products_and_supplier(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Empareja los productos y el proveedor detectados por la IA con la base de datos local.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Obtener Proveedores
        cursor.execute("SELECT IDProveedor, RUC_CI, RazonSocial FROM PROVEEDORES WHERE Activo = 1")
        db_suppliers = cursor.fetchall()
        
        # 2. Obtener Productos
        cursor.execute("""
            SELECT p.IDProducto, p.CodigoInterno, p.Nombre, p.PrecioCompraActual, p.PrecioVentaActual, p.StockActual, c.Nombre as Categoria
            FROM PRODUCTOS p
            LEFT JOIN CATEGORIAS c ON p.IDCategoria = c.IDCategoria
            WHERE p.Activo = 1
        """)
        db_products = cursor.fetchall()
        
        # 3. Obtener Códigos de barra
        cursor.execute("SELECT IDProducto, CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS")
        barcode_rows = cursor.fetchall()
        barcode_map = {}
        for b in barcode_rows:
            barcode_map[b["CodigoBarras"]] = b["IDProducto"]

    # Match Proveedor
    detected_prov_name = raw_data.get("proveedor_nombre", "") or ""
    detected_prov_ruc = raw_data.get("proveedor_ruc", "") or ""
    norm_detected_prov = normalize_text(detected_prov_name)
    
    matched_supplier_id = None
    matched_supplier_name = detected_prov_name
    
    for s in db_suppliers:
        s_ruc = s["RUC_CI"] or ""
        s_name = s["RazonSocial"] or ""
        norm_s_name = normalize_text(s_name)
        
        if detected_prov_ruc and s_ruc and detected_prov_ruc in s_ruc:
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break
            
        # Token intersection match
        tokens_det = set(norm_detected_prov.split())
        tokens_s = set(norm_s_name.split())
        if tokens_det and tokens_s and len(tokens_det.intersection(tokens_s)) >= 2:
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break
            
        if norm_detected_prov and (norm_detected_prov in norm_s_name or norm_s_name in norm_detected_prov):
            matched_supplier_id = s["IDProveedor"]
            matched_supplier_name = s_name
            break

    # Match Items
    processed_items = []
    for item in raw_data.get("items", []):
        code = str(item.get("codigo", "") or "").strip()
        name = str(item.get("nombre", "") or "").strip()
        qty = float(item.get("cantidad", 1.0) or 1.0)
        cost = float(item.get("costo_unitario", 0.0) or 0.0)
        desc = float(item.get("descuento", 0.0) or 0.0)
        subtotal = float(item.get("subtotal", round(qty * cost, 2)) or round(qty * cost, 2))
        
        matched_prod = None
        
        # 1. Match by exact code/barcode
        if code and code in barcode_map:
            pid = barcode_map[code]
            matched_prod = next((p for p in db_products if p["IDProducto"] == pid), None)
            
        if not matched_prod and code:
            matched_prod = next((p for p in db_products if p["CodigoInterno"].lower() == code.lower()), None)
            
        # 2. Match by normalized name
        if not matched_prod and name:
            norm_name = normalize_text(name)
            tokens_item = set(norm_name.split())
            
            best_score = 0
            best_p = None
            
            for p in db_products:
                p_norm = normalize_text(p["Nombre"])
                p_tokens = set(p_norm.split())
                
                # Check exact substring
                if norm_name in p_norm or p_norm in norm_name:
                    best_p = p
                    best_score = 100
                    break
                
                # Token overlap
                if tokens_item and p_tokens:
                    overlap = len(tokens_item.intersection(p_tokens))
                    if overlap > best_score and overlap >= 2:
                        best_score = overlap
                        best_p = p
            
            if best_p:
                matched_prod = best_p

        if matched_prod:
            processed_items.append({
                "id_producto": matched_prod["IDProducto"],
                "codigo": matched_prod["CodigoInterno"],
                "nombre": matched_prod["Nombre"],
                "descripcion_factura": name,
                "categoria": matched_prod["Categoria"],
                "cantidad": qty,
                "costo_unitario": cost if cost > 0 else matched_prod["PrecioCompraActual"],
                "costo_anterior": matched_prod["PrecioCompraActual"],
                "precio_venta_actual": matched_prod["PrecioVentaActual"],
                "precio_venta_sugerido": matched_prod["PrecioVentaActual"],
                "stock_actual": matched_prod["StockActual"],
                "descuento": desc,
                "subtotal": subtotal,
                "es_nuevo": False
            })
        else:
            # Nuevo producto sugerido
            sug_sale = round(cost * 1.30, 2) if cost > 0 else 0.50
            processed_items.append({
                "id_producto": None,
                "codigo": code or f"AUT-{int(qty*1000)}",
                "nombre": name,
                "descripcion_factura": name,
                "categoria": "Abarrotes",
                "cantidad": qty,
                "costo_unitario": cost,
                "costo_anterior": cost,
                "precio_venta_actual": sug_sale,
                "precio_venta_sugerido": sug_sale,
                "stock_actual": 0,
                "descuento": desc,
                "subtotal": subtotal,
                "es_nuevo": True
            })

    return {
        "proveedor_nombre": matched_supplier_name,
        "id_proveedor": matched_supplier_id,
        "proveedor_ruc": detected_prov_ruc,
        "numero_factura": raw_data.get("numero_factura", ""),
        "fecha_emision": raw_data.get("fecha_emision", ""),
        "subtotal": raw_data.get("subtotal", 0.0),
        "descuento": raw_data.get("descuento", 0.0),
        "impuestos": raw_data.get("impuestos", 0.0),
        "total": raw_data.get("total", 0.0),
        "items": processed_items,
        "total_items": len(processed_items)
    }

def process_invoice_with_gemini(image_bytes: bytes, mime_type: str = "image/jpeg", api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Envía la imagen a Google Gemini Multimodal para extraer datos estructurados de la factura.
    """
    key = api_key or get_api_key()
    if not key:
        raise ValueError("No se ha configurado la API Key de Gemini. Ingrésala en Ajustes o en el modal de escaneo.")

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    system_prompt = (
        "Eres un sistema experto en OCR y visión artificial especializado en facturas comerciales, "
        "notas de entrega y tickets de compra de tiendas y distribuidores en Ecuador "
        "(como Arca Continental / Coca-Cola, Tesalia CBC, Azende, Corporación La Favorita / Titán, "
        "DINADEC, Cervecería Nacional, Distribuidoras de Snacks, etc.).\n\n"
        "Analiza minuciosamente la imagen proporcionada y extrae todos los datos legibles. "
        "Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura exacta:\n"
        "{\n"
        '  "proveedor_nombre": "Razón social o nombre comercial del proveedor/distribuidor",\n'
        '  "proveedor_ruc": "RUC del proveedor (13 dígitos) si aparece",\n'
        '  "numero_factura": "Número de factura completo (ej: 029-001-001309343, 016-010-..., o número de nota de entrega)",\n'
        '  "fecha_emision": "Fecha en formato YYYY-MM-DD o DD/MM/YYYY",\n'
        '  "subtotal": 0.0,\n'
        '  "descuento": 0.0,\n'
        '  "impuestos": 0.0,\n'
        '  "total": 0.0,\n'
        '  "items": [\n'
        "    {\n"
        '      "codigo": "Código, referencia o SKU del producto si aparece en la columna de códigos",\n'
        '      "nombre": "Descripción clara del producto (ej: Coca-Cola 3L PET, Güitig 500ml, etc.)",\n'
        '      "cantidad": 1.0,\n'
        '      "costo_unitario": 0.0,\n'
        '      "descuento": 0.0,\n'
        '      "subtotal": 0.0\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "IMPORTANTE:\n"
        "1. Extrae TODOS los productos que aparezcan en las filas de la tabla de la factura.\n"
        "2. Convierte cantidades y precios a números flotantes (ej: 2.35 en lugar de '$2,35').\n"
        "3. No agregues texto explicativo ni markdown alrededor, solo el JSON puro."
    )

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
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    models = [DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]
    last_err = None

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=35) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if not candidates:
                    raise ValueError("El modelo de IA no generó ninguna respuesta.")
                
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise ValueError("Respuesta vacía del modelo de IA.")

                text_resp = parts[0].get("text", "").strip()
                if text_resp.startswith("```"):
                    text_resp = re.sub(r"^```(?:json)?", "", text_resp).rstrip("`").strip()

                parsed_json = json.loads(text_resp)
                return match_products_and_supplier(parsed_json)

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            last_err = f"HTTP Error {e.code}: {err_body}"
            continue
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"Error procesando factura con Gemini: {last_err}")
