import assert from 'node:assert/strict';
import test from 'node:test';
import { World } from '../dist/index.js';
import { ComponentPool } from '../dist/ecs/Component.js';
import { EntityManager } from '../dist/ecs/Entity.js';

class Position { constructor(x = 0) { this.x = x; } }
class Health { constructor(hp = 10) { this.hp = hp; } }
class Velocity {}
class Sleeping {}
class Frozen {}

function matching(world, first = Position, second = Position) {
  const result = [];
  world.each([first, second], (id, a, b) => result.push([id, a, b]));
  return result;
}

test('destroy removes every component and excludes the entity from queries', () => {
  const world = new World();
  const id = world.create();
  world.add(id, new Position());
  world.add(id, new Health());
  world.destroy(id);
  assert.equal(world.get(id, Position), undefined);
  assert.equal(world.get(id, Health), undefined);
  assert.deepEqual(matching(world, Position, Health), []);
});

test('recycled IDs start empty and can be added, queried, and destroyed again', () => {
  const world = new World();
  for (let cycle = 0; cycle < 20; cycle++) {
    const id = world.create();
    assert.equal(world.get(id, Position), undefined);
    const position = new Position(cycle);
    world.add(id, position);
    assert.deepEqual(matching(world), [[id, position, position]]);
    world.destroy(id);
    assert.equal(world.get(id, Position), undefined);
    assert.deepEqual(matching(world), []);
  }
});

test('double destruction cannot allocate the same live ID twice', () => {
  const world = new World();
  const id = world.create();
  world.destroy(id);
  world.destroy(id);
  const ids = Array.from({ length: 10 }, () => world.create());
  assert.equal(new Set(ids).size, ids.length);
});

test('isAlive rejects a foreign handle whose slot exists locally', () => {
  const world = new World();
  const own = world.create();
  const foreign = new World().create();
  assert.equal(foreign.slot, own.slot);
  assert.equal(world.isAlive(own), true);
  assert.equal(world.isAlive(foreign), false);
});

test('isAlive rejects a foreign handle whose slot does not exist locally', () => {
  const world = new World();
  const foreign = new World().create();
  assert.equal(world.isAlive(foreign), false);
});

test('destroying foreign or forged handles does not corrupt allocation', () => {
  const world = new World();
  const own = world.create();
  world.add(own, new Position());
  const foreign = new World().create();
  world.destroy(foreign);
  world.destroy({ slot: 0, generation: 0 });
  world.destroy(5);
  assert.ok(world.get(own, Position));
  const ids = Array.from({ length: 10 }, () => world.create());
  assert.equal(new Set([own, ...ids].map(id => id.slot)).size, ids.length + 1);
});

test('stale handles never alias the entity recycled into their slot', () => {
  const world = new World();
  const stale = world.create();
  world.add(stale, new Position(1));
  world.destroy(stale);
  const fresh = world.create();
  assert.equal(fresh.slot, stale.slot);
  assert.notEqual(fresh.generation, stale.generation);
  const position = new Position(2);
  world.add(fresh, position);
  assert.equal(world.get(stale, Position), undefined);
  assert.equal(world.get(fresh, Position), position);
  world.destroy(stale);
  assert.equal(world.get(fresh, Position), position);
});

test('adding to a destroyed handle throws and leaves no orphan component', () => {
  const world = new World();
  const stale = world.create();
  world.destroy(stale);
  assert.throws(() => world.add(stale, new Position()), /not alive/);
  assert.equal(world.get(stale, Position), undefined);
  const fresh = world.create();
  assert.equal(fresh.slot, stale.slot);
  const position = new Position(3);
  world.add(fresh, position);
  assert.deepEqual(matching(world), [[fresh, position, position]]);
});

test('adding to a stale handle does not disturb the recycled entity', () => {
  const world = new World();
  const stale = world.create();
  world.destroy(stale);
  const fresh = world.create();
  const position = new Position(1);
  world.add(fresh, position);
  assert.throws(() => world.add(stale, new Position(2)), /not alive/);
  assert.equal(world.get(fresh, Position), position);
  assert.deepEqual(matching(world), [[fresh, position, position]]);
});

test('add rechecks liveness after a component constructor getter recycles the slot', () => {
  const world = new World();
  const stale = world.create();
  let fresh;
  const component = {
    get constructor() {
      world.destroy(stale);
      fresh = world.create();
      return Position;
    },
  };

  assert.throws(() => world.add(stale, component), /not alive/);
  assert.equal(fresh?.slot, stale.slot);
  assert.deepEqual(matching(world), []);
  const position = new Position();
  world.add(fresh, position);
  assert.deepEqual(matching(world), [[fresh, position, position]]);
});

test('adding to foreign or forged handles throws', () => {
  const world = new World();
  const own = world.create();
  const foreign = new World().create();
  assert.throws(() => world.add(foreign, new Position()), /not alive/);
  assert.throws(() => world.add({ slot: own.slot, generation: own.generation }, new Position()), /not alive/);
  assert.throws(() => world.add(0, new Position()), /not alive/);
  assert.equal(world.get(own, Position), undefined);
  assert.deepEqual(matching(world), []);
});

test('destroying a stale handle during iteration is still rejected by the guard', () => {
  const world = new World();
  const stale = world.create();
  world.destroy(stale);
  const id = world.create();
  world.add(id, new Position());
  world.each([Position, Position], () => {
    assert.throws(() => world.destroy(stale), /iteration is in progress/);
  });
});

test('duplicate additions replace the component without duplicating query rows', () => {
  const world = new World();
  const id = world.create();
  world.add(id, new Position(1));
  const replacement = new Position(2);
  world.add(id, replacement);
  assert.equal(world.get(id, Position), replacement);
  assert.deepEqual(matching(world), [[id, replacement, replacement]]);
});

test('get returns undefined for missing components in empty and populated pools', () => {
  const world = new World();
  const id = world.create();
  assert.equal(world.get(id, Position), undefined);
  world.add(world.create(), new Position());
  assert.equal(world.get(id, Position), undefined);
});

for (const extra of [Position, Health, null]) {
  test(`query preserves argument order with ${extra?.name ?? 'neither'} pool larger`, () => {
    const world = new World();
    const id = world.create();
    const position = new Position();
    const health = new Health();
    world.add(id, position);
    world.add(id, health);
    if (extra) world.add(world.create(), new extra());
    assert.deepEqual(matching(world, Position, Health), [[id, position, health]]);
  });
}

test('array queries support one or more required components and exclude any listed type', () => {
  const world = new World();
  const awake = world.create();
  const asleep = world.create();
  const stationary = world.create();
  const position = new Position();
  const velocity = new Velocity();
  const health = new Health();
  world.add(awake, position);
  world.add(awake, velocity);
  world.add(awake, health);
  world.add(asleep, new Position());
  world.add(asleep, new Velocity());
  world.add(asleep, new Health());
  world.add(asleep, new Sleeping());
  world.add(stationary, new Position());
  const positioned = [];
  world.each([Position], (id) => positioned.push(id));
  assert.deepEqual(positioned, [awake, asleep, stationary]);

  const moving = [];
  world.each([Health, Position, Velocity], (id, hp, pos, speed) => {
    moving.push([id, hp, pos, speed]);
  }, { without: [Frozen, Sleeping] });
  assert.deepEqual(moving, [[awake, health, position, velocity]]);

  world.each([Position, Frozen], () => assert.fail('required component is missing'));
  assert.equal(world.pools.has(Frozen), false);
});

test('queries skip candidates that are missing any required component', () => {
  const world = new World();
  const [complete] = [
    [Position, Velocity, Health],
    [Position, Velocity],
    [Position, Health],
    [Velocity, Health],
  ].map(types => {
    const id = world.create();
    for (const Type of types) world.add(id, new Type());
    return id;
  });

  const matches = [];
  world.each([Position, Velocity, Health], id => matches.push(id));
  assert.deepEqual(matches, [complete]);
});

test('each excluded type blocks a match and later queries see membership changes', () => {
  const world = new World();
  const [awake, asleep, frozen] = Array.from({ length: 3 }, () => {
    const id = world.create();
    world.add(id, new Position());
    return id;
  });
  const sleeping = new Sleeping();
  world.add(asleep, sleeping);
  world.add(frozen, new Frozen());

  const options = { without: [Sleeping, Frozen] };
  const matches = () => {
    const ids = [];
    world.each([Position], id => ids.push(id), options);
    return ids;
  };

  assert.deepEqual(matches(), [awake]);
  world.remove(asleep, sleeping);
  world.add(awake, new Sleeping());
  assert.deepEqual(matches(), [asleep]);
});

test('missing and empty required pools both release the iteration guard', () => {
  const world = new World();
  const id = world.create();
  const position = new Position();
  const health = new Health();
  world.add(id, position);

  assert.deepEqual(matching(world, Position, Health), []);
  world.add(id, health);
  assert.deepEqual(matching(world, Position, Health), [[id, position, health]]);

  world.remove(id, health);
  assert.deepEqual(matching(world, Position, Health), []);
  world.add(id, health);
  assert.deepEqual(matching(world, Position, Health), [[id, position, health]]);
});

function makePool(count) {
  const manager = new EntityManager();
  const pool = new ComponentPool();
  const handles = Array.from({ length: count }, () => manager.create());
  return { manager, pool, handles };
}

test('removing a component clears membership and allows re-addition', () => {
  const { pool, handles: [e] } = makePool(1);
  pool.add(e, new Position());
  pool.remove(e);
  assert.equal(pool.has(e), false);
  assert.equal(pool.get(e), undefined);
  assert.equal(pool.sparse[e.slot], undefined);
  pool.add(e, new Position(2));
  assert.equal(pool.has(e), true);
  assert.equal(pool.get(e).x, 2);
  assert.deepEqual(pool.entities, [e]);
});

test('single-entity churn releases component slots and object references', () => {
  const { pool, handles: [e] } = makePool(1);
  for (let i = 0; i < 10000; i++) {
    pool.add(e, new Position(i));
    pool.remove(e);
    assert.equal(pool.components.length, 0);
    assert.equal(pool.entities.length, 0);
  }
});

test('adding to an existing handle replaces in place without growing storage', () => {
  const { pool, handles: [a, b] } = makePool(2);
  pool.add(a, new Position(1));
  pool.add(b, new Position(2));
  const replacement = new Position(3);
  pool.add(a, replacement);
  assert.equal(pool.get(a), replacement);
  assert.deepEqual(pool.entities, [a, b]);
  assert.equal(pool.components.length, 2);
});

test('adding a different handle on an occupied slot throws before modifying storage', () => {
  const { manager, pool, handles: [stale] } = makePool(1);
  const original = new Position(1);
  pool.add(stale, original);
  manager.destroy(stale);
  const fresh = manager.create();
  assert.equal(fresh.slot, stale.slot);
  assert.throws(() => pool.add(fresh, new Position(2)), /different entity/);
  assert.deepEqual(pool.entities, [stale]);
  assert.deepEqual(pool.components, [original]);
  assert.equal(pool.sparse[stale.slot], 0);
  assert.equal(pool.has(fresh), false);
  assert.equal(pool.get(stale), original);
});

test('removing with a stale handle leaves the live entry untouched', () => {
  const { manager, pool, handles: [stale] } = makePool(1);
  const fresh = (manager.destroy(stale), manager.create());
  const position = new Position();
  pool.add(fresh, position);
  pool.remove(stale);
  assert.equal(pool.get(fresh), position);
  assert.deepEqual(pool.entities, [fresh]);
});

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`removal order ${order} preserves survivors and compact storage`, () => {
    const { pool, handles } = makePool(3);
    const expected = new Map(handles.map((h, i) => [i, new Position(i)]));
    handles.forEach((h, i) => pool.add(h, expected.get(i)));
    for (const index of order) {
      pool.remove(handles[index]);
      expected.delete(index);
      assert.equal(pool.has(handles[index]), false);
      assert.equal(pool.get(handles[index]), undefined);
      assert.equal(pool.sparse[handles[index].slot], undefined);
      assert.equal(pool.components.length, expected.size);
      assert.equal(pool.entities.length, expected.size);
      for (const [survivor, component] of expected) {
        const handle = handles[survivor];
        assert.equal(pool.get(handle), component);
        const i = pool.sparse[handle.slot];
        assert.equal(pool.entities[i], handle);
        assert.equal(pool.components[i], component);
      }
    }
  });
}

test('removing an absent component leaves other components intact', () => {
  const { pool, handles: [present, absent] } = makePool(2);
  const position = new Position();
  pool.add(present, position);
  pool.remove(absent);
  assert.equal(pool.get(present), position);
  assert.equal(pool.components.length, 1);
});

test('structural changes during iteration throw without changing components or allocation', () => {
  const world = new World();
  const ids = Array.from({ length: 4 }, () => {
    const id = world.create();
    world.add(id, new Position());
    world.add(id, new Health());
    return id;
  });
  const visited = [];
  world.each([Position, Health], (id, position) => {
    visited.push(id);
    assert.throws(() => world.create(), /iteration is in progress/);
    assert.throws(() => world.add(id, new Position()), /iteration is in progress/);
    assert.throws(() => world.destroy(id), /iteration is in progress/);
    assert.throws(() => world.remove(id, position), /iteration is in progress/);
    assert.equal(world.get(id, Position), position);
  });
  assert.deepEqual(visited, ids);
  assert.deepEqual(matching(world, Position, Health).map(([id]) => id), ids);
  const fresh = world.create();
  assert.equal(fresh.slot, ids.length);
  for (const id of ids) world.destroy(id);
  assert.deepEqual(matching(world, Position, Health), []);
});

test('an uncaught destruction error releases the iteration guard', () => {
  const world = new World();
  const id = world.create();
  const position = new Position();
  world.add(id, position);
  assert.throws(() => world.each([Position, Position], () => world.destroy(id)),
    /iteration is in progress/);
  assert.deepEqual(matching(world), [[id, position, position]]);
  world.destroy(id);
  assert.equal(world.get(id, Position), undefined);
});

test('an arbitrary callback exception propagates and releases the iteration guard', () => {
  const world = new World();
  const id = world.create();
  world.add(id, new Position());
  const error = new Error('callback failure');
  assert.throws(() => world.each([Position, Position], () => { throw error; }),
    actual => actual === error);
  assert.equal(matching(world).length, 1);
  world.destroy(id);
});

test('a rejected nested query does not release the outer iteration guard', () => {
  const world = new World();
  const id = world.create();
  world.add(id, new Position());
  world.each([Position, Position], () => {
    assert.throws(() => matching(world), /iteration is in progress/);
    assert.throws(() => world.destroy(id), /iteration is in progress/);
  });
  assert.equal(matching(world).length, 1);
  world.destroy(id);
});

test('iteration guards are independent between worlds', () => {
  const first = new World();
  const second = new World();
  first.add(first.create(), new Position());
  const id = second.create();
  second.add(id, new Position());
  first.each([Position, Position], () => {
    assert.equal(matching(second).length, 1);
    second.destroy(id);
  });
  assert.deepEqual(matching(second), []);
});

test('query array reads scale with the smallest required pool', () => {
  // White-box operation count avoids machine-dependent timing thresholds.
  // Instrument dense arrays only after setup so this measures query work.
  const world = new World();
  const size = 256;
  const velocity = new Velocity();
  for (let i = 0; i < size; i++) {
    const id = world.create();
    world.add(id, new Position());
    world.add(id, new Health());
    if (i === 0) world.add(id, velocity);
  }
  let reads = 0;
  for (const pool of world.pools.values()) {
    pool.entities = new Proxy(pool.entities, {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
  }
  assert.equal(matching(world, Position, Health).length, size);
  assert.equal(matching(world).length, size);
  assert.ok(reads <= 10 * size, `Expected linear array reads, got ${reads}`);

  reads = 0;
  const speeds = [];
  world.each([Position, Velocity, Health], (id, position, speed) => speeds.push(speed));
  assert.deepEqual(speeds, [velocity]);
  assert.ok(reads <= 12, `Expected few array reads with one candidate, got ${reads}`);
});
