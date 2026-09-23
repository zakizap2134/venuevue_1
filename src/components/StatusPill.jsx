/**
 * VenueVue 2.3 - inline status pill.
 *
 * One component for every inline badge, code chip and status tag in the app, so
 * the "never dark text on a dark chip" rule is enforced in a single place instead
 * of per screen.
 *
 * The rule the table below encodes: the specimen hex is a FILL. It paints the
 * background wash, the border and the dot; the label always sits in an on-*
 * partner token. That is what keeps `#D8C5AC` chips readable in light mode
 * (charcoal on latte, 8.4:1), `#7A5E45` chips readable in dark mode (cream on
 * latte, 4.9:1), and a violet or sky wash readable without ever writing
 * `#8E7CC3` on `#4A3325`.
 *
 * `tone="brand"` is the spec's other option - coffee brown fill, cream bold text
 * (10.2:1 light, 8.6:1 dark) - for the one chip per screen that has to shout.
 *
 * `as` lets a chip be a real `<code>` where the content is an identifier, so
 * screen readers and copy/paste both see it as code.
 */

/** Fill + label pairing per tone, plus an optional status dot. */
const TONES = {
  neutral: { shell: 'border-line bg-panel text-on-panel-muted' },
  latte: { shell: 'border-latte bg-latte text-on-latte' },
  brand: { shell: 'border-brand bg-brand text-on-brand' },
  in: { shell: 'border-stock-in bg-stock-in/15 text-on-panel', dot: 'bg-stock-in' },
  low: { shell: 'border-stock-low bg-stock-low/15 text-on-panel', dot: 'bg-stock-low' },
  out: { shell: 'border-stock-out bg-stock-out/15 text-on-panel', dot: 'bg-stock-out' },
  accent: { shell: 'border-accent bg-accent/20 text-on-panel', dot: 'bg-accent' },
  info: { shell: 'border-info bg-info/15 text-on-panel', dot: 'bg-info' },
};

export default function StatusPill({
  as: Tag = 'span',
  tone = 'neutral',
  dot,
  className = '',
  children,
  ...rest
}) {
  const styles = TONES[tone] ?? TONES.neutral;

  // An explicit `dot` wins; `dot={false}` removes the tone's default dot.
  const dotClass = dot ?? styles.dot;

  return (
    <Tag
      {...rest}
      className={
        'inline-flex min-h-8 items-center gap-2 rounded-full border-2 px-3 py-1 ' +
        `text-sm font-semibold ${styles.shell} ${className}`
      }
    >
      {dotClass && (
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      )}
      {children}
    </Tag>
  );
}
