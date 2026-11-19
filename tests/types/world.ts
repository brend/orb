import { World } from "../../dist/index.js";

class Health { hp = 10; }
const world = new World();
const health = world.get(world.create(), Health);
// A missing component must require narrowing under strictNullChecks.
// @ts-expect-error Component may be undefined.
health.hp;
if (health !== undefined) {
  const hp: number = health.hp;
}

// Entities are opaque handles, not numbers.
const entity = world.create();
// @ts-expect-error A number is not an Entity.
world.get(0, Health);
// @ts-expect-error An Entity is not a number.
const n: number = entity;

class Position { x = 0; }
class Velocity { dx = 1; }

world.each([Health], (id, component) => {
  const hp: number = component.hp;
});

world.each([Position, Velocity, Health], (id, position, velocity, health) => {
  position.x += velocity.dx;
  const hp: number = health.hp;
  // @ts-expect-error The first component is inferred as Position.
  position.dx;
});

// @ts-expect-error An iteration needs at least one required component.
world.each([], () => {});

const movement = [Position, Velocity] as const;
const options = { without: [Health] } as const;
world.each(movement, (id, position, velocity) => {
  world.isAlive(id);
  position.x += velocity.dx;
}, options);

// @ts-expect-error The callback receives only the required components.
world.each(movement, (id, position, velocity, health) => {}, options);
