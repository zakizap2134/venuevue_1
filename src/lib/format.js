/**
 * VenueVue 2.3 - shared display formatters.
 *
 * One Intl.NumberFormat instance is built here and imported everywhere rather
 * than re-created per component: constructing one is comparatively expensive,
 * and a single instance guarantees the same output string on every screen.
 */

/** Philippine peso. peso.format(18450) -> "₱18,450.00". */
export const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

/** Compact peso for space-constrained chips: 18450 -> "₱18,450". */
export const pesoShort = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
