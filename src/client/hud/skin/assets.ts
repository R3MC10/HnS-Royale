// HUD skin assets (skin foundation): the registry of painted HUD art the kit expects, and a loader.
// Art lives in art/out/hud/<id>/<id>.png (+ optional manifest.json with "anchor"); `npm run art`
// copies it to public/art/hud/<id>/<id>.png and lists it in public/art/index.json (statics).
// Everything is optional at runtime: until an image has loaded (or when it is missing), callers get
// null and draw the procedural fallback. art/out/hud/EXPECTED.json mirrors HUD_ART for the art agent.

/** One expected piece of HUD art. Sizes/insets are in art pixels of the expected size. */
export interface HudArtDef {
  id: string;
  /** Expected PNG size (w, h). Art of another size is fine; insets/anchors scale with it. */
  size: [number, number];
  /** 9-slice insets [left, top, right, bottom] in art px (stretchable panels/bars/buttons). */
  slice?: [number, number, number, number];
  /** Rendered border thickness in HUD units for 9-slice pieces (the insets map onto this). */
  borderU?: number;
  /** Globe pieces: the art px point that sits on the globe centre, and the art px radius of the globe opening. */
  anchor?: [number, number];
  radiusPx?: number;
  desc: string;
}

const A = (d: HudArtDef) => d;

/** Every HUD art id the kit draws. Keep EXPECTED.json in sync (same ids, sizes, descriptions). */
export const HUD_ART: Record<string, HudArtDef> = Object.fromEntries(
  [
    A({ id: "hud_panel", size: [512, 512], slice: [96, 96, 96, 96], borderU: 6, desc: "9-slice panel: weathered dark carved stone field with a blackened wrought-iron frame, worn bronze rivets at the corners, a little moss/grime. Centre is plain dark stone (it is stretched)." }),
    A({ id: "hud_panel_iron", size: [256, 256], slice: [48, 48, 48, 48], borderU: 4, desc: "9-slice lighter panel variant: blackened iron plate border with small rivets around a near-black recessed centre (used for docked lists, small info plates)." }),
    A({ id: "hud_slot", size: [128, 128], slice: [24, 24, 24, 24], borderU: 3, desc: "Square item/skill slot FRAME: bevelled blackened-iron square bezel, about 22 px thick, transparent centre. Neutral grey-iron so a rarity tint can be drawn over its inner edge." }),
    A({ id: "hud_slot_bg", size: [128, 128], desc: "Square slot INTERIOR: recessed dark stone well with a soft inner shadow, opaque, no frame." }),
    A({ id: "hud_globe_back", size: [256, 256], anchor: [128, 128], radiusPx: 128, desc: "Empty globe interior: a dark glass sphere seen from the front, near-black with faint depth, opaque disc of radius 128 centred, transparent outside." }),
    A({ id: "hud_globe_liquid_life", size: [256, 256], desc: "Tileable square texture of thick dark-red life liquid with slow swirls and darker veins (fully opaque, seamless left-right and top-bottom). It is clipped to the globe and scrolled." }),
    A({ id: "hud_globe_liquid_mana", size: [256, 256], desc: "Tileable square texture of deep cold-blue mana liquid with slow swirls (fully opaque, seamless). Clipped to the globe and scrolled." }),
    A({ id: "hud_globe_glass", size: [256, 256], anchor: [128, 128], radiusPx: 128, desc: "Glass overlay for the globe: transparent PNG with a soft upper-left highlight crescent, small specular glint, faint bottom rim light and a dark inner edge shadow, all within radius 128." }),
    A({ id: "hud_globe_rim", size: [320, 320], anchor: [160, 160], radiusPx: 128, desc: "Globe rim: a heavy round blackened-iron ring with worn bronze rivets, inner opening radius 128 centred (transparent inside and outside)." }),
    A({ id: "hud_holder_life", size: [512, 512], anchor: [256, 236], radiusPx: 128, desc: "Original carved dark-stone figure (e.g. a hooded stone warden or gaunt beast) cradling a round globe from below and behind, for the LEFT (life) globe; the globe opening of radius 128 around the anchor is transparent. Figure faces right, toward the screen centre." }),
    A({ id: "hud_holder_mana", size: [512, 512], anchor: [256, 236], radiusPx: 128, desc: "Mirror counterpart of hud_holder_life for the RIGHT (mana) globe, a different original carved figure facing left. Globe opening radius 128 around the anchor is transparent." }),
    A({ id: "hud_bar_frame", size: [512, 64], slice: [40, 24, 40, 24], borderU: 2, desc: "9-slice thin bar frame: recessed iron channel with bevelled edges and end caps, transparent centre window (life/xp/stun bars)." }),
    A({ id: "hud_strip", size: [1024, 192], slice: [160, 64, 160, 48], borderU: 7, desc: "9-slice dark carved stone strip with an iron rail along the top and a thinner rail at the bottom, heavy end caps (skill bar backplate). Centre section uniform so it stretches." }),
    A({ id: "hud_belt", size: [512, 128], slice: [64, 40, 64, 40], borderU: 5, desc: "9-slice worn dark leather belt strap over stone with iron buckle ends, behind the flask/charm slots." }),
    A({ id: "hud_button", size: [128, 64], slice: [24, 20, 24, 20], borderU: 3, desc: "9-slice stone button, normal state: raised dark carved stone with iron bevel." }),
    A({ id: "hud_button_hover", size: [128, 64], slice: [24, 20, 24, 20], borderU: 3, desc: "9-slice stone button, hover: same as hud_button with warm ember-lit edges." }),
    A({ id: "hud_button_pressed", size: [128, 64], slice: [24, 20, 24, 20], borderU: 3, desc: "9-slice stone button, pressed: pushed-in, darker centre, inner shadow on top." }),
    A({ id: "hud_tooltip", size: [256, 256], slice: [32, 32, 32, 32], borderU: 3, desc: "9-slice tooltip box: near-black translucent-looking dark plate (paint it opaque dark brown-black) with a thin worn-bronze border and tiny corner rivets." }),
    A({ id: "hud_label", size: [256, 64], slice: [20, 20, 20, 20], borderU: 1.5, desc: "9-slice small dark label plate (dark lacquered leather over wood) with a thin worn-bronze border line, for ground loot names and small tags." }),
    A({ id: "hud_flask_glass", size: [96, 128], desc: "Empty glass flask (vial) front view, transparent background; the inside of the glass transparent so liquid can be drawn behind it. Corked, iron-banded neck." }),
    A({ id: "hud_minimap_frame", size: [512, 512], slice: [64, 64, 64, 64], borderU: 4, desc: "9-slice square minimap frame (royale HUD): a thin ring of dark carved stone with a blackened-iron inner lip and small bronze rivets at the corners; the centre is fully transparent (the map shows through)." }),
  ].map((d) => [d.id, d]),
);

interface IndexStatic {
  src: string;
  size: [number, number];
  anchor: [number, number];
}
interface ArtIndexLite {
  statics?: Record<string, IndexStatic>;
  icons?: Record<string, string>;
}

let statics: Record<string, IndexStatic> = {};
let icons: Record<string, string> = {};
let indexState: "idle" | "loading" | "ready" | "failed" = "idle";
let artEnabled = true;
let ver = 0;

function loadIndex() {
  if (indexState !== "idle" || typeof fetch !== "function") return;
  indexState = "loading";
  fetch("art/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: ArtIndexLite | null) => {
      if (!j || typeof j !== "object") {
        indexState = "failed";
        return;
      }
      statics = j.statics ?? {};
      icons = j.icons ?? {};
      indexState = "ready";
      ver++;
      // Start loading every HUD piece that exists so the first frames swap in quickly.
      for (const id of Object.keys(HUD_ART)) if (statics[id]) image(statics[id].src);
    })
    .catch(() => {
      indexState = "failed";
    });
}

const images = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    im.src = src;
    images.set(src, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

/** A loaded HUD art piece: the image plus its def with insets/anchor/radius scaled to the real image size. */
export interface HudArt {
  img: HTMLImageElement;
  def: HudArtDef;
  /** real px / expected px (x, y) */
  sx: number;
  sy: number;
  anchor: [number, number];
  radiusPx: number;
  slice: [number, number, number, number] | null;
}

const artCache = new Map<string, { v: number; a: HudArt | null }>();

/** Painted art for a registry id, or null (missing, still loading, or art disabled) -> draw the fallback. */
export function hudArt(id: string): HudArt | null {
  if (!artEnabled) return null;
  loadIndex();
  const st = statics[id];
  const def = HUD_ART[id];
  if (!st || !def) return null;
  const img = image(st.src);
  if (!img) return null;
  const c = artCache.get(id);
  if (c && c.v === ver && c.a && c.a.img === img) return c.a;
  const sx = img.naturalWidth / def.size[0];
  const sy = img.naturalHeight / def.size[1];
  // The importer defaults a missing manifest anchor to bottom-centre; treat that as "no anchor".
  const defaultAnchor = st.anchor && st.anchor[0] === img.naturalWidth / 2 && st.anchor[1] === img.naturalHeight;
  const anchor: [number, number] =
    st.anchor && !defaultAnchor
      ? [st.anchor[0], st.anchor[1]]
      : def.anchor
        ? [def.anchor[0] * sx, def.anchor[1] * sy]
        : [img.naturalWidth / 2, img.naturalHeight / 2];
  const slice: [number, number, number, number] | null = def.slice
    ? [def.slice[0] * sx, def.slice[1] * sy, def.slice[2] * sx, def.slice[3] * sy]
    : null;
  const a: HudArt = { img, def, sx, sy, anchor, radiusPx: (def.radiusPx ?? Math.min(def.size[0], def.size[1]) / 2) * sx, slice };
  artCache.set(id, { v: ver, a });
  return a;
}

/** Loaded item/currency icon from art/out/icon/<id>.png (public/art/icon), or null. */
export function hudIcon(id: string): HTMLImageElement | null {
  if (!artEnabled) return null;
  loadIndex();
  const src = icons[id];
  return src ? image(src) : null;
}

/** Status of every registry id: "present" (listed in the art index), "loading" or "missing". */
export function hudArtStatus(): Record<string, "present" | "missing" | "loading"> {
  loadIndex();
  const out: Record<string, "present" | "missing" | "loading"> = {};
  for (const id of Object.keys(HUD_ART)) out[id] = indexState !== "ready" ? "loading" : statics[id] ? "present" : "missing";
  return out;
}

/** Turn painted HUD art off/on (procedural fallback only) - debugging / comparison. */
export function setHudArtEnabled(on: boolean): void {
  artEnabled = on;
}

/** Bumped when the art index loads (callers caching derived data can compare). */
export function hudArtVersion(): number {
  return ver;
}

/** Start loading the index and every present HUD image now (optional; hudArt() also loads lazily). */
export function preloadHudArt(): void {
  loadIndex();
}
