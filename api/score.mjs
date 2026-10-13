import { parseScore, shareMeta } from './_share.mjs';

// /score/1234 serves the normal game page, with link-preview tags that show the score.
export async function GET(request) {
  const url = new URL(request.url);
  const score = parseScore(url.searchParams.get('score') ?? url.pathname.split('/').pop());
  const page = await fetch(new URL('/index.html', url));
  if (!page.ok) return new Response('Could not load the game', { status: 502 });
  return new Response(shareMeta(await page.text(), score), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=86400' },
  });
}
