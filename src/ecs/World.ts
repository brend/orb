import { Entity, EntityManager } from "./Entity.js";
import { ComponentConstructor, ComponentPool } from "./Component.js";

export class World {
  private readonly entities = new EntityManager();
  private readonly pools = new Map<Function, ComponentPool<any>>();
  private isIterating = false;

  create(): Entity {
    return this.entities.create();
  }

  isAlive(e: Entity): boolean {
    return this.entities.isAlive(e);
  }

  destroy(e: Entity): void {
    if (this.isIterating)
      throw new Error("cannot use this method while iteration is in progress");
    if (!this.entities.isAlive(e))
      throw new Error("attempting to destroy an already dead entity");
    this.entities.destroy(e);
    for (const pool of this.pools.values()) {
      pool.remove(e);
    }
  }

  private getPool<T>(type: ComponentConstructor<T>): ComponentPool<T> {
    let pool = this.pools.get(type);

    if (!pool) {
      pool = new ComponentPool<T>();
      this.pools.set(type, pool);
    }

    return pool;
  }

  add<T extends object>(e: Entity, component: T): void {
    if (!this.entities.isAlive(e))
      throw new Error("attempted to add an entity that is not alive");
    const type = component.constructor as ComponentConstructor<T>;
    this.getPool(type).add(e, component);
  }

  get<T>(e: Entity, type: ComponentConstructor<T>): T | undefined {
    if (!this.entities.isAlive(e))
      throw new Error("attempting to get a dead entity");
    return this.getPool(type).get(e);
  }

  each<U, V>(
    c1: ComponentConstructor<U>,
    c2: ComponentConstructor<V>,
    f: (e: Entity, u: U, v: V) => void,
  ): void {
    if (this.isIterating)
      throw new Error("cannot use this method while iteration is in progress");

    this.isIterating = true;

    try {
      let p1 = this.getPool(c1);
      let p2 = this.getPool(c2);

      if (p1.entities.length < p2.entities.length) {
        this.each2(p1, p2, f);
      } else {
        this.each2(p2, p1, (e, v, u) => f(e, u, v));
      }
    } finally {
      this.isIterating = false;
    }
  }

  private each2<U, V>(
    p1: ComponentPool<U>,
    p2: ComponentPool<V>,
    f: (e: Entity, u: U, v: V) => void,
  ): void {
    for (let i = 0; i < p1.entities.length; ++i) {
      const e = p1.entities[i];
      const c1 = p1.components[i];
      const c2 = p2.get(e);

      if (c2) {
        f(e, c1, c2);
      }
    }
  }
}
