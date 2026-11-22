import { Product } from '../../types';

export type BulkSubcategory =
  | 'all'
  | 'verdes'
  | 'granos_harinas'
  | 'tabacos'
  | 'papeleria'
  | 'otros';

export interface BulkSubcategoryMeta {
  key: BulkSubcategory;
  label: string;
  emoji: string;
}

export const BULK_SUBCATEGORIES: BulkSubcategoryMeta[] = [
  { key: 'all', label: 'Todos', emoji: '⚖️' },
  { key: 'verdes', label: 'Productos Verdes', emoji: '🥬' },
  { key: 'granos_harinas', label: 'Granos y Harinas', emoji: '🌾' },
  { key: 'tabacos', label: 'Tabacos', emoji: '🚬' },
  { key: 'papeleria', label: 'Papelería', emoji: '✏️' },
  { key: 'otros', label: 'Otros Granel', emoji: '🥚' }
];

export interface ParsedPromo {
  name?: string;
  qty: number;
  total: number;
  label: string;
}

export interface ComboInput {
  name?: string;
  qty: number;
  total: number;
}

const TOBACCO_RE =
  /\b(tabacos?|cigarr(?:os?|illos?)|cajetillas?|catejillas?|lark|marlboro|malboro|lider|canival|carnival|elephant|belmont|lucky|camel|chesterfield|kent)\b|doble\s+capsula/i;

const STATIONERY_RE =
  /\b(borrador(?:es)?|sacapuntas?|cartulinas?|esferos?|lapiz|lapices|cuadernos?|libretas?|carpetas?|folders?|marcador(?:es)?|resaltador(?:es)?|reglas?|tijeras?|cinta\s+(?:masking|scoch|scotch|embalaje)|fomix|foami|papel\s+(?:crepe|periodico|bond|brillo|seda|cometa|calco)|papelotes?|pliego(?:s)?|resma|hojas?\s+(?:perforadas?|a4|cuadros|lineas|bond|papel)|protector\s+de\s+hojas|portaminas?|porta\s+mina|minas\s+0|corrector(?:es)?|pincel(?:es)?|temperas?|plastilina|crayolas?|crayones?|estiletes?|gomero|silicone?\s+liquida|pegamento|brujita|pintura\s+(?:carioca|estilo)|cordon\s+porta\s+credencial|porta\s+credencial)\b/i;

const STATIONERY_EXCL_RE =
  /\b(fosforera|globos|naipe|higienic|aluminio|servilleta|toalla|oregano|mogul)\b/i;

const PACKAGED_NOISE_RE =
  /\b(\d+\s*(?:ml|cc|gr|g|oz|lt)|tetra\s*pack|panos|multiusos|rizadas|chips|snack|jugo|gaseosa|jabon|detergente|suavizante|shampoo|cloro|desinfectante)\b/i;

const GRAIN_FLOUR_RE =
  /\b(harinas?|lentejas?|arroz|arrocillo|frejol|frijol|arveja\s+(?:seca|blanca)|alverja\s+(?:seca|blanca)|quinua|quinoa|canguil|mote|maiz|machica|garbanzo|trigo|cebada|avena|azucar|panela|poroto|haba|semola|polenta)\b/i;

const PRODUCE_RE =
  /\b(aguacate|arveja\s+verde|cebolla|guineo|limon|maduro|naranja|naranjilla|papas?|pimiento|platano|verde|tomate|zanahoria|ajo|cilantro|hierbita|yerbita|lechuga|col|brocoli|pepino|yuca|manzana|pera|uva|fresa|mora|pina|sandia|melon|maracuya|babaco|mango|durazno|choclo|elote|apio|perejil|acelga|espinaca|remolacha|rabano|nabo|coliflor|zapallo|zambo|sambo|camote|melloco|oca|frutilla|mandarina|toronja|lima|coco)\b/i;

const PROMO_ITEM_RE =
  /Promo:\s*(?:([^()|—]+?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*\$\s*(\d+(?:[.,]\d+)?)\s*\)|(\d+(?:[.,]\d+)?)\s*[xX×]\s*\$\s*(\d+(?:[.,]\d+)?))/gi;

export function normalizeBulkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parsePromosFromDescription(description?: string): ParsedPromo[] {
  if (!description) return [];
  const promos: ParsedPromo[] = [];
  const regex = new RegExp(PROMO_ITEM_RE.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(description)) !== null) {
    const rawName = match[1]?.trim();
    const rawQty = match[2] ?? match[4];
    const rawTotal = match[3] ?? match[5];
    const qty = parseFloat((rawQty || '').replace(',', '.'));
    const total = parseFloat((rawTotal || '').replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(total) || total <= 0) continue;
    const qtyText = Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(3)));
    const pricePart = `${qtyText} × $${total.toFixed(2)}`;
    promos.push({
      name: rawName || undefined,
      qty,
      total,
      label: rawName ? `${rawName} (${pricePart})` : pricePart
    });
  }
  return promos;
}

export function parsePromoFromDescription(description?: string): ParsedPromo | null {
  const promos = parsePromosFromDescription(description);
  return promos.length > 0 ? promos[0] : null;
}

export function extractNoteFromDescription(description?: string): string {
  if (!description) return '';
  const withoutPromos = description
    .replace(new RegExp(PROMO_ITEM_RE.source, 'gi'), '')
    .replace(/\|/g, '')
    .replace(/^\s*[—–-]\s*/, '')
    .replace(/\s*[—–-]\s*$/, '')
    .trim();
  return withoutPromos;
}

export function serializePromosToDescription(
  promos: ComboInput[],
  note?: string
): string | undefined {
  const validPromos = promos.filter(
    (p) => Number.isFinite(p.qty) && p.qty > 0 && Number.isFinite(p.total) && p.total > 0
  );
  const promoTokens = validPromos.map((p) => {
    const cleanName = (p.name || '')
      .replace(/[|()—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const qtyText = Number.isInteger(p.qty) ? String(p.qty) : String(Number(p.qty.toFixed(3)));
    if (cleanName) {
      return `Promo: ${cleanName} (${qtyText} x $${p.total.toFixed(2)})`;
    }
    return `Promo: ${qtyText} x $${p.total.toFixed(2)}`;
  });

  const promoSection = promoTokens.join(' | ');
  const trimmedNote = (note || '').trim();

  if (promoSection && trimmedNote) {
    return `${promoSection} — ${trimmedNote}`;
  }
  if (promoSection) {
    return promoSection;
  }
  return trimmedNote || undefined;
}

export function formatPromoDescription(
  qtyRaw: string | number,
  totalRaw: string | number,
  note?: string,
  comboName?: string
): string | undefined {
  const qty =
    typeof qtyRaw === 'number'
      ? qtyRaw
      : parseFloat(String(qtyRaw).trim().replace(',', '.'));
  const total =
    typeof totalRaw === 'number'
      ? totalRaw
      : parseFloat(String(totalRaw).trim().replace(',', '.'));

  const hasPromo = Number.isFinite(qty) && qty > 0 && Number.isFinite(total) && total > 0;
  return serializePromosToDescription(
    hasPromo ? [{ name: comboName, qty, total }] : [],
    note
  );
}

export type BulkProductLike = Pick<
  Product,
  'unit' | 'allowFraction' | 'category' | 'description'
> & {
  name?: string;
  code?: string;
  distributor?: string;
};

export function isTobaccoProduct(prod: Pick<BulkProductLike, 'name' | 'category'>): boolean {
  const name = normalizeBulkText(prod.name);
  const cat = normalizeBulkText(prod.category);
  return TOBACCO_RE.test(name) || cat.includes('tabac') || cat.includes('cigar');
}

export function isStationeryProduct(
  prod: Pick<BulkProductLike, 'name' | 'category' | 'distributor'>
): boolean {
  const name = normalizeBulkText(prod.name);
  const cat = normalizeBulkText(prod.category);
  const dist = normalizeBulkText(prod.distributor);
  if (name && STATIONERY_EXCL_RE.test(name)) return false;
  return (
    cat.includes('papel') ||
    cat.includes('escol') ||
    dist.includes('xavier') ||
    (Boolean(name) && STATIONERY_RE.test(name))
  );
}

export function isBulkEligibleProduct(prod: BulkProductLike): boolean {
  if (isTobaccoProduct(prod)) return true;
  if (isStationeryProduct(prod)) return true;

  const code = (prod.code || '').toUpperCase();
  const isExplicitBulkCode =
    code.startsWith('GRN-') || code.startsWith('FRV-') || code.startsWith('SINCOD-');
  const normName = normalizeBulkText(prod.name);

  if (!isExplicitBulkCode && normName && PACKAGED_NOISE_RE.test(normName)) {
    return false;
  }

  const unit = (prod.unit || '').toUpperCase();
  const hasPromo = parsePromosFromDescription(prod.description).length > 0;

  return (
    isExplicitBulkCode ||
    Boolean(prod.allowFraction) ||
    unit === 'LIBRA' ||
    unit === 'KG' ||
    unit === 'GALON' ||
    prod.category === 'Frutas y Verduras' ||
    hasPromo
  );
}

export function classifyBulkSubcategory(
  prod: BulkProductLike
): Exclude<BulkSubcategory, 'all'> {
  if (isTobaccoProduct(prod)) return 'tabacos';
  if (isStationeryProduct(prod)) return 'papeleria';

  const code = (prod.code || '').toUpperCase();
  const normName = normalizeBulkText(prod.name);
  const normCat = normalizeBulkText(prod.category);

  if (
    GRAIN_FLOUR_RE.test(normName) &&
    !normName.includes('arveja verde') &&
    !code.startsWith('FRV-')
  ) {
    return 'granos_harinas';
  }

  if (
    normCat === 'frutas y verduras' ||
    code.startsWith('FRV-') ||
    PRODUCE_RE.test(normName)
  ) {
    return 'verdes';
  }

  return 'otros';
}
