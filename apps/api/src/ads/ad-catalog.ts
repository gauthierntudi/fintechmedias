import { AdFormat } from '@prisma/client';

/** Emplacement du site → format imposé, comme dans l’admin PHP. */
export const PLACEMENT_FORMAT = {
  'pub-header': AdFormat.PAYSAGE_LARGE,
  'pub-modal': AdFormat.LARGE_RECTANGLE,
  'pub-float': AdFormat.PORTRAIT,
  'pub-body-1': AdFormat.PAYSAGE_SMALL,
  'pub-body-2': AdFormat.PAYSAGE_MEDIUM,
  'pub-body-3': AdFormat.PAYSAGE_SMALL,
  'pub-body-sidebar-1': AdFormat.LARGE_PORTRAIT,
  'pub-body-sidebar-2': AdFormat.RECTANGLE,
  'pub-sidebar-1': AdFormat.RECTANGLE,
  'pub-footer': AdFormat.PAYSAGE_LARGE,
} as const;

export type AdPlacement = keyof typeof PLACEMENT_FORMAT;

export const PLACEMENTS = Object.keys(PLACEMENT_FORMAT) as AdPlacement[];

export const FORMAT_DIMENSIONS: Record<AdFormat, string> = {
  RECTANGLE: '672x560',
  PORTRAIT: '512x562',
  LARGE_PORTRAIT: '768x1024',
  LARGE_RECTANGLE: '1024x768',
  PAYSAGE_SMALL: '1456x180',
  PAYSAGE_MEDIUM: '1920x400',
  PAYSAGE_LARGE: '3456x502',
};

/** Taille propre à un emplacement, quand elle diffère du format partagé. */
const PLACEMENT_DIMENSIONS: Partial<Record<AdPlacement, string>> = {
  'pub-body-sidebar-2': '672x400',
};

export function dimensionsFor(placement: AdPlacement): string {
  return (
    PLACEMENT_DIMENSIONS[placement] ??
    FORMAT_DIMENSIONS[PLACEMENT_FORMAT[placement]]
  );
}

const PUBLIC_FORMAT: Record<string, AdFormat> = {
  rectangle: AdFormat.RECTANGLE,
  portrait: AdFormat.PORTRAIT,
  large_portrait: AdFormat.LARGE_PORTRAIT,
  large_rectangle: AdFormat.LARGE_RECTANGLE,
  paysage_small: AdFormat.PAYSAGE_SMALL,
  paysage_medium: AdFormat.PAYSAGE_MEDIUM,
  paysage_large: AdFormat.PAYSAGE_LARGE,
};

export function publicFormat(value: string): AdFormat | null {
  return PUBLIC_FORMAT[value] ?? null;
}

export function formatSlug(format: AdFormat): string {
  return format.toLowerCase();
}

export function placementOf(value: string): AdPlacement | null {
  return (PLACEMENTS as string[]).includes(value) ? (value as AdPlacement) : null;
}
