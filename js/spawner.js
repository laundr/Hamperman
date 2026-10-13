import { difficultyAt, nextGap, overlaps, worldSpeed } from './simulation.js';

export default class Spawner {
  constructor(app, world, player, onCollision, onToken, onHint, random = Math.random) {
    Object.assign(this, { app, world, player, onCollision, onToken, onHint, random });
    this.obstacles = [];
    this.tokens = [];
    this.wait = 1.5;
    this.groups = 0;
    this.introducedIron = false;
    this.introducedDouble = false;
  }

  update(dt, seconds) {
    const movement = worldSpeed(this.world.width, seconds) * dt;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const item = this.obstacles[i];
      item.sprite.x -= movement;
      if (overlaps(this.player.bounds, this.bounds(item))) {
        // A saved or protected hit keeps the entire world moving this frame.
        if (this.onCollision() !== true) return false;
      }
      if (item.sprite.x + item.width < 0) this.remove(this.obstacles, i);
    }
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const token = this.tokens[i];
      token.sprite.x -= movement;
      if (overlaps(this.player.bounds, this.bounds(token))) {
        this.onToken(token.sprite.x, token.sprite.y);
        this.remove(this.tokens, i);
      } else if (token.sprite.x + token.width < 0) this.remove(this.tokens, i);
    }
    this.wait -= dt;
    if (this.wait <= 0) this.spawn(seconds);
    return true;
  }

  bounds(item) {
    return { x: item.sprite.x + item.offsetX, y: item.sprite.y + item.offsetY, width: item.width, height: item.height };
  }

  obstacle(name, x, y) {
    const sprite = new PIXI.AnimatedSprite(this.app.loader.resources.obSheet.spritesheet.animations[name]);
    // Align artwork feet rather than the transparent square of the sprite sheet.
    const isIron = name === 'ironSprite';
    const isLaundry = name === 'laundrySprite';
    sprite.anchor.set(0.5, (isIron ? 107 : isLaundry ? 169 : 181) / 192);
    sprite.scale.set(1 / 2.41);
    sprite.position.set(x, y);
    sprite.animationSpeed = 0.125;
    sprite.zIndex = isIron ? 5 : 3;
    sprite.play();
    this.world.container.addChild(sprite);
    const width = isIron ? 64 : isLaundry ? 43 : 45;
    const height = isIron ? 24 : isLaundry ? 36 : 58;
    this.obstacles.push({ sprite, width, height, offsetX: -width / 2, offsetY: -height - 2 });
  }

  token(x, y) {
    const sprite = new PIXI.AnimatedSprite(this.app.loader.resources.tokenSheet.spritesheet.animations.tokenSprite);
    sprite.anchor.set(0.5);
    sprite.scale.set(1 / 3.5);
    sprite.position.set(x, y);
    sprite.animationSpeed = 0.135;
    sprite.zIndex = 4;
    sprite.play();
    this.world.container.addChild(sprite);
    this.tokens.push({ sprite, width: 22, height: 22, offsetX: -11, offsetY: -11 });
  }

  spawn(seconds) {
    const x = this.world.width + 55;
    const roll = this.random();
    let groupWidth = 55;
    let iron = seconds >= 20 && roll < 0.25;
    let double = seconds >= 35 && roll >= 0.25 && roll < 0.25 + difficultyAt(seconds).doubleChance;
    // Each new action gets a predictable first example.
    if (seconds >= 20 && !this.introducedIron) { iron = true; double = false; }
    if (seconds >= 35 && !this.introducedDouble) { double = true; iron = false; }
    if (iron) {
      const high = !this.introducedIron || this.random() < 0.65;
      if (!this.introducedIron) this.onHint('Flying iron ahead! Hold ↓ or Duck to pass underneath.');
      this.introducedIron = true;
      this.obstacle('ironSprite', x, this.world.ground - (high ? 55 : 12));
      groupWidth = 80;
      if (this.groups % 3 === 0) this.token(x, this.world.ground - (high ? 22 : 108));
    } else {
      if (this.groups === 1) this.onHint('Washing machine ahead! Hold Space / ↑ or Jump to clear it.');
      const name = this.groups === 0 ? 'laundrySprite' : this.groups === 1 || this.random() < 0.55 ? 'washerSprite' : 'laundrySprite';
      this.obstacle(name, x, this.world.ground);
      if (double) {
        if (!this.introducedDouble) this.onHint('Double load! Hold Jump for a longer leap.');
        this.introducedDouble = true;
        this.obstacle('laundrySprite', x + 55, this.world.ground);
        groupWidth = 110;
      }
      // A bonus follows the arc over the obstacle; it never forces a conflicting duck.
      if (seconds >= 12 && this.groups % 3 === 0) this.token(x + (double ? 25 : 0), this.world.ground - 108);
    }
    this.groups++;
    this.wait = this.groups === 1 ? 3.6 : nextGap(seconds, groupWidth, worldSpeed(this.world.width, seconds), this.random);
  }

  remove(list, index) {
    const [item] = list.splice(index, 1);
    this.world.container.removeChild(item.sprite);
    item.sprite.destroy();
  }

  resize(ratio) {
    for (const item of [...this.obstacles, ...this.tokens]) item.sprite.x *= ratio;
  }

  setPaused(paused) {
    for (const item of [...this.obstacles, ...this.tokens]) paused ? item.sprite.stop() : item.sprite.play();
  }

  destroy() {
    for (const list of [this.obstacles, this.tokens]) while (list.length) this.remove(list, list.length - 1);
  }
}
