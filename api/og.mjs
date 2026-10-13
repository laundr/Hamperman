import { ImageResponse } from '@vercel/og';
import { parseScore } from './_share.mjs';

const WIDTH = 1200, HEIGHT = 630, PAD = 48;
const TEXT_WIDTH = WIDTH - HEIGHT - 8 - PAD * 2;
const SHADOW = '5px 5px 0 #070e1c';

const el = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const text = (value, style) => el('div', style, value);

// 1200x630 link preview: the app icon on the left, the logo and either the score or a tagline on the right.
export async function GET(request) {
  const url = new URL(request.url);
  const asset = path => fetch(new URL(path, url)).then(res => res.arrayBuffer());
  const [font, icon, logo] = await Promise.all([
    asset('/fonts/PressStart2P-Regular.ttf'),
    asset('/sprites/hamperman-og-icon.jpg'),
    asset('/sprites/gameLogo.png'),
  ]);

  let middle;
  if (url.searchParams.has('score')) {
    const points = parseScore(url.searchParams.get('score')).toLocaleString('en-US');
    middle = el('div', { flexDirection: 'column' },
      text('I SCORED', { fontSize: 22, color: '#a7b5cf' }),
      // Press Start 2P is monospaced with square glyphs, so this keeps long scores on one line.
      text(points, { fontSize: Math.min(88, Math.floor(TEXT_WIDTH / points.length)), color: '#fff', marginTop: 24, textShadow: SHADOW }),
      text('CAN YOU BEAT IT?', { fontSize: 24, color: '#ffd45a', marginTop: 28, textShadow: SHADOW }));
  } else {
    middle = el('div', { flexDirection: 'column' },
      text('AN ENDLESS', { fontSize: 36, color: '#fff', textShadow: SHADOW }),
      text('LAUNDRY RUN', { fontSize: 36, color: '#ffd45a', marginTop: 16, textShadow: SHADOW }),
      text('JUMP / DUCK / GRAB TOKENS', { fontSize: 16, color: '#a7b5cf', marginTop: 28 }));
  }

  const card = el('div', { width: WIDTH, height: HEIGHT, background: '#10182a', fontFamily: 'Arcade' },
    { type: 'img', props: { src: icon, width: HEIGHT, height: HEIGHT } },
    el('div', {
      flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: PAD,
      borderLeft: '8px solid #60d9ed',
    },
      { type: 'img', props: { src: logo, width: TEXT_WIDTH, height: Math.round(TEXT_WIDTH * 380 / 1552) } },
      middle,
      text('PLAY FREE AT LAUNDR.IO', { fontSize: 18, color: '#60d9ed' })));

  return new ImageResponse(card, {
    width: WIDTH, height: HEIGHT,
    fonts: [{ name: 'Arcade', data: font, weight: 400, style: 'normal' }],
  });
}
