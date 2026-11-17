import { Entity } from "./Entity.js";

export type ComponentConstructor<T> = new (...args: any[]) => T;

// class ComponentRegistry {
//     private nextId = 0;
//     private ids = new Map<Function, number>();

//     getId<T>(component: ComponentConstructor<T>): number {
//         let id = this.ids.get(component);

//         if (id === undefined) {
//             id = this.nextId++;
//             this.ids.set(component, id);
//         }

//         return id;
//     }
// }

export class ComponentPool<T> {
    readonly components: T[] = [];
    readonly entities: Entity[] = [];
    readonly sparse: number[] = [];

    add(e: Entity, component: T): void {
        this.sparse[e] = this.components.length;
        this.components.push(component);
        this.entities.push(e);
    }

    get(e: Entity): T {
        return this.components[this.sparse[e]];
    }

    has(e: Entity): boolean {
        return this.entities.indexOf(e) >= 0;
    }
};

export interface TypeErasedComponentPool {
    add: (e: Entity, component: unknown) => void;
    get: (e: Entity) => unknown;
};