export type Entity = number;

export class EntityManager {
  private next: Entity = 0;
  private freeIds: Entity[] = [];

  create(): Entity {
    return this.freeIds.pop() ?? this.next++;
  }

  destroy(e: Entity): void {
    if (e >= this.next) return;
    if (this.freeIds.includes(e)) return;
    this.freeIds.push(e);
  }
}
