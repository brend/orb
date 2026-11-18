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
