import { Entity } from "./Entity.js";

export type ComponentConstructor<T> = new (...args: any[]) => T;

export class ComponentPool<T> {
  readonly components: (T | undefined)[] = [];
  readonly entities: Entity[] = [];
  readonly sparse: (number | undefined)[] = [];

  add(e: Entity, component: T): void {
    if (this.has(e)) {
      this.components[this.sparse[e]!] = component;
    } else {
      this.sparse[e] = this.components.length;
      this.components.push(component);
      this.entities.push(e);
    }
  }

  remove(e: Entity): void {
    const entityIndex = this.entities.indexOf(e);
    if (entityIndex < 0) return;
    const componentIndex = this.sparse[e]!;

    const lastComponent = this.components.pop();

    if (componentIndex < this.components.length) {
      const entityInLastSlot = this.sparse.indexOf(this.components.length);
      this.components[componentIndex] = lastComponent;
      this.sparse[entityInLastSlot] = componentIndex;
    }

    this.sparse[e] = undefined;
    this.entities.splice(entityIndex, 1);
  }

  get(e: Entity): T | undefined {
    const i = this.sparse[e];
    if (i === undefined) return undefined;
    return this.components[i];
  }

  has(e: Entity): boolean {
    return this.sparse[e] !== undefined;
  }
}

export interface TypeErasedComponentPool {
  add: (e: Entity, component: unknown) => void;
  get: (e: Entity) => unknown;
}
