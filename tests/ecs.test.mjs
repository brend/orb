import assert from 'node:assert/strict';
import test from 'node:test';
import { World } from '../dist/index.js';
import { ComponentPool } from '../dist/ecs/Component.js';

class Position { constructor(x = 0) { this.x = x; } }
class Health { constructor(hp = 10) { this.hp = hp; } }

function matching(world, first = Position, second = Position) {
  const result = [];
  world.each(first, second, (id, a, b) => result.push([id, a, b]));
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

test('destroying never-allocated IDs does not corrupt future allocation', () => {
  const world = new World();
  world.destroy(0);
  world.destroy(5);
  const ids = Array.from({ length: 10 }, () => world.create());
  assert.equal(new Set(ids).size, ids.length);
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

test('removing a component clears membership and allows re-addition', () => {
  const pool = new ComponentPool();
  pool.add(7, new Position());
  pool.remove(7);
  assert.equal(pool.has(7), false);
  assert.equal(pool.get(7), undefined);
  pool.add(7, new Position(2));
  assert.equal(pool.has(7), true);
  assert.equal(pool.get(7).x, 2);
  assert.deepEqual(pool.entities, [7]);
});

test('single-entity churn releases component slots and object references', () => {
  const pool = new ComponentPool();
  for (let i = 0; i < 10000; i++) {
    pool.add(0, new Position(i));
    pool.remove(0);
    assert.equal(pool.components.length, 0);
    assert.equal(pool.entities.length, 0);
  }
});

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`removal order ${order} preserves survivors and compact storage`, () => {
    const pool = new ComponentPool();
    const expected = new Map([0, 1, 2].map(id => [id, new Position(id)]));
    for (const [id, component] of expected) pool.add(id, component);
    for (const id of order) {
      pool.remove(id);
      expected.delete(id);
      assert.equal(pool.has(id), false);
      assert.equal(pool.get(id), undefined);
      assert.equal(pool.components.length, expected.size);
      assert.deepEqual([...pool.entities].sort(), [...expected.keys()].sort());
      for (const [survivor, component] of expected) {
        assert.equal(pool.get(survivor), component);
      }
    }
  });
}

test('removing an absent component leaves other components intact', () => {
  const pool = new ComponentPool();
  const position = new Position();
  pool.add(1, position);
  pool.remove(2);
  assert.equal(pool.get(1), position);
  assert.equal(pool.components.length, 1);
});

test('destroy during iteration throws without changing components or allocation', () => {
  const world = new World();
  const ids = Array.from({ length: 4 }, () => {
    const id = world.create();
    world.add(id, new Position());
    world.add(id, new Health());
    return id;
  });
  const visited = [];
  world.each(Position, Health, id => {
    visited.push(id);
    assert.throws(() => world.destroy(id), /iteration is in progress/);
  });
  assert.deepEqual(visited.sort(), ids);
  assert.deepEqual(matching(world, Position, Health).map(([id]) => id), ids);
  assert.ok(!ids.includes(world.create()), 'rejected destruction must not recycle IDs');
  for (const id of ids) world.destroy(id);
  assert.deepEqual(matching(world, Position, Health), []);
});

test('an uncaught destruction error releases the iteration guard', () => {
  const world = new World();
  const id = world.create();
  const position = new Position();
  world.add(id, position);
  assert.throws(() => world.each(Position, Position, () => world.destroy(id)),
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
  assert.throws(() => world.each(Position, Position, () => { throw error; }),
    actual => actual === error);
  assert.equal(matching(world).length, 1);
  world.destroy(id);
});

test('a rejected nested query does not release the outer iteration guard', () => {
  const world = new World();
  const id = world.create();
  world.add(id, new Position());
  world.each(Position, Position, () => {
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
  first.each(Position, Position, () => {
    assert.equal(matching(second).length, 1);
    second.destroy(id);
  });
  assert.deepEqual(matching(second), []);
});

test('query array reads grow linearly rather than scanning membership per entity', () => {
  // White-box operation count avoids machine-dependent timing thresholds.
  // Instrument dense arrays only after setup so this measures query work.
  const world = new World();
  const size = 256;
  for (let i = 0; i < size; i++) {
    const id = world.create();
    world.add(id, new Position());
    world.add(id, new Health());
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
});
