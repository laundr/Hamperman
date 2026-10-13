import { advanceJump, JUMP_BUFFER } from './simulation.js';

export default class Player {
  constructor(app, world, jumpSound, onLand) {
    this.world = world;
    this.jumpSound = jumpSound;
    this.onLand = onLand;
    const sheet = app.loader.resources.charaSheet.spritesheet;
    this.running = new PIXI.AnimatedSprite(sheet.animations.running_WithSock);
    this.ducking = new PIXI.AnimatedSprite(sheet.animations.duck_WithSock);
    this.jumping = new PIXI.Sprite(sheet.textures['jumping_WithSock_1.png']);
    this.falling = new PIXI.AnimatedSprite(sheet.animations.falling_WithSock);
    this.falling.loop = false;
    this.sprites = [this.running, this.ducking, this.jumping, this.falling];
    for (const sprite of this.sprites) {
      sprite.scale.set(1 / 1.7);
      sprite.zIndex = 3;
      if (sprite instanceof PIXI.AnimatedSprite) sprite.animationSpeed = 0.15;
    }
    this.currSprite = this.running;
    world.container.addChild(this.currSprite);
    this.reset();
  }

  requestJump() { this.body.buffer = JUMP_BUFFER; }

  update(dt, input) {
    const { jumped, landed } = advanceJump(this.body, input, dt);
    if (jumped) this.jumpSound?.play();
    if (landed) this.onLand(this.x - 35, this.body.ground);
    this.switchSprite(this.body.y < this.body.ground ? this.jumping : input.duck ? this.ducking : this.running);
    this.currSprite.y = this.body.y;
  }

  get bounds() {
    const height = this.currSprite === this.ducking ? 39 : this.currSprite === this.jumping ? 60 : 58;
    return { x: this.x - 69, y: this.body.y - height, width: 63, height: height - 3 };
  }

  switchSprite(sprite) {
    if (this.currSprite === sprite) return;
    this.world.container.removeChild(this.currSprite);
    this.currSprite = sprite;
    sprite.position.set(this.x, this.body.y);
    this.world.container.addChild(sprite);
    sprite.play?.();
  }

  resize() {
    this.x = Math.max(100, this.world.width * 0.22);
    for (const sprite of this.sprites) sprite.x = this.x;
  }

  reset() {
    this.body = { y: this.world.ground, ground: this.world.ground, velocity: 0, buffer: 0 };
    this.setProtection(0);
    this.resize();
    this.switchSprite(this.running);
    for (const sprite of this.sprites) sprite.y = this.body.y;
    this.running.play();
  }

  die() {
    this.setProtection(0);
    this.body.buffer = 0;
    this.switchSprite(this.falling);
    this.falling.gotoAndPlay(0);
  }

  updateDeath(dt) {
    this.body.y = Math.min(this.body.ground, this.body.y + 576 * dt);
    this.currSprite.y = this.body.y;
  }

  setPaused(paused) {
    if (paused) this.currSprite.stop?.();
    else this.currSprite.play?.();
  }

  setProtection(seconds, reducedMotion = false) {
    // Two gentle flashes per second; a steady gold tint for reduced motion.
    const alpha = seconds > 0 && !reducedMotion && Math.floor(seconds * 4) % 2 ? 0.35 : 1;
    for (const sprite of this.sprites) {
      sprite.alpha = alpha;
      sprite.tint = seconds > 0 ? 0xffda68 : 0xffffff;
    }
  }
}
