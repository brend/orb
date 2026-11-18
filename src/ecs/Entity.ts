export type Generation = number;

class EntityHandle {
  constructor(
    public readonly slot: number,
    public readonly generation: Generation,
    public readonly owner: symbol,
  ) {}
}

declare const entityBrand: unique symbol;

export type Entity = EntityHandle & {
  readonly [entityBrand]: true;
};

class EntitySlot {
  constructor(
    public generation: Generation,
    public handle: Entity | undefined,
  ) {}
}

export class EntityManager {
  private readonly slots: EntitySlot[] = [];
  private readonly freeSlotIndices: number[] = [];
  private readonly ownershipToken = Symbol();

  create(): Entity {
    let index: number;
    let slot: EntitySlot;

    if (this.freeSlotIndices.length > 0) {
      index = this.freeSlotIndices.pop()!;
      slot = this.slots[index];
    } else {
      index = this.slots.length;
      slot = new EntitySlot(0, undefined);
      this.slots.push(slot);
    }

    const handle = Object.freeze(
      new EntityHandle(index, slot.generation, this.ownershipToken),
    ) as Entity;
    slot.handle = handle;
    return handle;
  }

  destroy(e: Entity): void {
    if (!this.isAlive(e)) return;

    const slot = this.slots[e.slot];
    slot.handle = undefined;

    // prevent generation exhaustion
    if (slot.generation === Number.MAX_SAFE_INTEGER) return;

    this.slots[e.slot].generation += 1;
    this.freeSlotIndices.push(e.slot);
  }

  isAlive(e: Entity): boolean {
    return e != null && e === this.slots[e.slot].handle;
  }
}
