# Orb

Orb (`@waldrumpus/orb`) provides reusable utilities for TypeScript browser games, including a canvas engine, scenes, sprites, and an entity-component system.

## Start a new game

The [game template](templates/game/README.md) includes TypeScript, Vite, HTML, CSS, and a starter scene wired to Orb. From the root of the Orb checkout, run:

```sh
cp -R templates/game ../my-game
cd ../my-game
npm ci
npm run dev
```

Edit `src/GameScene.ts` to build your game. Run `npm run build` to generate the production site in `dist/`.
