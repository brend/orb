
export type Entity = number;

export class EntityManager {
    private next: Entity = 0;
    private freeIds: Entity[] = [];

    create(): Entity {
        return this.freeIds.pop() ?? this.next++;
    }

    destroy(e: Entity): void {
        this.freeIds.push(e);
    }
}