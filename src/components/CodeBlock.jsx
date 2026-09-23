/**
 * VenueVue 2.3 - code and query block.
 *
 * Renders a dark island - charcoal `#1F1F1F` behind crisp cream `#FAF7F2` - in
 * either theme, which is what the palette asks for and what makes a query
 * reference readable on a projector. Syntax colours come from the dedicated
 * `--color-code-*` tokens, so the whole block follows the palette instead of
 * pulling in a third-party highlighter and its own theme.
 *
 * `collapsible` wraps the body in a native `<details>`, so the disclosure is
 * keyboard-operable and works with no JavaScript of its own.
 */

/** Reserved words get the violet. Everything else falls through to the default. */
const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'order', 'by', 'group', 'having', 'limit', 'offset',
  'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop',
  'alter', 'join', 'left', 'right', 'inner', 'outer', 'on', 'as', 'and', 'or',
  'not', 'in', 'is', 'null', 'like', 'between', 'desc', 'asc', 'distinct', 'case',
  'when', 'then', 'else', 'end', 'union', 'count', 'sum', 'avg', 'min', 'max',
]);

/* Comments first so `--` wins over a word match, then literals, then numbers. */
const SQL_TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

const TOKEN_CLASS = {
  comment: 'text-code-comment',
  string: 'text-code-string',
  number: 'text-code-number',
  keyword: 'font-semibold text-code-keyword',
  fn: 'text-code-fn',
};

/** Split `source` into `{ text, cls }` runs; `cls` is null for plain text. */
function tokenize(source) {
  const runs = [];
  let end = 0;
  let match;

  SQL_TOKEN.lastIndex = 0;

  while ((match = SQL_TOKEN.exec(source)) !== null) {
    if (match.index > end) {
      runs.push({ text: source.slice(end, match.index), cls: null });
    }

    const [text, comment, literal, number, word] = match;
    let cls = null;

    if (comment) {
      cls = 'comment';
    } else if (literal) {
      cls = 'string';
    } else if (number) {
      cls = 'number';
    } else if (SQL_KEYWORDS.has(word.toLowerCase())) {
      cls = 'keyword';
    } else if (/^\s*\(/.test(source.slice(match.index + text.length))) {
      cls = 'fn';
    }

    runs.push({ text, cls });
    end = match.index + text.length;
  }

  if (end < source.length) {
    runs.push({ text: source.slice(end), cls: null });
  }

  return runs;
}

function Tokenized({ code }) {
  return tokenize(code).map((run, index) =>
    run.cls ? (
      <span key={index} className={TOKEN_CLASS[run.cls]}>
        {run.text}
      </span>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  );
}

/** The dark body: header strip, then the scrollable source. */
function CodeBody({ code, title, caption, language }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-brand/40 bg-code">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-on-code/15 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-on-code/80">
          {title}
        </span>
        <span className="flex items-center gap-2 text-xs text-on-code/80">
          <span className="rounded border border-on-code/30 px-1.5 py-0.5 font-mono uppercase">
            {language}
          </span>
          {caption}
        </span>
      </div>

      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-on-code">
        <code className="font-mono">
          <Tokenized code={code} />
        </code>
      </pre>
    </div>
  );
}

/**
 * Collapsible variant: the `<summary>` strip is part of the charcoal island, not
 * a light panel. On a panel the latte hover wash darkens/lightens the strip away
 * from its `info-strong` text and costs ~3:1 in dark mode; on the charcoal island
 * the same wash stays dark, so cream and `info-soft` keep their contrast.
 */
function CollapsibleCode({ code, title, caption, language, defaultOpen, className }) {
  return (
    <details
      open={defaultOpen}
      className={`group overflow-hidden rounded-xl border-2 border-brand/40 bg-code ${className}`}
    >
      <summary
        className={
          'flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between ' +
          'gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-latte/25 ' +
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-info ' +
          '[&::-webkit-details-marker]:hidden'
        }
      >
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold text-on-code">{title}</span>
          {caption ? <span className="text-xs text-on-code/80">{caption}</span> : null}
        </span>

        <span className="flex items-center gap-3">
          <span className="rounded border border-on-code/30 px-1.5 py-0.5 font-mono text-xs uppercase text-on-code/80">
            {language}
          </span>
          <span className="text-sm font-semibold text-info-soft group-open:hidden">
            Show statement
          </span>
          <span className="hidden text-sm font-semibold text-info-soft group-open:inline">
            Hide statement
          </span>
          <svg
            className="h-5 w-5 text-on-code/80 transition-transform group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>

      <pre className="overflow-x-auto border-t border-on-code/15 p-4 text-sm leading-relaxed text-on-code">
        <code className="font-mono">
          <Tokenized code={code} />
        </code>
      </pre>
    </details>
  );
}

export default function CodeBlock({
  code,
  title = 'Query reference',
  caption,
  language = 'sql',
  collapsible = false,
  defaultOpen = true,
  className = '',
}) {
  if (!collapsible) {
    return (
      <div className={className}>
        <CodeBody code={code} title={title} caption={caption} language={language} />
      </div>
    );
  }

  return (
    <CollapsibleCode
      code={code}
      title={title}
      caption={caption}
      language={language}
      defaultOpen={defaultOpen}
      className={className}
    />
  );
}
