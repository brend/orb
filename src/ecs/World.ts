import { Entity, EntityManager } from "./Entity.js";
import { ComponentConstructor, ComponentPool } from "./Component.js";

type Constructor = ComponentConstructor<object>;

type Instances<T extends readonly Constructor[]> = {
  [K in keyof T]: InstanceType<T[K]>;
};

export class World {
  private readonly entities = new EntityManager();
  private readonly pools = new Map<Function, ComponentPool<any>>();
  private isIterating = false;

  create(...components: object[]): Entity {
    this.throwIfIterating();

    const e = this.entities.create();

    for (const c of components) {
      try {
        this.add(e, c);
      } catch (error) {
        this.destroy(e);
        throw error;
      }
    }

    return e;
  }

  isAlive(e: Entity): boolean {
    return this.entities.isAlive(e);
  }

  destroy(e: Entity): void {
    this.throwIfIterating();
    if (!this.entities.isAlive(e)) return;
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
    this.throwIfIterating();

    if (!this.entities.isAlive(e))
      throw new Error("attempted to add an entity that is not alive");

    const type = component.constructor as ComponentConstructor<T>;
    // A constructor getter can destroy the entity before add resumes.
    if (!this.entities.isAlive(e))
      throw new Error("attempted to add an entity that is not alive");

    this.getPool(type).add(e, component);
  }

  get<T>(e: Entity, type: ComponentConstructor<T>): T | undefined {
    if (!this.entities.isAlive(e)) return undefined;
    return this.getPool(type).get(e);
  }

  has<T extends object>(e: Entity, component: T): boolean {
    return (
      this.entities.isAlive(e) &&
      this.get(e, component.constructor as ComponentConstructor<T>) != null
    );
  }

  remove<T extends object>(e: Entity, component: T): void {
    this.throwIfIterating();
    if (!this.entities.isAlive(e))
      throw new Error("attempted to modify a dead entity");
    const type = component.constructor as ComponentConstructor<T>;
    this.getPool(type).remove(e);
  }

  private throwIfIterating(): void {
    if (this.isIterating)
      throw new Error("cannot use this method while iteration is in progress");
  }

  each<const T extends readonly [Constructor, ...Constructor[]]>(
    types: T,
    callback: (entity: Entity, ...components: Instances<T>) => void,
    options?: { without?: readonly Constructor[] },
  ): void {
    this.throwIfIterating();
    this.isIterating = true;

    try {
      const requiredPools: ComponentPool<object>[] = [];
      let smallestPool: ComponentPool<object> | undefined;

      for (const type of types) {
        const pool = this.pools.get(type);
        if (!pool || pool.entities.length === 0) return;

        requiredPools.push(pool);
        if (
          !smallestPool ||
          pool.entities.length <= smallestPool.entities.length
        ) {
          smallestPool = pool;
        }
      }

      if (!smallestPool) return;
      const excludedPools = options?.without?.map((type) =>
        this.pools.get(type),
      );

      for (const entity of smallestPool.entities) {
        if (excludedPools?.some((pool) => pool?.has(entity))) continue;

        const components = requiredPools.map((pool) => pool.get(entity));
        if (components.some((component) => component === undefined)) continue;

        // The pools follow the same order as the constructor tuple.
        callback(entity, ...(components as Instances<T>));
      }
    } finally {
      this.isIterating = false;
    }
  }
}
