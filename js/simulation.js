// All gameplay clocks advance only during active simulation steps.
export const STEP = 1 / 144;
export const JUMP_BUFFER = 0.15;
export const SCORE_RATE = 2.08;
export const TOKEN_POINTS = 25;
export const EXTRA_LIFE_SCORE = 1000;
export const INVULNERABILITY_SECONDS = 3;

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function difficultyAt(seconds) {
  const speed = Math.min(1.3, 1 + Math.floor(seconds / 20) * 0.02);
  const completedLevels = Math.floor(seconds / 30);
  const minGap = Math.max(0.85, 2.1 * Math.pow(0.9, completedLevels));
  const maxGap = Math.max(minGap + 0.3, 3 * Math.pow(0.9, completedLevels));
  const doubleChance = Math.min(0.6, 0.25 + completedLevels * 0.025);
  return { speed, minGap, maxGap, doubleChance };
}

export function worldSpeed(width, seconds) {
  // Preserve the time to react when the viewport narrows in portrait mode.
  return 504 * Math.max(0.7, Math.min(1, width / 900)) * difficultyAt(seconds).speed;
}

export function nextGap(seconds, groupWidth, speed, random = Math.random) {
  const { minGap, maxGap } = difficultyAt(seconds);
  // Leave room for a full held jump and landing before the next group arrives.
  return Math.max(minGap + random() * (maxGap - minGap), groupWidth / speed + 0.9);
}

export class RunLife {
  constructor() { this.reset(); }
  reset() {
    this.awardedLives = 0;
    this.lives = 0;
    this.invulnerability = 0;
  }
  get nextLifeScore() { return (this.awardedLives + 1) * EXTRA_LIFE_SCORE; }
  award(score) {
    const earned = Math.floor(score / EXTRA_LIFE_SCORE);
    if (earned <= this.awardedLives) return false;
    this.lives += earned - this.awardedLives;
    this.awardedLives = earned;
    return true;
  }
  update(dt) {
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    if (this.invulnerability < 1e-9) this.invulnerability = 0;
  }
  hit() {
    if (this.invulnerability > 0) return 'protected';
    if (this.lives === 0) return 'dead';
    this.lives--;
    this.invulnerability = INVULNERABILITY_SECONDS;
    return 'saved';
  }
}

export function milestoneAt(seconds) {
  const level = Math.floor(seconds / 30) + 1;
  const names = ['Fresh start', 'Spin cycle', 'Heavy load', 'Laundry legend'];
  return { level, name: names[Math.min(level - 1, names.length - 1)], progress: (seconds % 30) / 30 };
}

export function advanceJump(body, input, dt) {
  const previousY = body.y;
  let jumped = false;
  body.buffer = Math.max(0, body.buffer - dt);
  if (body.y >= body.ground && body.buffer > 0 && !input.duck) {
    body.velocity = -580;
    body.buffer = 0;
    jumped = true;
  }
  if (body.y < body.ground || body.velocity < 0) {
    const gravity = body.velocity < 0 && input.jump ? 1244 : 2200;
    body.velocity += (gravity + (input.duck ? 3110 : 0)) * dt;
    body.y += body.velocity * dt;
  }
  const landed = previousY < body.ground && body.y >= body.ground;
  if (body.y >= body.ground) {
    body.y = body.ground;
    body.velocity = 0;
  }
  return { jumped, landed };
}

export class FixedClock {
  constructor() { this.accumulator = 0; }
  reset() { this.accumulator = 0; }
  advance(elapsed, update) {
    // Discard long gaps caused by suspended tabs rather than catching up on hazards.
    this.accumulator += Math.min(Math.max(elapsed, 0), 0.1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP;
      if (update(STEP) === false) { this.reset(); break; }
    }
  }
}
