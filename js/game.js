import Spawner from './spawner.js';
import HouseGen from './houseGen.js';
import Player from './player.js';
import Windows from './windows.js';
import Socials from './socials.js';
import Leaderboard, { readStored, writeStored } from './leaderboard.js';
import { difficultyAt, FixedClock, RunLife, milestoneAt, SCORE_RATE, TOKEN_POINTS, worldSpeed } from './simulation.js';

const canvas = document.getElementById('pixiCanvas');
const scene = document.getElementById('laundr-game');
const ui = new Windows();
const leaderboard = new Leaderboard('leaderboard-container');
const socials = new Socials();
const clock = new FixedClock();
const runLife = new RunLife();
const world = { width: 900, height: 225, ground: 202.5, container: new PIXI.Container() };
const app = new PIXI.Application({
  view: canvas, width: scene.clientWidth, height: scene.clientHeight,
  backgroundColor: 0xf5f5f4, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
});
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
world.container.sortableChildren = true;
app.stage.addChild(world.container);
let state = 'loading';
let player, spawner, houses, backgroundFront, backgroundBack;
let jumpSound, deathSound, tokenSound;
let runTime = 0;
let score = 0;
let tokens = 0;
let lastMilestone = 1;
let bestCelebrated = false;
let startingBest = leaderboard.best;
let muted = readStored('hamperman-muted', 'false') === 'true';
const effects = [];
const held = { jump: new Set(), duck: new Set() };
const canvasTouches = new Map();
const input = { jump: false, duck: false };
const pauseButton = document.getElementById('pause-button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateHUD() {
  document.getElementById('score-value').textContent = Math.round(score).toLocaleString();
  document.getElementById('best-value').textContent = Math.round(Math.max(score, leaderboard.best)).toLocaleString();
  document.getElementById('tokens-value').textContent = tokens;
  document.getElementById('life-value').textContent = String(runLife.lives);
  document.getElementById('life-status').textContent = runLife.invulnerability > 0
    ? `Safe · ${Math.ceil(runLife.invulnerability)}s` : runLife.lives > 0 ? 'Ready' : `At ${runLife.nextLifeScore.toLocaleString()}`;
  const milestone = milestoneAt(runTime);
  document.getElementById('milestone-label').textContent = `LEVEL ${milestone.level}`;
  document.getElementById('milestone-progress').value = runTime % 30;
  document.getElementById('run-time').textContent = `${Math.floor(runTime / 60)}:${String(Math.floor(runTime % 60)).padStart(2, '0')}`;
}

function resize() {
  const oldWidth = world.width;
  const viewWidth = scene.clientWidth;
  const viewHeight = scene.clientHeight;
  world.width = world.height * viewWidth / viewHeight;
  app.renderer.resize(viewWidth, viewHeight);
  // Explicit CSS dimensions are needed with autoDensity on high-DPI displays.
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  world.container.scale.set(viewHeight / world.height);
  if (player) {
    player.resize();
    spawner?.resize(world.width / oldWidth);
    houses?.resize(world.width / oldWidth);
  }
  if (backgroundBack) {
    backgroundBack.width = world.width;
    backgroundFront.width = world.width;
  }
  if (state === 'running' && Math.abs(oldWidth - world.width) > 1) pause();
}
new ResizeObserver(resize).observe(scene);
resize();

app.loader
  .add('charaSheet', 'sprites/charaSpriteSheet.json')
  .add('obSheet', 'sprites/obstacleSprites.json')
  .add('houseSheet', 'sprites/backgroundHouse.json')
  .add('tokenSheet', 'sprites/LaundrBombSprite.json')
  .add('road', 'sprites/background_road.png')
  .add('sky', 'sprites/background_sky.png')
  .add('deathSound', 'sounds/death.wav')
  .add('jumpSound', 'sounds/jump.wav')
  .add('tokenSound', 'sounds/jelly2.wav');
let loadFailed = false;
app.loader.onError.add((error, loader, resource) => {
  if (resource?.name?.endsWith('Sound')) return; // Sound is optional; artwork is required.
  loadFailed = true;
  document.getElementById('loading-message').textContent = 'The laundry got stuck loading. Please try again.';
  document.getElementById('reload-button').hidden = false;
});
app.loader.load((loader, resources) => {
  if (loadFailed) return;
  function sound(name) {
    if (!PIXI.sound || resources[name].error) return null;
    try {
      const loadedSound = resources[name].sound || PIXI.sound.Sound.from(resources[name]);
      loadedSound.volume = 0.4;
      loadedSound.muted = muted;
      return loadedSound;
    } catch { return null; }
  }
  deathSound = sound('deathSound');
  jumpSound = sound('jumpSound');
  tokenSound = sound('tokenSound');
  backgroundBack = new PIXI.TilingSprite(resources.sky.texture, world.width, world.height);
  backgroundBack.tileScale.set(0.88);
  backgroundBack.zIndex = -1;
  backgroundFront = new PIXI.TilingSprite(resources.road.texture, world.width, world.height * 0.25);
  backgroundFront.tileScale.set(3.52);
  backgroundFront.y = world.height - 50.25;
  backgroundFront.zIndex = 2;
  world.container.addChild(backgroundBack, backgroundFront);
  player = new Player(app, world, jumpSound, landingPuff);
  houses = new HouseGen(app, world);
  player.setPaused(true);
  state = 'ready';
  ui.show('start');
  document.getElementById('start-button').focus({ preventScroll: true });
});

function unlockAudio() {
  const context = PIXI.sound?.context?.audioContext;
  if (context?.state === 'suspended') context.resume().catch(() => {});
}

function startRun() {
  if (!player || state === 'loading') return;
  unlockAudio();
  clearInput();
  spawner?.destroy();
  houses?.destroy();
  clearEffects();
  player.reset();
  runLife.reset();
  houses = new HouseGen(app, world);
  spawner = new Spawner(app, world, player, hitObstacle, collectToken, text => ui.showHint(text, 6));
  runTime = 0;
  score = 0;
  tokens = 0;
  lastMilestone = 1;
  startingBest = leaderboard.best;
  bestCelebrated = false;
  clock.reset();
  leaderboard.hide();
  ui.show(null);
  ui.showHint('SPACE / ↑ / JUMP — HOLD FOR HIGH JUMP', 7);
  document.querySelector('.share-details').open = false;
  pauseButton.disabled = false;
  state = 'running';
  updateHUD();
  canvas.focus({ preventScroll: true });
}

function endGame() {
  if (state !== 'running') return;
  state = 'over';
  clearInput();
  clock.reset();
  spawner.setPaused(true);
  player.die();
  deathSound?.play();
  pauseButton.disabled = true;
  ui.clearHint();
  const isBest = leaderboard.recordBest(score);
  ui.showGameOver(score, runTime, tokens, isBest);
  leaderboard.showNameEntry(score);
  socials.endGame(score);
  updateHUD();
}

function awardExtraLife() {
  // Match the rounded score shown in the HUD at the reward threshold.
  if (!runLife.award(Math.round(score))) return false;
  floatText('+1 life!', player.x, player.body.y - 80, '#95660a');
  ui.showHint('1UP! EXTRA LIFE READY', 5);
  return true;
}

function hitObstacle() {
  const result = runLife.hit();
  if (result === 'dead') { endGame(); return false; }
  if (result === 'saved') {
    player.setProtection(runLife.invulnerability, reducedMotion);
    floatText('Life saved!', player.x, player.body.y - 80, '#95660a');
    ui.showHint('1UP USED — INVINCIBLE FOR 3s', 3);
  }
  return true;
}

function pause() {
  if (state !== 'running') return;
  state = 'paused';
  clearInput();
  clock.reset();
  player.setPaused(true);
  spawner.setPaused(true);
  pauseButton.textContent = 'Resume';
  pauseButton.setAttribute('aria-label', 'Resume game');
  ui.show('pause');
  document.getElementById('resume-button').focus({ preventScroll: true });
}

function resume() {
  if (state !== 'paused' || document.hidden) return;
  unlockAudio();
  clock.reset();
  state = 'running';
  player.setPaused(false);
  spawner.setPaused(false);
  ui.show(null);
  pauseButton.textContent = 'Pause';
  pauseButton.setAttribute('aria-label', 'Pause game');
  canvas.focus({ preventScroll: true });
}

function toggleMute() {
  muted = !muted;
  for (const sound of [jumpSound, deathSound, tokenSound]) if (sound) sound.muted = muted;
  writeStored('hamperman-muted', String(muted));
  renderMute();
}
function renderMute() {
  const button = document.getElementById('mute-button');
  button.textContent = muted ? 'Sound off' : 'Sound on';
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}
renderMute();

document.getElementById('start-button').onclick = startRun;
document.getElementById('replay-button').onclick = startRun;
document.getElementById('resume-button').onclick = resume;
document.getElementById('reload-button').onclick = () => window.location.reload();
pauseButton.onclick = () => state === 'paused' ? resume() : pause();
document.getElementById('mute-button').onclick = toggleMute;
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function press(action, source) {
  if (state === 'ready' || state === 'over') {
    if (action !== 'jump') return;
    startRun();
  }
  if (state !== 'running') return;
  const wasHeld = input[action];
  held[action].add(source);
  input[action] = true;
  if (action === 'jump' && !wasHeld) player.requestJump();
}
function release(action, source) {
  held[action].delete(source);
  input[action] = held[action].size > 0;
}
function clearInput() {
  canvasTouches.clear();
  for (const action of ['jump', 'duck']) {
    held[action].clear();
    input[action] = false;
    document.getElementById(`${action}-button`).classList.remove('pressed');
  }
  if (player) player.body.buffer = 0;
}
function isEditing(target) {
  return target instanceof Element && (target.closest('input, textarea, select') || target.isContentEditable);
}
window.addEventListener('keydown', event => {
  if (isEditing(event.target)) return;
  const action = event.code === 'Space' || event.code === 'ArrowUp' ? 'jump' : event.code === 'ArrowDown' ? 'duck' : null;
  if (action) {
    if (state === 'loading' || state === 'paused') return;
    event.preventDefault();
    if (!event.repeat) press(action, `key:${event.code}`);
  } else if (!event.repeat && (event.code === 'KeyP' || event.code === 'Escape')) {
    event.preventDefault();
    state === 'paused' ? resume() : pause();
  } else if (!event.repeat && event.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', event => {
  const action = ['Space', 'ArrowUp'].includes(event.code) ? 'jump' : event.code === 'ArrowDown' ? 'duck' : null;
  if (action) release(action, `key:${event.code}`);
});
for (const action of ['jump', 'duck']) {
  const button = document.getElementById(`${action}-button`);
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(action, `pointer:${event.pointerId}`);
    if (state === 'running') button.classList.add('pressed');
  });
  const end = event => {
    release(action, `pointer:${event.pointerId}`);
    if (!input[action]) button.classList.remove('pressed');
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, end);
  // Keyboard and assistive activation do not produce pointerdown.
  button.addEventListener('click', event => { if (event.detail === 0) { press(action, 'button'); release(action, 'button'); } });
}
canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const action = event.clientY - bounds.top < bounds.height * 2 / 3 ? 'jump' : 'duck';
  canvasTouches.set(event.pointerId, action);
  press(action, `canvas:${event.pointerId}`);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
  const action = canvasTouches.get(event.pointerId);
  if (action) release(action, `canvas:${event.pointerId}`);
  canvasTouches.delete(event.pointerId);
});

function floatText(text, x, y, color = '#007e90') {
  const sprite = new PIXI.Text(text, { fontFamily: 'Arial', fontSize: 17, fontWeight: 'bold', fill: color, stroke: '#ffffff', strokeThickness: 3 });
  sprite.anchor.set(0.5);
  sprite.position.set(x, Math.max(20, y));
  sprite.zIndex = 8;
  world.container.addChild(sprite);
  effects.push({ sprite, remaining: 0.8, lifetime: 0.8, velocity: reducedMotion ? 0 : -28 });
}
function collectToken(x, y) {
  tokenSound?.play();
  score += TOKEN_POINTS;
  tokens++;
  floatText('+25', x, y);
  awardExtraLife();
}
function landingPuff(x, y) {
  if (reducedMotion) return;
  const sprite = new PIXI.Graphics();
  sprite.beginFill(0xdce3e3, 0.8).drawEllipse(0, 0, 12, 3).endFill();
  sprite.position.set(x, y);
  sprite.zIndex = 4;
  world.container.addChild(sprite);
  effects.push({ sprite, remaining: 0.25, lifetime: 0.25, velocity: 0 });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.remaining -= dt;
    effect.sprite.y += effect.velocity * dt;
    effect.sprite.alpha = Math.max(0, effect.remaining / effect.lifetime);
    if (effect.remaining <= 0) {
      world.container.removeChild(effect.sprite);
      effect.sprite.destroy();
      effects.splice(i, 1);
    }
  }
}
function clearEffects() {
  for (const effect of effects) { world.container.removeChild(effect.sprite); effect.sprite.destroy(); }
  effects.length = 0;
}

function step(dt) {
  if (state !== 'running') return false;
  runTime += dt;
  score += SCORE_RATE * difficultyAt(runTime).speed * dt;
  runLife.update(dt);
  const awardedLife = awardExtraLife();
  player.update(dt, input);
  player.setProtection(runLife.invulnerability, reducedMotion);
  if (spawner.update(dt, runTime) === false) return false;
  houses.update(dt, runTime);
  const motion = worldSpeed(world.width, runTime) * dt;
  backgroundFront.tilePosition.x = (backgroundFront.tilePosition.x - motion) % (backgroundFront.texture.width * 3.52);
  backgroundBack.tilePosition.x = (backgroundBack.tilePosition.x - motion * 0.34) % (backgroundBack.texture.width * 0.88);
  ui.update(dt);
  updateEffects(dt);
  const milestone = milestoneAt(runTime);
  if (milestone.level !== lastMilestone) {
    lastMilestone = milestone.level;
    if (!awardedLife && runLife.invulnerability === 0) ui.showHint(`LEVEL ${milestone.level}`, 4);
  }
  if (!bestCelebrated && startingBest > 0 && score > startingBest) {
    bestCelebrated = true;
    floatText('Personal best!', player.x, player.body.y - 90, '#95660a');
  }
  return true;
}
app.ticker.add(() => {
  if (state === 'running') {
    clock.advance(app.ticker.elapsedMS / 1000, step);
    updateHUD();
  } else {
    clock.reset();
    if (state === 'over') player.updateDeath(Math.min(app.ticker.elapsedMS / 1000, 0.05));
  }
});
updateHUD();
