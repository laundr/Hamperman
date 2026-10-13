import { worldSpeed } from './simulation.js';

export default class HouseGen {
  constructor(app, world, random = Math.random) {
    Object.assign(this, { app, world, random });
    this.houses = [];
    this.wait = 1;
    this.build(world.width * 0.65);
  }

  build(x = this.world.width + 20) {
    const name = `backgroundHouse${Math.floor(this.random() * 4)}.png`;
    const house = new PIXI.Sprite(this.app.loader.resources.houseSheet.spritesheet.textures[name]);
    house.anchor.set(0, 1);
    house.scale.set(1.9);
    house.position.set(x, this.world.height * 0.792);
    house.zIndex = 0;
    this.world.container.addChild(house);
    this.houses.push(house);
  }

  update(dt, seconds) {
    for (let i = this.houses.length - 1; i >= 0; i--) {
      const house = this.houses[i];
      house.x -= worldSpeed(this.world.width, seconds) * 0.38 * dt;
      if (house.x + house.width < 0) {
        this.world.container.removeChild(house);
        this.houses.splice(i, 1);
        house.destroy();
      }
    }
    this.wait -= dt;
    if (this.wait <= 0) {
      if (!this.houses.length || this.houses[this.houses.length - 1].x < this.world.width * 0.75) this.build();
      this.wait = 1.5 + this.random() * 2.5;
    }
  }

  resize(ratio) { for (const house of this.houses) house.x *= ratio; }

  destroy() {
    for (const house of this.houses) {
      this.world.container.removeChild(house);
      house.destroy();
    }
    this.houses = [];
  }
}
