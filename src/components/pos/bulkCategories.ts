import { Product } from '../../types';

export type BulkSubcategory = 'all' | 'verdes' | 'granos_harinas' | 'tabacos' | 'otros';

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
  { key: 'otros', label: 'Otros Granel', emoji: '🥚' }
];

const TOBACCO_RE =
  /\b(tabacos?|cigarr(?:os?|illos?)|cajetillas?|catejillas?|lark|marlboro|malboro|lider|canival|carnival|elephant|belmont|lucky|camel|chesterfield|kent)\b|doble\s+capsula/i;

const PACKAGED_NOISE_RE =
  /\b(\d+\s*(?:ml|cc|gr|g|oz|lt)|tetra\s*pack|panos|multiusos|rizadas|chips|snack|jugo|gaseosa|jabon|detergente|suavizante|shampoo|cloro|desinfectante)\b/i;

const GRAIN_FLOUR_RE =
  /\b(harinas?|lentejas?|arroz|arrocillo|frejol|frijol|arveja\s+(?:seca|blanca)|alverja\s+(?:seca|blanca)|quinua|quinoa|canguil|mote|maiz|machica|garbanzo|trigo|cebada|avena|azucar|panela|poroto|haba|semola|polenta)\b/i;

const PRODUCE_RE =
  /\b(aguacate|arveja\s+verde|cebolla|guineo|limon|maduro|naranja|naranjilla|papas?|pimiento|platano|verde|tomate|zanahoria|ajo|cilantro|hierbita|yerbita|lechuga|col|brocoli|pepino|yuca|manzana|pera|uva|fresa|mora|pina|sandia|melon|maracuya|babaco|mango|durazno|choclo|elote|apio|perejil|acelga|espinaca|remolacha|rabano|nabo|coliflor|zapallo|zambo|sambo|camote|melloco|oca|frutilla|mandarina|toronja|lima|coco)\b/i;

const PROMO_RE = /Promo:\s*\d+\s*[xX×]\s*\$\s*\d+(?:[.,]\d+)?/i;

export function normalizeBulkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type BulkProductLike = Pick<
  Product,
  'unit' | 'allowFraction' | 'category' | 'description'
> & {
  name?: string;
  code?: string;
};

export function isTobaccoProduct(prod: Pick<BulkProductLike, 'name' | 'category'>): boolean {
  const name = normalizeBulkText(prod.name);
  const cat = normalizeBulkText(prod.category);
  return TOBACCO_RE.test(name) || cat.includes('tabac') || cat.includes('cigar');
}

export function isBulkEligibleProduct(prod: BulkProductLike): boolean {
  if (isTobaccoProduct(prod)) return true;

  const code = (prod.code || '').toUpperCase();
  const isExplicitBulkCode =
    code.startsWith('GRN-') || code.startsWith('FRV-') || code.startsWith('SINCOD-');
  const normName = normalizeBulkText(prod.name);

  if (!isExplicitBulkCode && normName && PACKAGED_NOISE_RE.test(normName)) {
    return false;
  }

  const unit = (prod.unit || '').toUpperCase();
  const hasPromo = Boolean(prod.description && PROMO_RE.test(prod.description));

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
