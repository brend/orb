import { Entity } from "./Entity.js";

export type ComponentConstructor<T> = new (...args: any[]) => T;

export class ComponentPool<T> {
  readonly components: T[] = [];
  readonly entities: Entity[] = [];
  readonly sparse: (number | undefined)[] = [];

  add(e: Entity, component: T): void {
    const i = this.sparse[e.slot];

    if (i === undefined) {
      this.sparse[e.slot] = this.components.length;
      this.components.push(component);
      this.entities.push(e);
    } else {
      if (this.entities[i] !== e)
        throw new Error(
          "internal error: attempting to replace component of different entity",
        );
      this.components[i] = component;
    }
  }

  remove(e: Entity): void {
    const i = this.sparse[e.slot];

    if (i === undefined || this.entities[i] !== e) return;

    const lastEntity = this.entities.pop()!;
    const lastComponent = this.components.pop()!;

    if (i < this.components.length) {
      this.entities[i] = lastEntity;
      this.components[i] = lastComponent;
      this.sparse[lastEntity.slot] = i;
    }

    this.sparse[e.slot] = undefined;
  }

  get(e: Entity): T | undefined {
    const i = this.sparse[e.slot];
    if (i === undefined || this.entities[i] !== e) return undefined;
    return this.components[i];
  }

  has(e: Entity): boolean {
    const i = this.sparse[e.slot];
    return i !== undefined && this.entities[i] === e;
  }
}
