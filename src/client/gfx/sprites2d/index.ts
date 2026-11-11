// Painted 2D sprites (art/out -> public/art via `npm run art`). See registry.ts for the index format.
export { actorDef, artVersion, getImage, paintedEnabled, preload, staticDef, type Dir8 } from "./registry";
export { actorScale, actorSprite, ART_PX, corpseFall, corpseSprite, dirName, drawActorBacking, drawActorSprite, drawSprite, drawWarmFlash, HERO_H, heroSpriteId, isPaintedSprite, type ActorAnimName } from "./actors";
export { drawIcon, drawProp, drawTilePattern, hasIcon, iconImage, propBox, propSprite, propWidth, tilePattern } from "./statics";
export { fillPaintedGround, GROUND_TILES, paintedGroundCached, paintedGroundChunk, paintedGroundDue, paintedGroundReady } from "./ground";
export { obstacleProp, scatterProp, wallDressProp, type PropPick } from "./decor";
