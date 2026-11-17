import { Entity, EntityManager } from "./Entity.js";
import { ComponentConstructor, ComponentPool } from "./Component.js";

export class World {
    private readonly entities = new EntityManager();
    private readonly pools = new Map<Function, ComponentPool<any>>();

    create(): Entity {
        return this.entities.create();
    }

    destroy(e: Entity): void {
        this.entities.destroy(e);
    }

    private getPool<T>(
        type: ComponentConstructor<T>
    ): ComponentPool<T> {
        let pool = this.pools.get(type);

        if (!pool) {
            pool = new ComponentPool<T>();
            this.pools.set(type, pool);
        }

        return pool;
    }

    add<T extends object>(e: Entity, component: T): void {
        const type = component.constructor as ComponentConstructor<T>;
        this.getPool(type).add(e, component);
   }

   get<T>(
    e: Entity,
    type: ComponentConstructor<T>
   ): T {
    return this.getPool(type).get(e);
   }

   has<T>(
    e: Entity,
    type: ComponentConstructor<T>
   ): boolean {
    return this.getPool(type).has(e);
   }

   each<U, V>(
    c1: ComponentConstructor<U>, 
    c2: ComponentConstructor<V>, 
    f: (e: Entity, u: U, v: V) => void
    ): void {
    let p1 = this.getPool(c1);
    let p2 = this.getPool(c2);

    if (p1.entities.length < p2.entities.length) {
        this.each2(p1, p2, f);
    } else {
        this.each2(p2, p1, f);
    }
   }

   private each2<U, V>(
        p1: ComponentPool<U>,
        p2: ComponentPool<V>,
        f: (e: Entity, u: U, v: V) => void

   ): void {
        for (const e of p1.entities) {
        if (p2.has(e)) {
            const g = p1.get(e);
            const h = p2.get(e);

            f(e, g, h);
        }
    }
   }
}