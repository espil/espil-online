# Espil Store Layout - JSON format spec (v1)

• Every store interior of the Konbiniya kind is data, not code: a
  `layout.json` beside the store page describes where each object stands.
• The store page (`index.html`) fetches its `layout.json` at boot and builds
  every placement and collider from it. No placement table lives in code.
• Placed objects are, for now, ONLY Kenney Mini Market models.

## File shape

```json
{
  "format": "espil-store-layout",
  "version": 1,
  "store":  { "slug": "...", "name": "...", "address": "...", "city": "..." },
  "grid":   { "cols": 44, "rows": 30, "cellMeters": 1,
              "scaleClass": 48, "origin": { "x": -22, "z": -15 },
              "axes": "..." },
  "room":   { "floorMeters": [44, 30], "wallHeightMeters": 6, "modelScale": 3 },
  "placements": [ { "model": "shelf-boxes", "cell": [6, 9], "rotY": 0 } ]
}
```

## Grid

• The floor is a grid of `cols` x `rows` square cells of `cellMeters` metres.
  Here: 44 x 30 cells of 1 m, so cols/rows equal the floor size in metres.
• `origin` is the world coordinate (metres, room centre = 0,0) of the grid's
  minimum corner. Cell `[0, 0]` is the min-x / min-z cell. In this store's
  frame +x is east and +z is south (the entrance side); the counter wall is
  the min-z side.
• A placement anchors at its CELL CENTRE plus its sub-cell offset:

  worldX = origin.x + (cx + 0.5) * cellMeters + dx
  worldZ = origin.z + (cz + 0.5) * cellMeters + dz

• `scaleClass` names the store's scale tier: the tiers are the multiples of 8
  (16, 24, 32, 40, 48, ...), and a store's scaleClass is the smallest tier
  that covers both cols and rows (max(44, 30) = 44, so this store is 48).
  Small stores sit on the 16 or 24 tiers; bigger stores move up the ladder.
  `cols`/`rows` in the file are always the exact values - scaleClass is the
  class label, never a substitute for them.

## Placements

Each entry places ONE Kenney Mini Market model:

• `model` (required) - the GLB's file id without extension, loaded from
  `assets/kenney-mini-market/<model>.glb`.
• `cell` (required) - `[cx, cz]`, 0-based grid coordinates.
• `rotY` (required) - facing in DEGREES, counter-clockwise around +Y, the
  same sign convention as THREE's `rotation.y` (90 = turned to face +x side
  when the model's front is -z; the values here are the page's old radian
  rotations x 180/pi).
• `dx`, `dz` (optional, default 0) - sub-cell offset in metres from the cell
  centre. With 1 m cells these stay within half a cell (+/-0.5).
• `y` (optional, default 0) - anchor height in metres (e.g. the register
  sits on the counter slab at y = 1.19).
• `scale` (optional, default = `room.modelScale`, 3 here) - per-object
  scale override when one object must differ from the store scale.
• `collide` (optional, default true) - whether the object adds a collision
  box. Colliders derive from the model's native bounds x its scale, the
  same rule the page always used. `false` for objects the player walks up
  to or through (the register on the counter).

## What is NOT in the layout (stays in page code config)

• The room shell: floor, walls, ceiling, light panels, door frame, sign.
• The serving counter's body and top slab (code-built boxes) and its
  collider - the register that sits on it IS a placement.
• The clerk NPC (`character-employee` behind the counter): NPCs are placed
  by code, never by layout.
• The counter interaction point (`STORE.counter`), the spawn point,
  lighting rigs, and all shop/stock/Leo logic (`STORE` config in the page).

## The 12 Kenney Mini Market models in this store

• `shelf-boxes`, `shelf-bags`, `shelf-end` - aisle shelving.
• `freezers-standing`, `freezer` - cold wall and chest freezers.
• `display-fruit`, `display-bread` - fresh displays.
• `cash-register` - the till (placement, on the counter slab).
• `shopping-basket`, `shopping-cart`, `bottle-return` - door props.
• `character-employee` - the clerk (code-placed NPC, see above).

## Failure behaviour

• If `layout.json` cannot be fetched or parsed, the page still opens: it
  logs `[espil-store-page] layout.json failed to load...` to the console
  and runs with an empty floor (room shell, counter and clerk still built,
  shop still usable). A missing layout must never be a dead page.
