import { World } from "./ecs/World.js";

class Position {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

class Health {
    hp: number;

    constructor(hp: number) {
        this.hp = hp;
    }
}

const world = new World();
const e = world.create();
const g = world.create();

world.add(e, new Position(2, 4));
world.add(e, new Health(10));
world.add(g, new Position(3, -7));

console.log("e has Position?", world.has(e, Position));
console.log("e has Health?", world.has(e, Health));
console.log("g has Position?", world.has(g, Position));
console.log("g has Health?", world.has(g, Health));

world.each(Position, Health, (e, p, h) => { console.log(e, "has position", p, "and health", h); });

world.destroy(e);