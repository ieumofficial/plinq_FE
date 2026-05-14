/**
 * Tiny markdown renderer for assistant chat bubbles.
 *
 * Handles ```code blocks```, GFM tables, bullet lists (- or *), ordered lists
 * (1. 2. 3.), **bold**, `inline code`, and \n. Escapes first so user-supplied
 * text can never inject HTML.
 */

export function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  )
}

export function renderMarkdown(src: string | null | undefined): string {
  if (!src) return ''
  let html = escapeHtml(src)

  // Fenced code blocks (escape already applied to inside).
  html = html.replace(/```([^`]*?)```/g, (_m, code) => {
    return `<pre><code>${(code as string).replace(/^\n/, '')}</code></pre>`
  })

  // Tables: header row + separator + body rows.
  html = html.replace(
    /(^|\n)(\|[^\n]+\|)\n\|[\s\-:|]+\|\n((?:\|[^\n]+\|(?:\n|$))+)/g,
    (_m, lead, header, body) => {
      const cells = (line: string) =>
        line
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((s) => s.trim())
      const ths = cells(header).map((c) => `<th>${c}</th>`).join('')
      const trs = (body as string)
        .trim()
        .split('\n')
        .map(
          (row) =>
            `<tr>${cells(row)
              .map((c) => `<td>${c}</td>`)
              .join('')}</tr>`,
        )
        .join('')
      return `${lead}<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>\n`
    },
  )

  // Ordered lists ("1. ").
  html = html.replace(/(^|\n)((?:\d+\. [^\n]+\n?)+)/g, (_m, lead, block) => {
    const items = (block as string)
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
      .join('')
    return `${lead}<ol>${items}</ol>`
  })

  // Bullet lists.
  html = html.replace(/(^|\n)((?:[-*] [^\n]+\n?)+)/g, (_m, lead, block) => {
    const items = (block as string)
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^[-*] /, '')}</li>`)
      .join('')
    return `${lead}<ul>${items}</ul>`
  })

  // Inline: **bold**, `code`.
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // Newlines → <br>, but skip those right after block tags.
  html = html.replace(/(<\/(?:table|ul|ol|pre)>)\n+/g, '$1')
  html = html.replace(/\n/g, '<br>')

  return html
}
