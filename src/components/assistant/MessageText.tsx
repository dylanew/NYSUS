import { Fragment, type ReactNode } from 'react'

/**
 * Renders the assistant's reply: paragraphs, "-" / "*" bullets, **bold**, and event ids as
 * chips. Unverified ids (not returned by any tool) are flagged. No HTML is ever injected.
 */
export function MessageText({ text, verifiedIds, unverifiedIds = [] }: { text: string; verifiedIds?: string[]; unverifiedIds?: string[] }) {
  const BULLET = /^\s*([-*•]|\d+\.)\s+/
  // Group lines into paragraphs and bullet lists, so "**Try this**" followed by "- ..." renders both.
  const groups: { list: boolean; lines: string[] }[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      groups.push({ list: false, lines: [] })
      continue
    }
    const list = BULLET.test(line)
    const last = groups.at(-1)
    if (last && last.list === list && last.lines.length) last.lines.push(line)
    else groups.push({ list, lines: [line] })
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.list ? (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-500">
              {g.lines.map((l, j) => (
                <li key={j}>{inline(l.replace(BULLET, ''), verifiedIds, unverifiedIds)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              {g.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l.replace(/^#+\s*/, ''), verifiedIds, unverifiedIds)}
                </Fragment>
              ))}
            </p>
          ),
        )}
    </div>
  )
}

function inline(line: string, verified: string[] | undefined, unverified: string[]): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|`?\b(s\d+-e\d+)\b`?/g
  let last = 0
  let k = 0
  for (const m of line.matchAll(pattern)) {
    if (m.index > last) out.push(line.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-semibold text-ink-100">{inline(m[1], verified, unverified)}</strong>)
    else {
      const id = m[2]!
      const bad = unverified.includes(id)
      out.push(
        <code
          key={k++}
          data-event-id={id}
          title={bad ? 'No tool returned this event id' : verified?.includes(id) ? 'Returned by a diagnostic tool' : undefined}
          className={`rounded px-1 py-px text-[11px] ${bad ? 'bg-danger/15 text-danger line-through' : 'bg-ink-800 text-accent-300'}`}
        >
          {id}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}
