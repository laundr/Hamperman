const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const urls = new Map();
function moduleURL(file) {
  const absolute = path.resolve(__dirname, '..', file);
  if (urls.has(absolute)) return urls.get(absolute);
  let source = fs.readFileSync(absolute, 'utf8');
  source = source.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g, (_, quote, relative) =>
    `from '${moduleURL(path.resolve(path.dirname(absolute), relative))}'`);
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  urls.set(absolute, url);
  return url;
}

class Sprite {
  constructor() {
    this.x = 0; this.y = 0; this.width = 180;
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    this.scale = { set() {} }; this.anchor = { set() {} };
  }
  play() { this.playing = true; }
  stop() { this.playing = false; }
  gotoAndPlay() { this.play(); }
  destroy() { this.destroyed = true; }
}
class AnimatedSprite extends Sprite {}
global.PIXI = { Sprite, AnimatedSprite };
function fakeWorld(width = 900) {
  const children = new Set();
  return { width, height: 225, ground: 202.5, children,
    container: { addChild: item => children.add(item), removeChild: item => children.delete(item) } };
}
function fakeApp() {
  const sheet = { animations: { running_WithSock: [], duck_WithSock: [], falling_WithSock: [], tokenSprite: [], washerSprite: [], laundrySprite: [], ironSprite: [] }, textures: {} };
  return { loader: { resources: Object.fromEntries(['charaSheet', 'obSheet', 'tokenSheet', 'houseSheet'].map(name => [name, { spritesheet: sheet }])) } };
}
const elements = new Map();
function element() {
  return { value: '', hidden: false, children: [], classList: { toggle() {}, remove() {}, add() {} },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    focus() { this.focused = true; }, setCustomValidity(message) { this.validationMessage = message; }, reportValidity() {} };
}
global.document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
let storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };

(async () => {
  const sim = await import(moduleURL('js/simulation.js'));
  const { default: Spawner } = await import(moduleURL('js/spawner.js'));
  const { default: Player } = await import(moduleURL('js/player.js'));
  const { default: HouseGen } = await import(moduleURL('js/houseGen.js'));
  const { default: Leaderboard } = await import(moduleURL('js/leaderboard.js'));
  let passed = 0;
  function test(name, fn) {
    fn(); passed++;
    console.log(`✓ ${name}`);
  }

  test('Jump height and timing match at 30, 60, and 144 FPS', () => {
    function run(fps) {
      const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: sim.JUMP_BUFFER };
      const clock = new sim.FixedClock();
      let time = 0, peak = body.y, jumps = 0, landings = 0;
      for (let frame = 0; frame < fps * 2; frame++) clock.advance(1 / fps, dt => {
        time += dt;
        const result = sim.advanceJump(body, { jump: time < 0.35, duck: false }, dt);
        peak = Math.min(peak, body.y); jumps += Number(result.jumped); landings += Number(result.landed);
      });
      return { peak, y: body.y, jumps, landings };
    }
    assert.deepEqual(run(30), run(60));
    assert.deepEqual(run(60), run(144));
    assert.equal(run(60).jumps, 1);
    assert.equal(run(60).landings, 1);
  });

  test('A press just before landing jumps on the next grounded step', () => {
    const body = { y: 202, ground: 202.5, velocity: 200, buffer: sim.JUMP_BUFFER };
    assert.equal(sim.advanceJump(body, { jump: true, duck: false }, sim.STEP).landed, true);
    assert.equal(sim.advanceJump(body, { jump: true, duck: false }, sim.STEP).jumped, true);
    assert.ok(body.y < body.ground);
  });

  test('Holding Jump does not cause automatic repeat jumps', () => {
    const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: sim.JUMP_BUFFER };
    let jumps = 0;
    for (let i = 0; i < 144 * 3; i++) jumps += Number(sim.advanceJump(body, { jump: true, duck: false }, sim.STEP).jumped);
    assert.equal(jumps, 1);
  });

  test('Held jumps go higher and ducking in air shortens airtime', () => {
    function arc(hold, duckAt = Infinity) {
      const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: sim.JUMP_BUFFER };
      let peak = 202.5;
      for (let i = 0; i < 200; i++) {
        const result = sim.advanceJump(body, { jump: hold, duck: i * sim.STEP >= duckAt }, sim.STEP);
        peak = Math.min(peak, body.y);
        if (result.landed) return { peak, duration: i * sim.STEP };
      }
      throw new Error('Jump did not land');
    }
    assert.ok(arc(true).peak < arc(false).peak - 40);
    assert.ok(arc(true, 0.2).duration < arc(true).duration);
  });

  test('Simulation freezes on reset and caps a suspended frame', () => {
    const clock = new sim.FixedClock();
    let steps = 0;
    clock.advance(20, () => { steps++; });
    assert.ok(steps <= 15);
    clock.advance(1 / 200, () => { steps++; });
    clock.reset();
    const before = steps;
    clock.advance(1 / 1000, () => { steps++; });
    assert.equal(steps, before);
  });

  test('Difficulty grows on active time and keeps safe positive gaps indefinitely', () => {
    assert.ok(sim.difficultyAt(60).minGap < sim.difficultyAt(0).minGap);
    for (const seconds of [0, 3, 20, 60, 300, 600, 36000]) {
      const d = sim.difficultyAt(seconds);
      assert.ok(d.speed >= 1 && d.speed <= 2.6);
      assert.ok(d.minGap >= 0.9 && d.maxGap > d.minGap);
      for (const width of [427.5, 900]) {
        const speed = sim.worldSpeed(width, seconds);
        assert.ok(sim.nextGap(seconds, 110, speed, () => 0) >= 110 / speed + 0.9);
      }
    }
    assert.equal(sim.milestoneAt(600).level, 21);
    assert.ok(sim.SCORE_RATE * 600 > 999);
  });

  test('Speed increases significantly at each level until its portrait-safe ceiling', () => {
    assert.equal(sim.difficultyAt(0).speed, 1);
    for (let level = 1; level <= 8; level++) {
      const boundary = level * 30;
      const earlier = sim.difficultyAt(boundary - sim.STEP).speed;
      const later = sim.difficultyAt(boundary).speed;
      assert.ok(later > earlier);
      assert.ok(later >= Math.min(2.6, earlier * 1.14) - 1e-9);
      assert.equal(sim.difficultyAt(boundary + 15).speed, later);
    }
    assert.ok(sim.difficultyAt(60).speed >= 1.29);
    assert.ok(sim.difficultyAt(120).speed >= 1.68);
    assert.equal(sim.difficultyAt(240).speed, 2.6);
    assert.equal(sim.difficultyAt(36000).speed, 2.6);
  });

  test('Each higher level increases density until the safe minimum is reached', () => {
    for (let level = 1; level <= 8; level++) {
      const earlier = sim.difficultyAt((level - 1) * 30);
      const later = sim.difficultyAt(level * 30);
      assert.ok(later.minGap <= earlier.minGap);
      assert.ok(later.maxGap <= earlier.maxGap);
      assert.ok(later.doubleChance >= earlier.doubleChance);
    }
    assert.ok(sim.difficultyAt(60).maxGap < sim.difficultyAt(0).maxGap);
    assert.ok(sim.difficultyAt(120).doubleChance > 0.6);
    function countObjects(startTime) {
      const world = fakeWorld();
      const spawner = new Spawner(fakeApp(), world, { bounds: { x: -10000, y: 0, width: 1, height: 1 } }, () => {}, () => {}, () => {}, () => 0.55);
      let count = 0;
      const obstacle = spawner.obstacle.bind(spawner);
      spawner.obstacle = (...args) => { count++; obstacle(...args); };
      for (let frame = 0; frame < 20 * 144; frame++) spawner.update(sim.STEP, startTime + frame * sim.STEP);
      spawner.destroy();
      return count;
    }
    assert.ok(countObjects(60) > countObjects(0) * 2, 'One minute should reach a dense obstacle stream');
    assert.ok(countObjects(300) > countObjects(0) * 2, 'Higher levels should spawn substantially more objects');
  });

  test('Random gaps stay varied above the safety floor, even at top speed', () => {
    for (const width of [427.5, 900]) for (const seconds of [0, 60, 240, 36000]) {
      const speed = sim.worldSpeed(width, seconds);
      for (const groupWidth of [55, 130, 108]) {
        const gaps = [0, 0.25, 0.5, 0.75, 0.999].map(roll => sim.nextGap(seconds, groupWidth, speed, () => roll));
        assert.equal(new Set(gaps).size, gaps.length, 'Random rolls must not collapse to one spacing');
        assert.ok(gaps[4] - gaps[0] > 0.79, 'Late levels still need substantial timing variation');
        assert.ok(gaps[0] >= groupWidth / speed + 0.9);
      }
    }
  });

  test('Double loads vary separation without changing the first teaching example', () => {
    const separations = [];
    for (const roll of [0, 0.5, 0.999]) {
      const spawner = new Spawner(fakeApp(), fakeWorld(), {}, () => {}, () => {}, () => {}, () => roll);
      spawner.introducedIron = true;
      spawner.groups = 2;
      spawner.spawn(35);
      assert.equal(spawner.obstacles[1].sprite.x - spawner.obstacles[0].sprite.x, 55);
      spawner.destroy();
      const rolls = [0.5, 0.5, roll, 0];
      spawner.random = () => rolls.shift();
      spawner.spawn(60);
      separations.push(spawner.obstacles[1].sprite.x - spawner.obstacles[0].sprite.x);
      assert.ok(spawner.wait >= (55 + separations.at(-1)) / sim.worldSpeed(900, 60) + 0.9);
      spawner.destroy();
    }
    assert.ok(separations[0] >= 45 && separations[2] <= 75);
    assert.ok(separations[2] - separations[0] > 29);
  });

  test('Extra lives stack at every 1,000 points, including token score jumps', () => {
    const life = new sim.RunLife();
    assert.equal(life.award(999), false);
    assert.equal(life.lives, 0);
    assert.equal(life.award(1000), true);
    assert.equal(life.lives, 1);
    assert.equal(life.award(1999), false);
    assert.equal(life.award(2000), true);
    assert.equal(life.lives, 2);
    assert.equal(life.award(2000), false);
    assert.equal(life.lives, 2);
    assert.equal(life.nextLifeScore, 3000);
    life.reset();
    assert.equal(life.award(990 + sim.TOKEN_POINTS), true);
    assert.equal(life.award(1990 + sim.TOKEN_POINTS), true);
    assert.equal(life.lives, 2);
  });

  test('Score jumps award all crossed thresholds and replay resets stacked lives', () => {
    const life = new sim.RunLife();
    assert.equal(life.award(3500), true);
    assert.equal(life.lives, 3);
    assert.equal(life.nextLifeScore, 4000);
    assert.equal(life.award(3501), false);
    life.reset();
    assert.equal(life.lives, 0);
    assert.equal(life.nextLifeScore, 1000);
    assert.equal(life.award(1000), true);
    assert.equal(life.lives, 1);
  });

  test('A hit consumes the extra life once; protection ends after three active seconds', () => {
    const life = new sim.RunLife();
    assert.equal(life.hit(), 'dead');
    life.award(1000);
    assert.equal(life.hit(), 'saved');
    assert.equal(life.lives, 0);
    for (let i = 0; i < 3 * 144 - 1; i++) {
      assert.equal(life.hit(), 'protected');
      life.update(sim.STEP);
    }
    assert.equal(life.hit(), 'protected');
    life.update(sim.STEP);
    assert.equal(life.invulnerability, 0);
    assert.equal(life.hit(), 'dead');
    assert.equal(life.award(1000), false, 'A consumed life must not be re-awarded');
    assert.equal(life.award(2000), true, 'The next threshold must award a new life');
    assert.equal(life.lives, 1);
    life.reset();
    assert.equal(life.invulnerability, 0);
    assert.equal(life.lives, 0);
    assert.equal(life.award(1000), true);
  });

  test('Each unprotected hit consumes one stacked life and protected hits consume none', () => {
    const life = new sim.RunLife();
    life.award(1000);
    life.award(2000);
    assert.equal(life.hit(), 'saved');
    assert.equal(life.lives, 1);
    assert.equal(life.hit(), 'protected');
    assert.equal(life.lives, 1);
    life.update(sim.INVULNERABILITY_SECONDS);
    assert.equal(life.hit(), 'saved');
    assert.equal(life.lives, 0);
    life.update(sim.INVULNERABILITY_SECONDS);
    assert.equal(life.hit(), 'dead');
  });

  test('Flashing follows the player through jumps and ducks and resets after protection', () => {
    const player = new Player(fakeApp(), fakeWorld(), null, () => {});
    player.setProtection(2.9);
    assert.equal(player.currSprite.alpha, 0.35);
    player.requestJump(); player.update(sim.STEP, { jump: true, duck: false });
    assert.equal(player.currSprite.alpha, 0.35);
    player.setProtection(2.7);
    assert.equal(player.currSprite.alpha, 1);
    player.setProtection(2.9, true);
    assert.equal(player.currSprite.alpha, 1, 'Reduced motion uses a steady tint');
    assert.equal(player.currSprite.tint, 0xffda68);
    player.reset();
    for (const sprite of player.sprites) { assert.equal(sprite.alpha, 1); assert.equal(sprite.tint, 0xffffff); }
  });

  test('Protected collisions keep all obstacles moving and still allow token collection', () => {
    const world = fakeWorld();
    const life = new sim.RunLife(); life.award(1000);
    let saved = 0, collected = 0;
    const spawner = new Spawner(fakeApp(), world, { bounds: { x: 0, y: 0, width: 40, height: 40 } }, () => {
      const hit = life.hit();
      if (hit === 'saved') saved++;
      return hit !== 'dead';
    }, () => { collected++; }, () => {}, () => 0.5);
    spawner.obstacle('washerSprite', 25, 40);
    spawner.obstacle('washerSprite', 25, 40);
    spawner.token(20, 20);
    assert.equal(spawner.update(sim.STEP, 1), true);
    assert.equal(saved, 1);
    assert.equal(collected, 1);
    assert.ok(spawner.obstacles.every(item => item.sprite.x < 25));
  });

  test('Collision includes actual overlap and excludes touching edges', () => {
    const a = { x: 0, y: 0, width: 20, height: 20 };
    assert.equal(sim.overlaps(a, { ...a, x: 19 }), true);
    assert.equal(sim.overlaps(a, { ...a, x: 20 }), false);
    assert.equal(sim.overlaps(a, { ...a, y: 21 }), false);
  });

  test('All ground groups have a clearable held jump on desktop and portrait', () => {
    for (const width of [427.5, 900]) for (const seconds of [0, 30, 60, 90, 120, 180, 240, 300, 36000]) {
      const speed = sim.worldSpeed(width, seconds);
      for (const separation of [0, 45, 55, 75]) {
        const double = separation > 0;
        let possible = false;
        // Search timing windows before the first obstacle reaches the player.
        for (let delay = 0; delay < 1 && !possible; delay += sim.STEP) {
          const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: 0 };
          let hit = false, triggered = false;
          for (let t = 0; t < 2; t += sim.STEP) {
            if (!triggered && t >= delay) { body.buffer = sim.JUMP_BUFFER; triggered = true; }
            sim.advanceJump(body, { jump: true, duck: false }, sim.STEP);
            const playerBounds = { x: -69, y: body.y - 60, width: 63, height: 57 };
            const x = 230 - speed * t;
            hit ||= sim.overlaps(playerBounds, { x: x - 22.5, y: 202.5 - 60, width: 45, height: 58 });
            if (double) hit ||= sim.overlaps(playerBounds, { x: x + separation - 21.5, y: 202.5 - 38, width: 43, height: 36 });
          }
          possible = !hit;
        }
        assert.ok(possible, `No timing window: width ${width}, seconds ${seconds}, separation ${separation}`);
      }
    }
  });

  test('Minimum gaps allow consecutive ground groups, including level speed changes', () => {
    for (const width of [427.5, 900]) for (const boundary of [30, 60, 90, 120, 180, 240, 300]) {
      for (const startTime of [boundary, boundary - 0.15]) for (const firstDouble of [false, true]) {
        const gap = sim.nextGap(startTime, firstDouble ? 130 : 55, sim.worldSpeed(width, startTime), () => 0);
        let safeWindows = 0;
        for (let delay = 0; delay < 1; delay += sim.STEP) {
          const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: 0 };
          let firstX = 230, secondX = 230, jumped = false, jumpedAgain = false, hit = false;
          for (let t = 0; t < gap + 2 && !hit; t += sim.STEP) {
            if (!jumped && t >= delay) { body.buffer = sim.JUMP_BUFFER; jumped = true; }
            if (!jumpedAgain && t >= gap + delay) { body.buffer = sim.JUMP_BUFFER; jumpedAgain = true; }
            sim.advanceJump(body, { jump: true, duck: false }, sim.STEP);
            const movement = sim.worldSpeed(width, startTime + t) * sim.STEP;
            firstX -= movement;
            if (t >= gap) secondX -= movement;
            const playerBounds = { x: -69, y: body.y - 60, width: 63, height: 57 };
            const collides = (x, double) => sim.overlaps(playerBounds,
              { x: x - 22.5, y: 142.5, width: 45, height: 58 }) || (double && sim.overlaps(playerBounds,
              { x: x + 75 - 21.5, y: 164.5, width: 43, height: 36 }));
            hit = collides(firstX, firstDouble) || (t >= gap && collides(secondX, true));
          }
          safeWindows += Number(!hit);
        }
        assert.ok(safeWindows >= 6, `Consecutive groups need a usable timing window: width ${width}, time ${startTime}, double ${firstDouble}`);
      }
    }
  });

  test('The introductory laundry obstacle can be cleared with a short tap in portrait', () => {
    for (const width of [427.5, 900]) {
      const speed = sim.worldSpeed(width, 1.5);
      let safeWindows = 0;
      for (let delay = 0; delay < 1; delay += sim.STEP) {
        const body = { y: 202.5, ground: 202.5, velocity: 0, buffer: 0 };
        let hit = false, triggered = false;
        for (let time = 0; time < 2; time += sim.STEP) {
          if (!triggered && time >= delay) { body.buffer = sim.JUMP_BUFFER; triggered = true; }
          sim.advanceJump(body, { jump: false, duck: false }, sim.STEP);
          hit ||= sim.overlaps({ x: -69, y: body.y - 60, width: 63, height: 57 },
            { x: 230 - speed * time - 21.5, y: 164.5, width: 43, height: 36 });
        }
        safeWindows += Number(!hit);
      }
      assert.ok(safeWindows >= 6, `The first short jump needs a forgiving timing window at width ${width}`);
    }
  });

  test('The first two obstacles teach short and held jumps, followed by ducking', () => {
    const world = fakeWorld();
    const names = [], hints = [];
    const spawner = new Spawner(fakeApp(), world, {}, () => {}, () => {}, hint => hints.push(hint), () => 0.5);
    spawner.obstacle = name => names.push(name);
    spawner.spawn(1.5); spawner.spawn(5); spawner.spawn(20); spawner.spawn(35);
    assert.deepEqual(names, ['laundrySprite', 'washerSprite', 'ironSprite', 'washerSprite', 'laundrySprite']);
    assert.equal(hints.length, 3);
    assert.ok(spawner.wait >= 0.85);
  });

  test('Flying Vs are occasional, teach ducking, and leave room behind the entire formation', () => {
    const world = fakeWorld(), hints = [];
    const spawner = new Spawner(fakeApp(), world, {}, () => {}, () => {}, hint => hints.push(hint), () => 0.05);
    spawner.spawn(20); spawner.spawn(35);
    spawner.destroy();
    spawner.spawn(44);
    assert.equal(spawner.obstacles.length, 1, 'Formations do not appear before 45 seconds');
    spawner.destroy();
    spawner.spawn(45);
    assert.equal(spawner.obstacles.length, 3);
    const [lead, upper, lower] = spawner.obstacles.map(item => item.sprite);
    assert.ok(lead.x < upper.x, 'The leader is ahead in the direction of flight');
    assert.equal(upper.x, lower.x, 'Two wings trail the leader');
    assert.ok(upper.y < lead.y && lead.y < lower.y, 'Trailing wings sit above and below the leader');
    assert.equal(new Set(spawner.obstacles.map(item => item.height)).size, 1);
    assert.ok(hints.at(-1).includes('Flying V'));
    assert.ok(spawner.wait >= 108 / sim.worldSpeed(world.width, 45) + 0.9);
    assert.equal(spawner.tokens.length, 1);
    assert.equal(spawner.tokens[0].sprite.y, world.ground - 22, 'Formation tokens stay on the duck path');
    spawner.destroy();
    for (let i = 0; i < 2; i++) {
      spawner.spawn(60);
      assert.equal(spawner.obstacles.length, 1, 'Two ordinary groups separate formations');
      spawner.destroy();
    }
    spawner.spawn(60);
    assert.equal(spawner.obstacles.length, 3);
    assert.equal(hints.filter(hint => hint.includes('Flying V')).length, 1);
    spawner.destroy();
    assert.equal(world.children.size, 0);
    assert.equal(new Spawner(fakeApp(), world, {}, () => {}, () => {}, () => {}).introducedFormation, false);
  });

  test('Flying Vs clear ducking players but block walking and every short or held jump timing', () => {
    for (const width of [427.5, 900]) for (const seconds of [45, 60, 120, 240, 36000]) {
      const world = fakeWorld(width), player = new Player(fakeApp(), world, null, () => {});
      const spawner = new Spawner(fakeApp(), world, player, () => {}, () => {}, () => {}, () => 0.05);
      spawner.introducedIron = spawner.introducedDouble = true;
      spawner.spawn(seconds);
      const speed = sim.worldSpeed(width, seconds);
      const duration = (width + 55 + 44 + 32 - (player.x - 69)) / speed + sim.STEP;
      const hits = (t, bounds) => spawner.obstacles.some(item => sim.overlaps(bounds,
        { ...spawner.bounds(item), x: spawner.bounds(item).x - speed * t }));
      player.update(sim.STEP, { jump: false, duck: true });
      for (let t = 0; t <= duration; t += sim.STEP) assert.equal(hits(t, player.bounds), false);
      player.reset();
      assert.ok(Array.from({ length: Math.ceil(duration / sim.STEP) }, (_, i) => hits(i * sim.STEP, player.bounds)).some(Boolean));
      for (const hold of [0, 0.1, 0.25, Infinity]) for (let delay = 0; delay < duration; delay += sim.STEP) {
        player.reset();
        let hit = false, triggered = false;
        for (let t = 0; t <= duration && !hit; t += sim.STEP) {
          if (!triggered && t >= delay) { player.requestJump(); triggered = true; }
          player.update(sim.STEP, { jump: triggered && t - delay < hold, duck: false });
          hit = hits(t, player.bounds);
        }
        assert.ok(hit, `Jump bypasses V: width ${width}, time ${seconds}, delay ${delay}, hold ${hold}`);
      }
      spawner.destroy();
    }
  });

  test('Minimum gaps allow switching between jumping ground loads and ducking formations', () => {
    for (const width of [427.5, 900]) for (const seconds of [45, 59.85, 119.85, 239.85, 36000]) {
      for (const firstFormation of [false, true]) {
        const world = fakeWorld(width), player = new Player(fakeApp(), world, null, () => {});
        const spawner = new Spawner(fakeApp(), world, player, () => {}, () => {}, () => {}, () => 0.5);
        spawner.introducedIron = spawner.introducedDouble = true;
        spawner.groups = 2;
        const buildGroup = formation => {
          spawner.random = () => formation ? 0.05 : 0.5;
          spawner.spawn(seconds);
          const bounds = spawner.obstacles.map(item => ({ ...spawner.bounds(item),
            x: spawner.bounds(item).x - (width + 55) + player.x + 230 }));
          spawner.destroy();
          return bounds;
        };
        const first = buildGroup(firstFormation), second = buildGroup(!firstFormation);
        const gap = sim.nextGap(seconds, firstFormation ? 108 : 130, sim.worldSpeed(width, seconds), () => 0);
        let safeWindows = 0;
        for (let delay = 0; delay < 1; delay += sim.STEP) {
          player.reset();
          let firstMotion = 0, secondMotion = 0, triggered = false, leftGround = false, hit = false;
          for (let t = 0; t < gap + 3 && !hit; t += sim.STEP) {
            if (!triggered && t >= delay + (firstFormation ? gap : 0)) { player.requestJump(); triggered = true; }
            const duck = firstFormation ? !triggered : leftGround && player.body.y === world.ground;
            player.update(sim.STEP, { jump: true, duck });
            leftGround ||= player.body.y < world.ground;
            const movement = sim.worldSpeed(width, seconds + t) * sim.STEP;
            firstMotion += movement;
            if (t >= gap) secondMotion += movement;
            hit = first.some(bounds => sim.overlaps(player.bounds, { ...bounds, x: bounds.x - firstMotion })) ||
              (t >= gap && second.some(bounds => sim.overlaps(player.bounds, { ...bounds, x: bounds.x - secondMotion })));
          }
          safeWindows += Number(!hit);
        }
        assert.ok(safeWindows >= 6, `No usable jump/duck transition: width ${width}, time ${seconds}, formation first ${firstFormation}`);
      }
    }
  });

  test('Ten-minute runs keep spawning tokens and houses; cleanup removes all sprites', () => {
    const world = fakeWorld();
    const spawner = new Spawner(fakeApp(), world, { bounds: { x: -10000, y: 0, width: 1, height: 1 } }, () => { throw new Error('Unexpected death'); }, () => {}, () => {}, () => 0.55);
    const houses = new HouseGen(fakeApp(), world, () => 0.5);
    let generatedTokens = 0;
    const buildToken = spawner.token.bind(spawner);
    spawner.token = (...args) => { generatedTokens++; buildToken(...args); };
    for (let i = 0; i < 600 * 144; i++) {
      spawner.update(sim.STEP, i * sim.STEP);
      houses.update(sim.STEP, i * sim.STEP);
    }
    assert.ok(generatedTokens > 15);
    assert.ok(spawner.groups > 200);
    assert.ok(houses.houses.length > 0);
    spawner.destroy(); houses.destroy();
    assert.equal(world.children.size, 0);
  });

  test('One collision ends the frame immediately, preventing repeated death callbacks', () => {
    const world = fakeWorld();
    let deaths = 0;
    const spawner = new Spawner(fakeApp(), world, { bounds: { x: 0, y: 0, width: 40, height: 40 } }, () => { deaths++; }, () => {}, () => {}, () => 0.5);
    spawner.obstacle('washerSprite', 25, 40);
    spawner.obstacle('washerSprite', 25, 40);
    assert.equal(spawner.update(sim.STEP, 1), false);
    assert.equal(deaths, 1);
  });

  test('All overlapping tokens can be collected in one frame without skipping entries', () => {
    const world = fakeWorld();
    let collected = 0;
    const spawner = new Spawner(fakeApp(), world, { bounds: { x: 0, y: 0, width: 40, height: 40 } }, () => {}, () => { collected++; }, () => {}, () => 0.5);
    spawner.token(20, 20); spawner.token(20, 20);
    spawner.update(sim.STEP, 1);
    assert.equal(collected, 2); assert.equal(spawner.tokens.length, 0);
  });

  test('Player reset restores position, collision bounds, and jump state after death', () => {
    const world = fakeWorld();
    const player = new Player(fakeApp(), world, null, () => {});
    player.requestJump(); player.update(sim.STEP, { jump: true, duck: false }); player.die(); player.reset();
    assert.equal(player.body.y, world.ground);
    assert.equal(player.body.velocity, 0); assert.equal(player.body.buffer, 0);
    assert.equal(player.currSprite, player.running);
    assert.ok(player.bounds.width > 0 && player.bounds.height > 0);
  });

  test('Leaderboard recovers corrupt data, sorts legacy entries, and rejects invalid names', () => {
    storage = new Map([['leaderboard', 'broken JSON']]);
    assert.deepEqual(new Leaderboard('board').scores, []);
    storage = new Map([['leaderboard', JSON.stringify([{ name: 'A', score: 9 }, { name: 'BAD<script>', score: 999 }, { name: 'ABC', score: 1500 }])]]);
    const board = new Leaderboard('board');
    assert.deepEqual(board.scores.map(entry => entry.score), [1500, 9]);
    assert.equal(board.best, 1500);
    assert.equal(board.isHighScore(0), false);
    assert.equal(board.recordBest(2000), true);
    assert.equal(storage.get('hamperman-best'), '2000');
  });

  test('One-letter and lowercase initials save correctly; replay remains available', () => {
    storage = new Map(); elements.clear();
    const board = new Leaderboard('leaderboard-container');
    board.showNameEntry(100);
    document.getElementById('name-input').value = 'a';
    document.getElementById('name-entry-form').onsubmit({ preventDefault() {} });
    assert.deepEqual(board.scores, [{ name: 'A', score: 100 }]);
    assert.equal(document.getElementById('name-entry-form').hidden, true);
    assert.equal(new Leaderboard('leaderboard-container').initials, 'A');
    board.showNameEntry(200);
    document.getElementById('skip-score').onclick();
    assert.equal(document.getElementById('name-entry-form').hidden, true);
    assert.equal(board.scores.length, 1);
    assert.equal(document.getElementById('replay-button').focused, true);
  });

  test('Blocked browser storage does not stop gameplay or score entry', () => {
    global.localStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
    const board = new Leaderboard('board');
    assert.equal(board.recordBest(42), true);
    assert.equal(board.addScore('AB', 42), false);
    assert.equal(board.scores.length, 1);
  });
  // Exercise the actual game entry point with a fake renderer and browser surface.
  // This verifies lifecycle wiring while the simulation tests above cover physics.
  class GameElement {
    constructor(id = '') {
      Object.assign(this, element());
      this.id = id; this.listeners = {}; this.style = {}; this.attributes = {};
      this.clientWidth = 1000; this.clientHeight = 250;
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    setPointerCapture() {}
    closest() { return null; }
    getBoundingClientRect() { return { top: 0, width: 1000, height: 250 }; }
  }
  global.Element = GameElement;
  elements.clear(); storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const documentListeners = {}, windowListeners = {};
  global.document = {
    hidden: false,
    getElementById(id) { if (!elements.has(id)) elements.set(id, new GameElement(id)); return elements.get(id); },
    createElement: () => new GameElement(),
    querySelectorAll: () => ['loading', 'start', 'pause', 'end'].map(name => document.getElementById(`${name}-panel`)),
    querySelector: () => document.getElementById('share-details'),
    addEventListener(name, callback) { documentListeners[name] = callback; },
  };
  global.window = {
    devicePixelRatio: 1, location: { href: 'http://localhost:8080/', reload() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener(name, callback) { windowListeners[name] = callback; },
  };
  global.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() {} };
  global.fetch = async () => ({ ok: true, text: async () => 'That was a wash!' });
  class Container extends Sprite {
    constructor() { super(); this.children = []; }
    addChild(...items) { this.children.push(...items); }
    removeChild(item) { this.children = this.children.filter(child => child !== item); }
  }
  class TilingSprite extends Sprite { constructor(texture, width, height) { super(); Object.assign(this, { texture, width, height, tilePosition: { x: 0 }, tileScale: { set() {} } }); } }
  class Graphics extends Sprite { beginFill() { return this; } drawEllipse() { return this; } endFill() { return this; } }
  let gameApp;
  const sounds = [];
  class Application {
    constructor() {
      gameApp = this;
      this.stage = new Container(); this.renderer = { resize() {} };
      const resources = {};
      this.loader = {
        resources, onError: { add() {} },
        add(name) {
          resources[name] = { url: name, texture: { width: 192 }, spritesheet: fakeApp().loader.resources.charaSheet.spritesheet };
          if (name.endsWith('Sound')) {
            const sound = { playCount: 0, play() { this.playCount++; } };
            resources[name].sound = sound; sounds.push(sound);
          }
          return this;
        },
        load(callback) { this.loaded = () => callback(this, resources); },
      };
      this.ticker = { elapsedMS: 1000 / 60, add(callback) { this.tick = callback; } };
    }
  }
  global.PIXI = { Sprite, AnimatedSprite, Application, Container, TilingSprite, Graphics, Text: Sprite,
    settings: {}, SCALE_MODES: { NEAREST: 0 }, sound: { context: { audioContext: { state: 'running' } }, Sound: { from() { throw new Error('Loaded audio must be reused'); } } } };
  await import(moduleURL('js/game.js'));
  gameApp.loader.loaded();

  test('Game starts immediately, plays loaded audio, pauses every clock, and replays', () => {
    const get = id => document.getElementById(id);
    assert.equal(get('start-panel').hidden, false);
    get('start-button').onclick();
    assert.equal(get('game-overlay').hidden, true);
    windowListeners.keydown({ code: 'Space', target: get('pixiCanvas'), repeat: false, preventDefault() {} });
    gameApp.ticker.tick();
    assert.ok(sounds[1].playCount > 0, 'Jump must use the preloaded sound');
    get('pause-button').onclick();
    assert.equal(get('pause-panel').hidden, false);
    const before = get('milestone-progress').value;
    const scoreBefore = get('score-value').textContent;
    for (let i = 0; i < 120; i++) gameApp.ticker.tick();
    assert.equal(get('milestone-progress').value, before, 'Run clock advances while paused');
    assert.equal(get('score-value').textContent, scoreBefore, 'Score must freeze while paused');
    get('resume-button').onclick();
    assert.equal(get('game-overlay').hidden, true);
    // Let the first obstacle collide, then restart without saving initials.
    for (let i = 0; i < 300; i++) gameApp.ticker.tick();
    assert.equal(get('end-panel').hidden, false);
    assert.equal(get('name-entry-form').hidden, false);
    get('replay-button').onclick();
    assert.equal(get('score-value').textContent, '0');
    assert.equal(get('name-entry-form').hidden, true);
    assert.equal(get('game-overlay').hidden, true);
    document.hidden = true; documentListeners.visibilitychange();
    assert.equal(get('pause-panel').hidden, false);
    get('resume-button').onclick();
    assert.equal(get('pause-panel').hidden, false, 'Hidden tabs must stay paused');
    document.hidden = false; get('resume-button').onclick();
    assert.equal(get('game-overlay').hidden, true);
  });

  test('Game lifecycle continues past five minutes with scores above 999', () => {
    const original = Object.getOwnPropertyDescriptor(Player.prototype, 'bounds');
    Object.defineProperty(Player.prototype, 'bounds', { configurable: true, get: () => ({ x: -10000, y: 0, width: 1, height: 1 }) });
    for (let i = 0; i < 60 * 600; i++) gameApp.ticker.tick();
    assert.equal(document.getElementById('game-overlay').hidden, true);
    // Independently total each 30-second level; viewport size must not affect rewards.
    const expectedScore = Array.from({ length: 20 }, (_, level) => 30 * sim.SCORE_RATE * Math.min(2.6, Math.pow(1.14, level)))
      .reduce((sum, points) => sum + points, 0);
    const displayedScore = Number(document.getElementById('score-value').textContent.replace(/,/g, ''));
    assert.ok(Math.abs(displayedScore - expectedScore) < 1, 'Time-based score must scale with movement speed');
    assert.equal(document.getElementById('milestone-label').textContent, 'LEVEL 21');
    Object.defineProperty(Player.prototype, 'bounds', original);
  });
  test('The HUD shows two unused lives at 2,000 points', () => {
    const get = id => document.getElementById(id);
    const original = Object.getOwnPropertyDescriptor(Player.prototype, 'bounds');
    Object.defineProperty(Player.prototype, 'bounds', { configurable: true, get: () => ({ x: -10000, y: 0, width: 1, height: 1 }) });
    try {
      get('replay-button').onclick();
      assert.equal(get('score-value').textContent, '0');
      for (let i = 0; i < 60 * 600 && Number(get('score-value').textContent.replace(/,/g, '')) < 2000; i++) gameApp.ticker.tick();
      assert.equal(get('score-value').textContent, '2,000');
      assert.equal(get('life-value').textContent, '2');
      assert.equal(get('life-status').textContent, 'Ready');
      assert.equal(get('game-overlay').hidden, true);
    } finally { Object.defineProperty(Player.prototype, 'bounds', original); }
  });

  test('Stacked lives survive separate hits, freeze protection on pause, and reset on replay', () => {
    const get = id => document.getElementById(id);
    assert.equal(get('life-value').textContent, '2');
    const original = Object.getOwnPropertyDescriptor(Player.prototype, 'bounds');
    Object.defineProperty(Player.prototype, 'bounds', { configurable: true, get: () => ({ x: -10000, y: -10000, width: 20000, height: 20000 }) });
    try {
      // The score threshold can fall between groups; wait for an actual obstacle.
      for (let i = 0; i < 60 * 3 && get('life-value').textContent === '2'; i++) gameApp.ticker.tick();
      assert.equal(get('game-overlay').hidden, true);
      assert.equal(get('life-value').textContent, '1');
      assert.equal(get('life-status').textContent, 'Safe · 3s');
      for (let i = 0; i < 60; i++) gameApp.ticker.tick();
      assert.equal(get('game-overlay').hidden, true, 'Further hits should be ignored');
      get('pause-button').onclick();
      const protection = get('life-status').textContent;
      for (let i = 0; i < 240; i++) gameApp.ticker.tick();
      assert.equal(get('life-status').textContent, protection);
      get('resume-button').onclick();
      for (let i = 0; i < 240; i++) gameApp.ticker.tick();
      assert.equal(get('game-overlay').hidden, true, 'The second saved life should keep the run going');
      assert.equal(get('life-value').textContent, '0');
      for (let i = 0; i < 240; i++) gameApp.ticker.tick();
      assert.equal(get('end-panel').hidden, false, 'A hit after both lives and protection are used should end the run');
      get('replay-button').onclick();
      assert.equal(get('life-value').textContent, '0');
      assert.equal(get('life-status').textContent, 'At 1,000');
    } finally { Object.defineProperty(Player.prototype, 'bounds', original); }
  });
  const share = await import(moduleURL('api/_share.mjs'));
  test('Shared score links get preview tags for that score', () => {
    assert.equal(share.parseScore('1234'), 1234);
    assert.equal(share.parseScore('-5'), 0);
    assert.equal(share.parseScore('"><script>'), 0);
    const html = share.shareMeta(fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8'), 12345);
    assert.match(html, /property="og:title" content="I scored 12,345 in Hamperman!"/);
    assert.match(html, /property="og:image" content="https:\/\/hamperman\.laundr\.io\/api\/og\?score=12345"/);
    assert.match(html, /property="og:url" content="https:\/\/laundr\.io\/hamperman\/score\/12345"/);
    assert.match(html, /property="og:image:width" content="1200"/);
  });
  test('Gameplay changes invalidate the entry script and every imported module URL', () => {
    const versionModules = require('../scripts/version-modules.cjs');
    const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'hamperman-modules-'));
    const sourceRoot = path.join(temp, 'source'), output = path.join(temp, 'output');
    fs.mkdirSync(path.join(output, 'js'), { recursive: true });
    fs.cpSync(path.resolve(__dirname, '..', 'js'), path.join(sourceRoot, 'js'), { recursive: true });
    try {
      const entry = versionModules(sourceRoot, output);
      assert.match(entry, /^js\/game\.[a-f0-9]{12}\.js$/);
      assert.equal(versionModules(sourceRoot, output), entry, 'Unchanged builds use stable URLs');
      const importedSimulation = new Set();
      for (const file of fs.readdirSync(path.join(output, 'js'))) {
        const source = fs.readFileSync(path.join(output, 'js', file), 'utf8');
        for (const [, relative] of source.matchAll(/\bfrom\s+['"](\.\/[^'"]+)['"]/g)) {
          assert.match(relative, /\.[a-f0-9]{12}\.js$/);
          assert.ok(fs.existsSync(path.resolve(output, 'js', relative)), 'All versioned imports resolve');
          if (relative.startsWith('./simulation.')) importedSimulation.add(relative);
        }
      }
      assert.equal(importedSimulation.size, 1, 'Every module shares one simulation instance');
      const previousSimulation = [...importedSimulation][0];
      fs.appendFileSync(path.join(sourceRoot, 'js', 'simulation.js'), '\n// Gameplay update\n');
      const updatedEntry = versionModules(sourceRoot, output);
      assert.notEqual(updatedEntry, entry, 'A dependency change invalidates the entry URL');
      assert.ok(!fs.readFileSync(path.join(output, updatedEntry), 'utf8').includes(previousSimulation));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
  console.log(`\n${passed} tests passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
