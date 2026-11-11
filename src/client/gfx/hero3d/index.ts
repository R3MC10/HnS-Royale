// Live 3D hero: one skinned glTF hero (public/hero3d/hero.glb, exported headless by
// scripts/art/blender/hero_export.py) drawn into the 2D game as an image. Each visible hero gets its
// own skeleton + AnimationMixer; per frame it is posed from game state (continuous aim angle, anim clip
// timed by the game's anim frame, short cross-fades), rendered by ONE shared offscreen WebGLRenderer
// with an orthographic camera at the game's iso angle, then copied into that hero's 2D canvas with a
// dark outline, a rim light (pale for you, warm red for other players) and the hit flash. The result
// is a plain Sprite at the same feet anchor as every other hero sprite, so y-sorting, shadows, tints
// and the Feel springs keep working unchanged.
//
// Gear: the glb has ONE MESH PER ITEM BASE, named by the base id (ruin_greataxe, templar_tabard, ...),
// plus the body layers (base, hair, rag_top, rag_waist, rag_arm, rag_shin). The look carries the base
// id per slot (shared/look.ts); a base whose mesh is missing falls back to another base of the same
// look key, then to the old per-look meshes. Meshes are instantiated per hero on demand, so a hero
// only costs what it wears.
// Weapons pick the hold style of the clips: two-handed (plain clip names), "@1h", "@bow", "@xbow".
// Returns null (caller falls back to the 2D chain) without WebGL, before the glb loads, or with
// ?hero3d=0 in the URL. Dev: ?heroglb=<name> loads public/hero3d/<name>.glb instead.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Look } from "../../../shared/look";
import { BASES } from "../../../shared/content/bases";
import type { Sprite } from "../pixel";
import { HERO_FRAMES, type HeroAnim } from "../hero";
import { renderScaleFor } from "../../settings";

// ---- fallbacks for glbs without per-base meshes: look key -> mesh candidates, best first ----
const LOOK_MESH: Record<string, string[]> = {
  hood: ["hood", "coif", "helm_open"],
  circlet: ["circlet", "hood", "helm_open"],
  helm_horned: ["helm_horned", "helm_open"],
  helm_great: ["helm_great", "helm_open"],
  coif: ["coif", "hood", "helm_open"],
  body_plate: ["body_plate", "body_mail"],
  body_mail: ["body_mail", "body_plate"],
  body_leather: ["body_leather", "body_scale", "body_brigandine", "body_plate"],
  body_scale: ["body_scale", "body_leather", "body_brigandine", "body_plate"],
  body_robe: ["body_robe", "body_scale_robe", "body_plate_robe", "body_plate"],
  body_brigandine: ["body_brigandine", "body_leather", "body_plate"],
  body_plate_robe: ["body_plate_robe", "body_robe", "body_plate"],
  body_scale_robe: ["body_scale_robe", "body_robe", "body_scale", "body_plate"],
  gloves_leather: ["gloves_leather", "gloves_wrap", "gloves_gauntlet"],
  gloves_silk: ["gloves_silk", "gloves_leather", "gloves_gauntlet"],
  gloves_wrap: ["gloves_wrap", "gloves_leather", "gloves_gauntlet"],
  boots_soft: ["boots_soft", "boots_wrap", "boots_greave"],
  boots_slipper: ["boots_slipper", "boots_soft", "boots_greave"],
  boots_wrap: ["boots_wrap", "boots_soft", "boots_greave"],
};
const SLOTS = ["helmet", "body", "gloves", "boots", "belt", "offhand", "weapon"] as const;
type Slot = (typeof SLOTS)[number];

// ---- weapon look -> hold style of the clips, and which attacks are thrusts ----
const TWO_HAND = new Set(["greatsword", "greataxe", "maul", "quarterstaff", "staff", "spear"]);
function styleOf(weapon: string): string {
  return TWO_HAND.has(weapon) ? "" : weapon === "bow" ? "@bow" : weapon === "crossbow" ? "@xbow" : "@1h";
}
const THRUST: Record<string, string[]> = { spear: ["attack", "attack2"], dagger: ["attack"], wand: ["attack", "attack2"] };

// ---- view constants (iso.ts camera: ground foreshortening 0.62 -> ortho elevation asin(0.62)) ----
const SQ = 0.62;
const ELEV = Math.asin(SQ);
const HERO_H = 49; // screen units for a standing hero (painted sprites: 45; the 3D hero stands a little taller so its gear reads)
const HERO_M = 1.85; // model height, metres
const UNITS_PER_M = HERO_H / (HERO_M * Math.cos(ELEV)); // screen units per camera-plane metre
// canvas px per screen unit. The world draws lo.width / 720 screen px per unit (2.7 at 1080p, 3.6 at
// 1440p), so a fixed 3 was resampled almost 1:1 at 1080p (soft) and UPSCALED on anything larger (blurry).
// Render about 1.5x the screen density instead and let the 2D blit downsample: crisp edges, finer shading.
const D = pickDensity();
function pickDensity(): number {
  if (typeof window === "undefined") return 3;
  const forced = /[?&]herod=(\d)/.exec(location.search)?.[1]; // dev: ?herod=3..6 pins the density
  if (forced) return Math.max(2, Math.min(6, Number(forced)));
  const z = (window.innerWidth * (window.devicePixelRatio || 1) * renderScaleFor()) / 720;
  return Math.max(3, Math.min(6, Math.ceil(z * 1.4)));
}
const VIEW = { left: -2.0, right: 2.0, top: 2.3, bottom: -1.45, target: 1.0 }; // camera-plane metres
const W = Math.round((VIEW.right - VIEW.left) * UNITS_PER_M * D);
const H = Math.round((VIEW.top - VIEW.bottom) * UNITS_PER_M * D);
const AX = W / 2;
const AY = ((VIEW.top + VIEW.target * Math.cos(ELEV)) / (VIEW.top - VIEW.bottom)) * H; // feet (ground origin)
const FADE = 0.12; // s cross-fade between clips

const search = typeof location === "undefined" ? "" : location.search;
const enabled = !/[?&]hero3d=0\b/.test(search);
const GLB = `hero3d/${/[?&]heroglb=([\w-]+)/.exec(search)?.[1] ?? "hero"}.glb`;

let renderer: THREE.WebGLRenderer | null = null;
let failed = !enabled;
let scene: THREE.Scene;
let envTex: THREE.Texture | null = null; // reflections only: set per material (see SURF env), never as flat scene ambient
let camera: THREE.OrthographicCamera;
let proto: THREE.Object3D | null = null; // armature only (the meshes live in `layers`)
let clips = new Map<string, THREE.AnimationClip>();
/** layer (mesh name in the glb) -> its primitives */
const layers = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; matrix: THREE.Matrix4 }[]>();
let boneNames: string[] = [];
let boneInverses: THREE.Matrix4[] = [];
let bindMatrix = new THREE.Matrix4();
/** look key -> a base mesh of that look (fallback for bases without their own mesh) */
const family = new Map<string, string>();

function init(): boolean {
  if (renderer) return true;
  if (failed || typeof document === "undefined") return false;
  try {
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const gl = cv.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("no webgl2");
    renderer = new THREE.WebGLRenderer({ canvas: cv, context: gl, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // filmic roll-off: the world pass multiplies by the light map and then lifts everything by a third
    // (light.ts), which clipped pale gear (plate, linen) to flat white. Highlights now compress instead.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.shadowMap.enabled = true; // the key light casts the hero's own shadows (arm on chest, pauldron on arm, helm on face)
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (e) {
    console.warn("[hero3d] WebGL unavailable, using 2D heroes", e);
    failed = true;
    return false;
  }
  scene = new THREE.Scene();
  // camera on the (+x, +y) world side (nearer the screen bottom), looking down at ELEV; game (x, y) -> three (x, z)
  camera = new THREE.OrthographicCamera(VIEW.left, VIEW.right, VIEW.top, VIEW.bottom, 0.1, 60);
  const dist = 20;
  const tgt = new THREE.Vector3(0, VIEW.target, 0);
  camera.position.set(tgt.x + (dist * Math.cos(ELEV)) / Math.SQRT2, tgt.y + dist * Math.sin(ELEV), tgt.z + (dist * Math.cos(ELEV)) / Math.SQRT2);
  camera.up.set(0, 1, 0);
  camera.lookAt(tgt);
  // painted-world lighting: warm key from the screen's top-left, cool rim from behind, soft sky/ground
  // ambient, and a dim studio environment so metal has something to reflect (the world light map still
  // darkens the result with everything else)
  const key = new THREE.DirectionalLight(0xffe6c4, 3.4); // top-left FRONT (screen left = world (-x, +z), toward camera = (+x, +z)): lit side, shadow side, dark core
  key.position.set(-2.2, 5, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  const sc = key.shadow.camera;
  sc.left = -1.9;
  sc.right = 1.9;
  sc.top = 2.6;
  sc.bottom = -1.6;
  sc.near = 1;
  sc.far = 14;
  key.shadow.bias = -0.002;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 2.5;
  key.target.position.set(0, 0.9, 0);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x9ab4ff, 1.9);
  rim.position.set(2.5, 2.5, -4.5);
  const fill = new THREE.DirectionalLight(0xb0b8c8, 0.35);
  fill.position.set(4, 1.5, 0.5);
  scene.add(key, rim, fill, new THREE.HemisphereLight(0x8a94a8, 0x4a3e34, 0.8));
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  } catch {
    /* no environment: metals just read a little flatter */
  }
  new GLTFLoader().load(
    GLB,
    (g) => {
      g.scene.updateMatrixWorld(true);
      const meshes: THREE.SkinnedMesh[] = [];
      g.scene.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
      });
      for (const m of meshes) {
        if (!boneNames.length) {
          boneNames = m.skeleton.bones.map((b) => b.name);
          boneInverses = m.skeleton.boneInverses;
          bindMatrix = m.bindMatrix.clone();
        }
        const name = layerOf(m);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const list = layers.get(name) ?? [];
        list.push({ geo: m.geometry, mat: shade(mats[0]), matrix: m.matrixWorld.clone() });
        layers.set(name, list);
        const par = m.parent;
        par?.remove(m);
        if (par && par !== g.scene && !par.children.length && !(par as THREE.Bone).isBone) par.parent?.remove(par);
      }
      for (const b of BASES as unknown as { id: string; look?: string }[]) {
        if (b.look && layers.has(b.id) && !family.has(b.look)) family.set(b.look, b.id);
      }
      clips = new Map(g.animations.map((c) => [c.name, c]));
      proto = g.scene;
    },
    undefined,
    (e) => {
      console.warn(`[hero3d] ${GLB} failed to load, using 2D heroes`, e);
      failed = true;
    },
  );
  return true;
}

/** Layer of a mesh: multi-material meshes load as <layer>_1, <layer>_2, ... primitives. */
function layerOf(o: THREE.Object3D): string {
  return o.name.replace(/_[0-9]+$/, "");
}

/** Surface kind (from the exporter's material name x_<kind>) -> shading; albedo is in the vertex colours. */
/**
 * `grain`: [cells per metre, albedo amplitude, roughness amplitude, vertical stretch] of the procedural
 * surface grain (weave, hide mottling, hammer marks / scratches) the shader adds in rest-pose space.
 */
const SURF: Record<string, { metal: number; rough: number; boost?: number; env?: number; emissive?: number; grain?: [number, number, number, number] }> = {
  skin: { metal: 0, rough: 0.6, env: 0.06, grain: [22, 0.1, 0.12, 1] },
  cloth: { metal: 0, rough: 0.95, env: 0.03, grain: [30, 0.34, 0, 0.3] },
  leather: { metal: 0, rough: 0.58, env: 0.12, grain: [24, 0.34, 0.3, 1] },
  fur: { metal: 0, rough: 1, env: 0.02, grain: [34, 0.45, 0, 0.2] },
  hair: { metal: 0, rough: 0.5, env: 0.12, grain: [40, 0.35, 0.2, 0.15] },
  wood: { metal: 0, rough: 0.75, env: 0.06, grain: [50, 0.3, 0.15, 0.12] },
  bone: { metal: 0, rough: 0.55, env: 0.1, grain: [30, 0.15, 0.15, 1] },
  // metals: darker albedo, more metalness and more environment than before, so plate reads as steel
  // with a dark-to-bright sweep instead of as chalk-white plastic
  metal: { metal: 0.85, rough: 0.36, boost: 0.4, env: 0.5, grain: [20, 0.34, 0.45, 0.3] },
  mail: { metal: 0.6, rough: 0.55, boost: 0.4, env: 0.4, grain: [44, 0.36, 0.3, 1] },
  gold: { metal: 0.9, rough: 0.32, boost: 0.7, env: 0.7, grain: [30, 0.2, 0.3, 0.4] },
  glow: { metal: 0, rough: 0.5, emissive: 1.6 },
  dark: { metal: 0, rough: 1, env: 0 },
  // old glb (before per-base gear)
  linen: { metal: 0, rough: 0.9 },
  wrap: { metal: 0, rough: 0.9 },
  steel: { metal: 0.35, rough: 0.38, boost: 1.25 },
  steel_dark: { metal: 0.3, rough: 0.45, boost: 1.15 },
  brass: { metal: 0.4, rough: 0.4, boost: 1.2 },
};
const EXPOSURE = 0.92;
const SATURATION = 0.78; // the painted world is muted; pure vertex-colour blues / reds / greens read as toy plastic
/** Fresnel rim colour for the hero being rendered (set per render: pale for you, warm red for foes). */
const uRim = { value: new THREE.Color(0.5, 0.58, 0.78) };
const GLSL_GRAIN = `
varying vec3 vRest;
varying float vWy;
uniform vec4 uGrain;
uniform float uGlow;
uniform vec3 uRim;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float grainAt() {
  vec3 q = vRest * uGrain.x * vec3(1.0, uGrain.w, 1.0);
  return vnoise(q) * 0.6 + vnoise(q * 0.31 + 7.3) * 0.4; // fine grain + broad mottling
}
`;
function surface(sh: { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }, grain: [number, number, number, number], glow: number) {
  sh.uniforms.uGrain = { value: new THREE.Vector4(...grain) };
  sh.uniforms.uGlow = { value: glow };
  sh.uniforms.uRim = uRim;
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying float vWy;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;")
    .replace("#include <project_vertex>", "#include <project_vertex>\nvWy = (modelMatrix * vec4(transformed, 1.0)).y;");
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <common>", "#include <common>\n" + GLSL_GRAIN)
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
  float gr = grainAt();
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, ${SATURATION.toFixed(2)});
  diffuseColor.rgb *= 1.0 + (gr - 0.5) * 2.0 * uGrain.y;
  diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 1.05, vWy)); // grounded: legs sink toward the dark floor, chest and head carry the light`,
    )
    .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + (gr - 0.5) * 2.0 * uGrain.z, 0.08, 1.0);")
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
  totalEmissiveRadiance *= mix(vec3(1.0), vColor.rgb, uGlow);
  {
    // fresnel rim on up / left facing edges: separates the hero from dark ground as light on the form, not as a pasted halo
    float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
    totalEmissiveRadiance += uRim * fr * saturate(normal.y * 0.8 - normal.x * 0.5 + 0.35) * (1.0 - uGlow);
  }`,
    );
}
const shaded = new Map<string, THREE.Material>();
function shade(src: THREE.Material): THREE.Material {
  const kind = src.name.replace(/^x_/, "").replace(/\.\d+$/, "");
  let m = shaded.get(kind);
  if (m) return m;
  const s = SURF[kind] ?? { metal: 0, rough: 0.85 };
  const mm = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: s.metal, roughness: s.rough, color: new THREE.Color(1, 1, 1).multiplyScalar(s.boost ?? 1), side: THREE.DoubleSide });
  mm.shadowSide = THREE.DoubleSide;
  mm.envMap = envTex;
  mm.envMapIntensity = s.env ?? 0.05;
  if (s.emissive) {
    // glowing parts (orbs, runes, embers): the vertex colour is the light
    mm.emissive = new THREE.Color(1, 1, 1);
    mm.emissiveIntensity = s.emissive;
  }
  const grain = s.grain ?? [40, 0.15, 0, 1];
  mm.onBeforeCompile = (sh) => surface(sh, grain, s.emissive ? 1 : 0);
  mm.name = kind;
  shaded.set(kind, mm);
  return mm;
}

// ---- per-hero instances ----
interface Inst {
  root: THREE.Object3D;
  skeleton: THREE.Skeleton;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  meshes: Map<string, THREE.Object3D[]>;
  style: string;
  weapon: string;
  cur: string;
  prev: string | null;
  prevT: number;
  curT: number;
  fadeAt: number;
  look: string;
  out: HTMLCanvasElement;
  tmp: HTMLCanvasElement;
  key: string;
  used: number;
  sprite: Sprite;
}
const insts = new Map<string, Inst>();

function makeInst(): Inst {
  const root = cloneSkinned(proto!);
  scene.add(root);
  root.visible = false;
  const byName = new Map<string, THREE.Object3D>();
  root.traverse((o) => byName.set(o.name, o));
  const skeleton = new THREE.Skeleton(
    boneNames.map((n) => byName.get(n) as THREE.Bone),
    boneInverses,
  );
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  return {
    root, skeleton, mixer: new THREE.AnimationMixer(root), actions: new Map(), meshes: new Map(), style: "@1h", weapon: "",
    cur: "", prev: null, prevT: 0, curT: 0, fadeAt: -1, look: "", out, tmp, key: "", used: 0, sprite: { cv: out, ax: AX, ay: AY, d: D },
  };
}

function action(it: Inst, name: string): THREE.AnimationAction | null {
  let a = it.actions.get(name);
  if (a) return a;
  const c = clips.get(name);
  if (!c) return null;
  a = it.mixer.clipAction(c);
  a.play();
  a.setEffectiveWeight(0);
  a.paused = true;
  it.actions.set(name, a);
  return a;
}

/** Mesh layer shown for a slot: the base's own mesh, else one of its look family, else the old look meshes. */
function resolve(slot: Slot, look: Look): string | undefined {
  const key = look[slot] as string;
  if (!key) return undefined;
  const base = look.base?.[slot];
  if (base && layers.has(base)) return base;
  const fam = family.get(key);
  if (fam) return fam;
  const old = (LOOK_MESH[key] ?? [key]).find((c) => layers.has(c));
  return old ?? (slot === "weapon" && layers.has("greataxe") ? "greataxe" : undefined);
}

function setLook(it: Inst, look: Look, code: string) {
  if (it.look === code) return;
  it.look = code;
  it.weapon = look.weapon;
  it.style = styleOf(look.weapon);
  const show = new Set<string>(["base"]);
  // starter rags and hair give way to the gear that covers them
  if (!look.helmet || look.helmet === "circlet") show.add("hair");
  if (!look.body) show.add("rag_top");
  if (!look.body && !look.belt) show.add("rag_waist");
  if (!look.gloves) show.add("rag_arm");
  if (!look.boots) show.add("rag_shin");
  for (const slot of SLOTS) {
    const m = resolve(slot, look);
    if (m) show.add(m);
  }
  for (const name of show) {
    if (it.meshes.has(name)) continue;
    const made: THREE.Object3D[] = [];
    for (const p of layers.get(name) ?? []) {
      const sm = new THREE.SkinnedMesh(p.geo, p.mat);
      sm.frustumCulled = false;
      sm.castShadow = true;
      sm.receiveShadow = true;
      p.matrix.decompose(sm.position, sm.quaternion, sm.scale);
      it.root.add(sm);
      sm.bind(it.skeleton, bindMatrix);
      made.push(sm);
    }
    it.meshes.set(name, made);
  }
  for (const [n, os] of it.meshes) for (const o of os) o.visible = show.has(n);
}

/** Clips a bow / crossbow replaces with its shot. */
const ONE_SHOT = new Set(["attack2", "thrust", "slam", "spin", "throw", "vault"]);

/** Game anim + frame -> [clip, 0..1 progress]. */
function clipFor(anim: HeroAnim, f: number, weapon: string): [string, number] {
  switch (anim) {
    case "idle":
      return ["idle", (((f / 4) % 1) + 1) % 1];
    case "run":
      return ["run", (((f / 8) % 1) + 1) % 1];
    case "attack":
    case "attack2": {
      // game: 0..6 with the commit at 3; clips: contact at 4/7
      const p = Math.min(1, Math.max(0, f / 6));
      return [THRUST[weapon]?.includes(anim) ? "thrust" : anim, p < 0.5 ? (p / 0.5) * (4 / 7) : 4 / 7 + ((p - 0.5) / 0.5) * (3 / 7)];
    }
    case "slam":
    case "leap": {
      const p = Math.min(1, f / Math.max(1, HERO_FRAMES[anim]));
      return ["attack", p];
    }
    case "roll":
      return ["roll", Math.min(1, f / 6)];
    case "death":
      return ["die", Math.min(1, f / 5)];
    case "flinch":
      return ["hit", Math.min(1, f / 3)];
    case "stagger":
      return ["hit", Math.min(1, f / 6)];
    default:
      return ["cast", Math.min(1, f / Math.max(1, HERO_FRAMES[anim] ?? 6))];
  }
}

function now() {
  return performance.now() / 1000;
}

/**
 * 3D hero sprite for one hero (or corpse) `id`. `angle` is the continuous world aim angle (radians,
 * game x/y). `foe` marks another player (warm rim instead of your own pale one). Null while loading /
 * without WebGL: the caller falls back to the 2D hero chain.
 */
export function hero3dFrame(id: string, look: Look, lookCode: string, angle: number, anim: HeroAnim, frame: number, flash = false, foe = false, hint?: { clip: string; prog: number; loop?: boolean }): Sprite | null {
  if (!init() || !proto || !renderer) return null;
  let it = insts.get(id);
  if (!it) {
    it = makeInst();
    insts.set(id, it);
  }
  const t = now();
  it.used = t;
  setLook(it, look, lookCode);
  const [base, p] = hint ? [hint.clip, hint.prog] : clipFor(anim, frame, it.weapon);
  // bows / crossbows have one attack (it also stands in for the melee skill clips they lack); styles a glb lacks fall back to the two-handed clips
  const clip = [base + it.style, (ONE_SHOT.has(base) ? "attack" : base) + it.style, base, hint ? "cast" + it.style : "attack", "attack"].find((n) => clips.has(n));
  const act = clip ? action(it, clip) : null;
  if (!clip || !act) return null;
  if (clip !== it.cur) {
    if (it.cur) {
      it.prev = it.cur;
      it.prevT = it.curT;
      it.fadeAt = t;
    }
    it.cur = clip;
  }
  const loop = base === "idle" || base === "run" || !!hint?.loop;
  const dur = act.getClip().duration;
  it.curT = loop ? p * dur : Math.min(dur - 1e-4, p * dur);
  const fw = it.prev && t - it.fadeAt < FADE ? 1 - (t - it.fadeAt) / FADE : 0;
  if (!fw) it.prev = null;
  const qa = Math.round(angle * 64) / 64;
  const key = `${it.look}|${clip}|${it.curT.toFixed(3)}|${it.prev ?? ""}${fw.toFixed(2)}|${qa}|${flash ? 1 : 0}${foe ? 1 : 0}`;
  if (key === it.key) return it.sprite;
  it.key = key;
  const t0 = performance.now();
  for (const [n, a] of it.actions) {
    if (n === clip) {
      a.setEffectiveWeight(1 - fw);
      a.time = it.curT;
    } else if (n === it.prev) {
      a.setEffectiveWeight(fw);
      a.time = it.prevT;
    } else a.setEffectiveWeight(0);
  }
  it.mixer.update(0);
  // model faces +Z; game aim (cos a, sin a) -> three (cos a, 0, sin a)
  it.root.rotation.y = Math.atan2(Math.cos(qa), Math.sin(qa));
  it.root.visible = true;
  if (foe) uRim.value.setRGB(0.95, 0.3, 0.2);
  else uRim.value.setRGB(0.5, 0.58, 0.78);
  renderer.render(scene, camera);
  it.root.visible = false;
  // copy + dark outline (8 offsets of the silhouette) + hit flash
  const tg = it.tmp.getContext("2d")!;
  tg.clearRect(0, 0, W, H);
  tg.drawImage(renderer.domElement, 0, 0);
  const g = it.out.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  const o = Math.max(1, D * 0.45);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.drawImage(it.tmp, Math.cos(a) * o, Math.sin(a) * o);
  }
  g.globalCompositeOperation = "source-in";
  g.fillStyle = foe ? "rgba(34,6,4,0.92)" : "rgba(6,5,6,0.92)";
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  g.drawImage(it.tmp, 0, 0);
  // rim light: a thin edge on the upper-left of the silhouette (the part of the body that the same
  // body shifted down-right does not cover), so the hero separates from dark ground. Yours is pale
  // blue-white, other players' is a warm red: friend / foe reads without the name plate.
  const rg = rimCanvas().getContext("2d")!;
  rg.globalCompositeOperation = "source-over";
  rg.clearRect(0, 0, W, H);
  rg.drawImage(it.tmp, 0, 0);
  rg.globalCompositeOperation = "destination-out";
  rg.drawImage(it.tmp, RIM_PX, RIM_PX * 1.4);
  rg.globalCompositeOperation = "source-in";
  rg.fillStyle = foe ? "rgb(255,120,84)" : "rgb(214,228,255)";
  rg.fillRect(0, 0, W, H);
  g.globalAlpha = foe ? 0.45 : 0.22; // the shader's fresnel rim does most of the separation now; this only keeps a hairline on flat-on edges
  g.drawImage(rimCanvas(), 0, 0);
  g.globalAlpha = 1;
  if (flash) {
    // hit flash: a light warm tint that keeps the shading readable (the caller keeps it short and
    // never re-triggers it while one is showing; 55% white turned the hero into a blob under fast hits)
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(255,236,214,0.3)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }
  perf.n++;
  perf.ms += performance.now() - t0;
  gc(t);
  return it.sprite;
}

/** dev: hero redraws and the ms they took (pose + WebGL render + 2D outline / rim passes) */
const perf = { n: 0, ms: 0 };
const RIM_PX = Math.max(1, D * 0.4);
let rimCv: HTMLCanvasElement | null = null;
function rimCanvas(): HTMLCanvasElement {
  if (!rimCv) {
    rimCv = document.createElement("canvas");
    rimCv.width = W;
    rimCv.height = H;
  }
  return rimCv;
}

let lastGc = 0;
function gc(t: number) {
  if (t - lastGc < 2) return;
  lastGc = t;
  for (const [id, it] of insts) {
    if (t - it.used < 5) continue;
    scene.remove(it.root);
    it.mixer.stopAllAction();
    it.mixer.uncacheRoot(it.root);
    it.skeleton.dispose();
    insts.delete(id);
  }
}

// dev inspection hook (read-only use from the console)
if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__hero3d = { insts, layers, clips: () => clips, frame: hero3dFrame, perf, get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, W, H, AX, AY, D };
