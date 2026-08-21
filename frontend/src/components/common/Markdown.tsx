import React from 'react';

/**
 * Minimal Markdown renderer for assistant messages.
 *
 * The agent's system prompt instructs it to reply in Markdown, but both chat views
 * rendered the raw string, so users saw literal "### " and "**bold**".
 *
 * Builds React elements rather than an HTML string — no dangerouslySetInnerHTML — so
 * model output cannot inject markup. Link hrefs are additionally scheme-checked to
 * block javascript:/data: URLs.
 *
 * Supports: headings, bold, italic, inline code, links, bullet/numbered lists,
 * blockquotes and horizontal rules. Deliberately not a full CommonMark parser.
 */

const SAFE_URL = /^(https?:\/\/|\/|mailto:)/i;

function isSafeHref(href: string): boolean {
  return SAFE_URL.test(href.trim());
}

/** Splits a line into bold / italic / code / link spans. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code first so its contents are not re-parsed, links before emphasis.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-cyan-300 text-[0.95em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isSafeHref(linkMatch[2])) {
        const href = linkMatch[2].trim();
        const isExternal = /^https?:\/\//i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-brand-300 underline decoration-brand-500/40 hover:decoration-brand-300 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        // Unsafe or malformed — render the label only, never the href.
        nodes.push(linkMatch ? linkMatch[1] : token);
      }
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ type: 'hr' });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line.trim());
    if (quote) {
      if (current?.type === 'quote') current.lines.push(quote[1]);
      else {
        flush();
        current = { type: 'quote', lines: [quote[1]] };
      }
      continue;
    }

    // Indented continuation lines of a list item ("  - detail") are folded in as items.
    const bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (current?.type === 'ul') current.items.push(bullet[1]);
      else {
        flush();
        current = { type: 'ul', items: [bullet[1]] };
      }
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (current?.type === 'ol') current.items.push(numbered[1]);
      else {
        flush();
        current = { type: 'ol', items: [numbered[1]] };
      }
      continue;
    }

    if (current?.type === 'paragraph') current.lines.push(line);
    else {
      flush();
      current = { type: 'paragraph', lines: [line] };
    }
  }

  flush();
  return blocks;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-base font-extrabold text-white mt-3 mb-1.5',
  2: 'text-[0.95rem] font-bold text-white mt-3 mb-1.5',
  3: 'text-sm font-bold text-white mt-2.5 mb-1',
  4: 'text-xs font-bold text-slate-100 mt-2 mb-1',
  5: 'text-xs font-semibold text-slate-200 mt-2 mb-1',
  6: 'text-xs font-semibold text-slate-300 mt-2 mb-1',
};

export const Markdown: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        const key = `b${idx}`;
        switch (block.type) {
          case 'heading': {
            const Tag = (`h${Math.min(6, block.level + 2)}` as keyof JSX.IntrinsicElements);
            return (
              <Tag key={key} className={HEADING_CLASS[block.level] || HEADING_CLASS[3]}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case 'hr':
            return <hr key={key} className="border-dark-border my-2" />;
          case 'quote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-brand-500/50 pl-3 py-1 text-slate-300/90 bg-brand-950/30 rounded-r"
              >
                {block.lines.map((l, i) => (
                  <p key={`${key}-q${i}`}>{renderInline(l, `${key}-q${i}`)}</p>
                ))}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc list-outside pl-5 space-y-1">
                {block.items.map((item, i) => (
                  <li key={`${key}-li${i}`}>{renderInline(item, `${key}-li${i}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal list-outside pl-5 space-y-1">
                {block.items.map((item, i) => (
                  <li key={`${key}-li${i}`}>{renderInline(item, `${key}-li${i}`)}</li>
                ))}
              </ol>
            );
          case 'paragraph':
          default:
            return (
              <p key={key}>
                {block.lines.map((l, i) => (
                  <React.Fragment key={`${key}-p${i}`}>
                    {i > 0 && <br />}
                    {renderInline(l, `${key}-p${i}`)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
};
