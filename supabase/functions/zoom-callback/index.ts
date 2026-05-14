// GET /functions/v1/zoom-callback?code=...&state=...
// Zoom hits this after the user approves. We exchange the code for tokens,
// stash them in Storage, then render a "close this tab" page.
import { exchangeCodeForToken, saveTokens } from '../_shared/zoom.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return html(`Zoom auth error: ${escape(error)}`, 400)
  }
  if (!code) {
    return html('Missing code', 400)
  }
  try {
    const tokens = await exchangeCodeForToken(code)
    await saveTokens(tokens)
    return html(`
      <h2>Zoom 연결 완료</h2>
      <p>이 창을 닫고 plinq 앱으로 돌아가세요.</p>
      <script>setTimeout(() => window.close(), 1500)</script>
    `)
  } catch (e) {
    return html(`Token exchange failed: ${escape((e as Error).message)}`, 500)
  }
})

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;padding:40px;line-height:1.5;">${body}</body></html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  })
}
