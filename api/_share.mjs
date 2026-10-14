// Shared by the preview image and score page functions. Files starting with _ aren't deployed as functions.
export const SITE = 'https://laundr.io/hamperman';
export const IMAGE = 'https://hamperman.laundr.io/api/og';

export const parseScore = value => Math.min(Math.max(Number.parseInt(value, 10) || 0, 0), 99999999);

// Swap the default link-preview tags in index.html for ones that show this score.
export function shareMeta(html, score) {
  const points = score.toLocaleString('en-US');
  const tags = {
    'og:url': `${SITE}/score/${score}`,
    'og:title': `I scored ${points} in Hamperman!`,
    'og:description': 'Can you beat it? No sock left behind. Play Hamperman free from Laundr.',
    'og:image': `${IMAGE}?score=${score}`,
    'og:image:alt': `Hamperman high score: ${points}`,
  };
  for (const [key, value] of Object.entries(tags)) {
    html = html.replace(new RegExp(`(property="${key}" content=")[^"]*`), `$1${value}`);
  }
  return html;
}
