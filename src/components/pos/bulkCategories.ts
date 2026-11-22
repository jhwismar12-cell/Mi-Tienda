import { Product } from '../../types';

export type BulkSubcategory =
  | 'all'
  | 'verdes'
  | 'granos_harinas'
  | 'dulces'
  | 'tabacos'
  | 'papeleria'
  | 'otros';

export type AssignableBulkSubcategory = Exclude<BulkSubcategory, 'all'>;

export type BulkCategoryOverride = AssignableBulkSubcategory | 'none';

export interface BulkSubcategoryMeta {
  key: BulkSubcategory;
  label: string;
  emoji: string;
}

export const BULK_SUBCATEGORIES: BulkSubcategoryMeta[] = [
  { key: 'all', label: 'Todos', emoji: '⚖️' },
  { key: 'verdes', label: 'Productos Verdes', emoji: '🥬' },
  { key: 'granos_harinas', label: 'Granos y Harinas', emoji: '🌾' },
  { key: 'dulces', label: 'Dulces', emoji: '🍬' },
  { key: 'tabacos', label: 'Tabacos', emoji: '🚬' },
  { key: 'papeleria', label: 'Papelería', emoji: '✏️' },
  { key: 'otros', label: 'Otros Granel', emoji: '🥚' }
];

export const ASSIGNABLE_BULK_SUBCATEGORIES: Array<{
  key: AssignableBulkSubcategory;
  label: string;
  emoji: string;
}> = BULK_SUBCATEGORIES.filter(
  (s): s is { key: AssignableBulkSubcategory; label: string; emoji: string } => s.key !== 'all'
);

export function getBulkSubcategoryMeta(key: BulkSubcategory): BulkSubcategoryMeta {
  return BULK_SUBCATEGORIES.find((s) => s.key === key) || BULK_SUBCATEGORIES[0];
}

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

const CANDY_ALWAYS_RE =
  /\b(bianchis?|katab+o+m+s?|catab+o+m+s?|jet|nucitas?|jazz|caramelos?|chupetes?|chupeteres?|vaferitos?|piazza|millows|bon\s*bon\s*bum|bonbon|frunas?|tumix|bubbaloo|sparkies|revolcon|barrilete|trululu|gomitas?|malvaviscos?)\b/i;

const HALLS_RE = /\bhalls?\b/i;
const HALLS_BAR_EXCL_RE = /\b(barras?|paquetes?|display|cajas?|x\s*9|x\s*12|x\s*20)\b/i;
const HALLS_LOOSE_HINT_RE = /\b(suelt[oa]s?|indiv(?:idual)?|unidad(?:es)?|unid|caramelo|pastilla|1\s*u)\b/i;
const CANDY_UNBARCODED_RE = /\b(chicles?|trident|agogo|mentos|clorets|mentas?)\b/i;
const CANDY_EXCL_RE =
  /\b(chifle|mani|sirope|te\b|leche|galleta|bimbo|submarino|jabon|shampoo|detergente|suavizante|desinfectante|pan|tostado|arroz|aceite|agua|jugo|gaseosa|powerade|vivant|toni|cocoa|avena)\b/i;

const PACKAGED_NOISE_RE =
  /\b(\d+\s*(?:ml|cc|gr|g|oz|lt)|tetra\s*pack|panos|multiusos|rizadas|chips|snack|jugo|gaseosa|jabon|detergente|suavizante|shampoo|cloro|desinfectante)\b/i;

const GRAIN_FLOUR_RE =
  /\b(harinas?|lentejas?|arroz|arrocillo|frejol|frijol|arveja\s+(?:seca|blanca)|alverja\s+(?:seca|blanca)|quinua|quinoa|canguil|mote|maiz|machica|garbanzo|trigo|cebada|avena|azucar|panela|poroto|haba|semola|polenta)\b/i;

const PRODUCE_RE =
  /\b(aguacate|arveja\s+verde|cebolla|guineo|limon|maduro|naranja|naranjilla|papas?|pimiento|platano|verde|tomate|zanahoria|ajo|cilantro|hierbita|yerbita|lechuga|col|brocoli|pepino|yuca|manzana|pera|uva|fresa|mora|pina|sandia|melon|maracuya|babaco|mango|durazno|choclo|elote|apio|perejil|acelga|espinaca|remolacha|rabano|nabo|coliflor|zapallo|zambo|sambo|camote|melloco|oca|frutilla|mandarina|toronja|lima|coco)\b/i;

const PROMO_ITEM_RE =
  /Promo:\s*(?:([^()|—]+?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*\$\s*(\d+(?:[.,]\d+)?)\s*\)|(\d+(?:[.,]\d+)?)\s*[xX×]\s*\$\s*(\d+(?:[.,]\d+)?))/gi;

const BULK_CATEGORY_TAG_RE =
  /\[Granel:\s*(verdes|granos_harinas|dulces|tabacos|papeleria|otros|none)\]/i;

const BULK_CATEGORY_TAG_GLOBAL_RE =
  /\s*\[Granel:\s*(?:verdes|granos_harinas|dulces|tabacos|papeleria|otros|none)\]\s*/gi;

export function normalizeBulkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseBulkCategoryOverride(description?: string): BulkCategoryOverride | null {
  if (!description) return null;
  const match = description.match(BULK_CATEGORY_TAG_RE);
  if (!match) return null;
  return match[1].toLowerCase() as BulkCategoryOverride;
}

export function stripBulkCategoryTag(description?: string): string {
  if (!description) return '';
  return description
    .replace(BULK_CATEGORY_TAG_GLOBAL_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function applyBulkCategoryOverride(
  description: string | undefined,
  override: BulkCategoryOverride | null
): string {
  const base = stripBulkCategoryTag(description);
  if (!override) return base;
  const tag = `[Granel: ${override}]`;
  return base ? `${base} ${tag}` : tag;
}

export function parsePromosFromDescription(description?: string): ParsedPromo[] {
  const cleanDescription = stripBulkCategoryTag(description);
  if (!cleanDescription) return [];
  const promos: ParsedPromo[] = [];
  const regex = new RegExp(PROMO_ITEM_RE.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleanDescription)) !== null) {
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
  const cleanDescription = stripBulkCategoryTag(description);
  if (!cleanDescription) return '';
  const withoutPromos = cleanDescription
    .replace(new RegExp(PROMO_ITEM_RE.source, 'gi'), '')
    .replace(/\|/g, '')
    .replace(/^\s*[—–-]\s*/, '')
    .replace(/\s*[—–-]\s*$/, '')
    .trim();
  return withoutPromos;
}

export function serializePromosToDescription(
  promos: ComboInput[],
  note?: string,
  bulkCategoryOverride?: BulkCategoryOverride | null
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
  const trimmedNote = stripBulkCategoryTag(note);

  let base = '';
  if (promoSection && trimmedNote) {
    base = `${promoSection} — ${trimmedNote}`;
  } else if (promoSection) {
    base = promoSection;
  } else {
    base = trimmedNote;
  }

  const withTag = applyBulkCategoryOverride(base, bulkCategoryOverride ?? null);
  return withTag || undefined;
}

export function formatPromoDescription(
  qtyRaw: string | number,
  totalRaw: string | number,
  note?: string,
  comboName?: string,
  bulkCategoryOverride?: BulkCategoryOverride | null
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
    note,
    bulkCategoryOverride
  );
}

export type BulkProductLike = Pick<
  Product,
  'unit' | 'allowFraction' | 'category' | 'description'
> & {
  name?: string;
  code?: string;
  distributor?: string;
  barcode?: string;
  salePrice?: number;
};

export function isTobaccoProduct(
  prod: Pick<BulkProductLike, 'name' | 'category' | 'code'>
): boolean {
  const code = (prod.code || '').toUpperCase();
  if (code.startsWith('TAB-')) return true;
  const name = normalizeBulkText(prod.name);
  const cat = normalizeBulkText(prod.category);
  return TOBACCO_RE.test(name) || cat.includes('tabac') || cat.includes('cigar');
}

export function isCandyProduct(
  prod: Pick<BulkProductLike, 'name' | 'category' | 'code' | 'barcode' | 'salePrice'>
): boolean {
  const code = (prod.code || '').toUpperCase();
  if (code.startsWith('DUL-')) return true;

  const name = normalizeBulkText(prod.name);
  const cat = normalizeBulkText(prod.category);
  const hasBarcode = Boolean(prod.barcode && prod.barcode.trim() !== '');
  const price = typeof prod.salePrice === 'number' ? prod.salePrice : 0;

  if (name && HALLS_RE.test(name)) {
    if (HALLS_BAR_EXCL_RE.test(name)) return false;
    return !hasBarcode || HALLS_LOOSE_HINT_RE.test(name) || (price > 0 && price <= 0.25);
  }

  if (name && CANDY_EXCL_RE.test(name)) return false;
  if (cat.includes('dulce') || cat.includes('golosin')) return true;
  if (name && CANDY_ALWAYS_RE.test(name)) return true;
  if (!hasBarcode && name && CANDY_UNBARCODED_RE.test(name)) return true;
  return false;
}

export function isStationeryProduct(
  prod: Pick<BulkProductLike, 'name' | 'category' | 'distributor' | 'code'>
): boolean {
  const code = (prod.code || '').toUpperCase();
  if (code.startsWith('PAP-')) return true;
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

export function isBulkEligibleAuto(prod: BulkProductLike): boolean {
  if (isTobaccoProduct(prod)) return true;
  if (isCandyProduct(prod)) return true;
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

export function isBulkEligibleProduct(prod: BulkProductLike): boolean {
  const override = parseBulkCategoryOverride(prod.description);
  if (override === 'none') return false;
  if (override !== null) return true;
  return isBulkEligibleAuto(prod);
}

export function classifyBulkSubcategoryAuto(
  prod: BulkProductLike
): AssignableBulkSubcategory {
  if (isTobaccoProduct(prod)) return 'tabacos';
  if (isCandyProduct(prod)) return 'dulces';
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

export function classifyBulkSubcategory(
  prod: BulkProductLike
): AssignableBulkSubcategory {
  const override = parseBulkCategoryOverride(prod.description);
  if (override && override !== 'none') return override;
  return classifyBulkSubcategoryAuto(prod);
}
