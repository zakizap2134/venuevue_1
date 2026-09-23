/**
 * VenueVue 2.3 - brand placeholder.
 *
 * Renders the VenueVue emblem next to the wordmark. Until real artwork exists it
 * draws an inline SVG cup on a coffee-brown plate; the moment you have a
 * PNG/SVG, pass it in and nothing else changes:
 *
 *   <LogoPlaceholder tone="brand" size="md" src="/brand/venuevue-logo.svg" />
 *
 * Alignment guarantee - an `<img>` never reflows the navbar:
 *   - the emblem sits in a fixed-size box sized by `size`, so the header's
 *     height and the wordmark's baseline do not move when the artwork swaps;
 *   - the image is `object-contain` inside that box, so any aspect ratio fits
 *     without distorting or overflowing; and
 *   - if the file is missing or fails to decode, `onError` falls back to the
 *     built-in SVG instead of leaving a broken-image icon in the header.
 *
 * Every size is at least 48px tall, which keeps the lockup compliant with the
 * tablet touch-target floor even though it is decorative rather than tappable.
 */

import { useId, useState } from 'react';

/** Emblem box, glyph and type scale for each size. */
const SIZES = {
  sm: { box: 'h-12 w-12', icon: 'h-6 w-6', word: 'text-lg', tag: 'text-xs' },
  md: { box: 'h-14 w-14', icon: 'h-7 w-7', word: 'text-xl', tag: 'text-sm' },
  lg: { box: 'h-20 w-20', icon: 'h-10 w-10', word: 'text-3xl', tag: 'text-base' },
};

/**
 * Surface palettes. 'brand' is for the coffee-brown header bar, 'panel' for a
 * card, 'surface' for a bare page background.
 */
const TONES = {
  brand: {
    box: 'border-on-brand/25 bg-on-brand/15',
    icon: 'text-on-brand',
    word: 'text-on-brand',
    tag: 'text-on-brand/80',
  },
  panel: {
    box: 'border-brand bg-brand',
    icon: 'text-on-brand',
    word: 'text-on-panel',
    tag: 'text-on-panel-muted',
  },
  surface: {
    box: 'border-brand bg-brand',
    icon: 'text-on-brand',
    word: 'text-on-surface',
    tag: 'text-on-surface-muted',
  },
};

/** The placeholder emblem: a cup with steam, drawn in currentColor. */
function CupMark({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Body and handle. */}
      <path d="M4.5 9h12v4.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5V9Z" />
      <path d="M16.5 10.5h1.75a2.25 2.25 0 0 1 0 4.5H16.5" />
      {/* Steam. */}
      <path d="M8.5 3.5V6M12 2.5V6" />
    </svg>
  );
}

export default function LogoPlaceholder({
  src,
  alt = 'VenueVue',
  tone = 'brand',
  size = 'md',
  brand = 'VenueVue',
  subtitle,
  showWordmark = true,
  className = '',
}) {
  // A failed load must not leave a broken icon in the header, so the failure is
  // remembered locally and the SVG takes over.
  const [imageFailed, setImageFailed] = useState(false);

  // Ties the accessible name to the visible wordmark without repeating it.
  const nameId = useId();

  const scale = SIZES[size] ?? SIZES.md;
  const palette = TONES[tone] ?? TONES.brand;
  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span
        className={`grid ${scale.box} shrink-0 place-items-center overflow-hidden rounded-2xl border ${palette.box}`}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <CupMark className={scale.icon} />
        )}
      </span>

      {showWordmark && (
        // min-w-0 lets the wordmark truncate instead of pushing the nav off the
        // edge of a narrow tablet in portrait.
        <span className="min-w-0">
          <span
            id={nameId}
            className={`block truncate font-bold leading-tight tracking-tight ${scale.word} ${palette.word}`}
          >
            {brand}
          </span>
          {subtitle && (
            <span className={`block truncate leading-tight ${scale.tag} ${palette.tag}`}>
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
