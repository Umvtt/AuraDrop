// Vehicle specs for the 3D Workshop: what a tank, plane or car is made of,
// the fields the Workshop shows for each, and validation for files.
//
// Units: metres for sizes, millimetres for armour, degrees for angles.

export const VEHICLE_VERSION = 2;

export const NATIONS = [
  { id: "usa", label: "USA", flag: "🇺🇸" },
  { id: "germany", label: "Germany", flag: "🇩🇪" },
  { id: "ussr", label: "USSR", flag: "☭" },
  { id: "uk", label: "Great Britain", flag: "🇬🇧" },
  { id: "japan", label: "Japan", flag: "🇯🇵" },
  { id: "italy", label: "Italy", flag: "🇮🇹" },
  { id: "france", label: "France", flag: "🇫🇷" },
  { id: "sweden", label: "Sweden", flag: "🇸🇪" },
  { id: "aura", label: "Aura Federation", flag: "💜" },
];

export const CAMOS = [
  ["none", "Plain"],
  ["twotone", "Two-tone"],
  ["ambush", "Ambush (three-tone)"],
  ["stripes", "Tiger stripes"],
  ["splinter", "Splinter"],
  ["winter", "Winter whitewash"],
  ["digital", "Digital"],
  ["desert", "Desert blotches"],
  ["racing", "Racing stripes"],
];

/** One-click paint schemes. */
export const PAINTS = [
  { id: "olive", label: "Olive drab", base: "#4a4f2a", colors: ["#3a3f1e", "#5d5236", "#24271a"], camo: "none" },
  { id: "dunkelgelb", label: "Dunkelgelb ambush", base: "#a38f5c", colors: ["#4b5631", "#5e3a25", "#cdbb88"], camo: "ambush" },
  { id: "dunkelgelb2", label: "Dunkelgelb two-tone", base: "#a38f5c", colors: ["#4b5631", "#5e3a25", "#cdbb88"], camo: "twotone" },
  { id: "4bo", label: "Soviet 4BO green", base: "#47522f", colors: ["#353f22", "#5f6640", "#262c18"], camo: "none" },
  { id: "winter", label: "Winter whitewash", base: "#dfe2dc", colors: ["#47522f", "#c4c9c2", "#9aa39a"], camo: "winter" },
  { id: "desert", label: "Desert tan", base: "#b59a68", colors: ["#8f7346", "#6c7550", "#d6bf90"], camo: "desert" },
  { id: "caunter", label: "Splinter", base: "#a39f80", colors: ["#5a614a", "#3a4133", "#c2bd9c"], camo: "splinter" },
  { id: "nato", label: "NATO three-tone", base: "#45543a", colors: ["#25261f", "#5f4430", "#33402a"], camo: "ambush" },
  { id: "digital", label: "Digital woodland", base: "#56644a", colors: ["#353f2f", "#7d7254", "#1f251b"], camo: "digital" },
  { id: "raf", label: "RAF green / grey", base: "#646650", colors: ["#3f4c32", "#8a8e7a", "#323b28"], camo: "twotone" },
  { id: "rlm", label: "Luftwaffe grey", base: "#858e94", colors: ["#5a6458", "#6a7066", "#b0b8be"], camo: "splinter" },
  { id: "ijn", label: "IJN grey-green", base: "#a3a48a", colors: ["#8a8b75", "#bdbea8", "#717260"], camo: "none" },
  { id: "silver", label: "Bare metal", base: "#c3c9d1", colors: ["#a5adb7", "#e3e7ec", "#8b929b"], camo: "none", metal: true },
  { id: "navy", label: "Navy blue", base: "#2a3a56", colors: ["#1c283e", "#4f6589", "#101828"], camo: "none" },
  { id: "racing-red", label: "Racing red", base: "#b80f25", colors: ["#f1f2f0", "#111111", "#7d0a1a"], camo: "racing", gloss: true },
  { id: "black", label: "Gloss black", base: "#121316", colors: ["#f1f2f0", "#333333", "#000000"], camo: "racing", gloss: true },
  { id: "aura", label: "Aura neon", base: "#24163f", colors: ["#a78bfa", "#22d3ee", "#ec4899"], camo: "stripes", gloss: true },
];

// ---------------------------------------------------------------------------
// Field definitions. The Workshop builds its panels from these.
// [key, label, type, …] — type: range | armor | slope | select | toggle | color | text
// ---------------------------------------------------------------------------

const R = (k, label, min, max, step, unit, hint) => ({ k, label, type: "range", min, max, step, unit, hint });
const A = (k, label, max = 300, hint) => ({ k, label, type: "armor", min: 0, max, step: 1, unit: "mm", hint });
const S = (k, label, hint) => ({ k, label, type: "slope", min: 0, max: 85, step: 1, unit: "°", hint });
const SEL = (k, label, options, hint) => ({ k, label, type: "select", options, hint });
const T = (k, label, hint) => ({ k, label, type: "toggle", hint });
const C = (k, label) => ({ k, label, type: "color" });
const TX = (k, label, max = 20) => ({ k, label, type: "text", max });

export const HULL_STYLES = [
  ["boxy", "Boxy superstructure (Tiger, KV)"],
  ["sloped", "Long sloped glacis (Panther, T-34)"],
  ["rounded", "Rounded cast nose (Sherman)"],
  ["tall", "Tall slab sides (Churchill)"],
  ["modern", "Modern low hull"],
];
export const TURRET_STYLES = [
  ["horseshoe", "Horseshoe (Tiger)"],
  ["sloped", "Sloped sides (Panther)"],
  ["cast", "Cast dome (T-34-85, IS-2)"],
  ["round", "Round cast (Sherman)"],
  ["box", "Box (KV-1, Churchill)"],
  ["flat", "Flat & wide (Abrams, Leopard 2)"],
  ["wedge", "Arrow wedge (Leopard 2A5+)"],
  ["none", "No turret (tank destroyer)"],
];
export const WHEEL_STYLES = [
  ["interleaved", "Interleaved (Tiger, Panther)"],
  ["christie", "Big Christie wheels (T-34)"],
  ["bogie", "VVSS bogies (Sherman)"],
  ["torsion", "Small wheels + rollers (KV, IS, Pershing)"],
  ["churchill", "Many small bogies (Churchill)"],
  ["modern", "Modern rubber-tyred"],
];
export const SHELLS = [
  ["AP", "AP (solid shot)"],
  ["APHE", "APHE"],
  ["APCBC", "APCBC"],
  ["APDS", "APDS"],
  ["APFSDS", "APFSDS (dart)"],
  ["HEAT", "HEAT"],
  ["HE", "HE"],
];
export const CREW_ROLES = [
  ["commander", "Commander", "#facc15"],
  ["gunner", "Gunner", "#f87171"],
  ["loader", "Loader", "#fb923c"],
  ["driver", "Driver", "#4ade80"],
  ["radio", "Radio operator / MG", "#60a5fa"],
  ["pilot", "Pilot", "#22d3ee"],
  ["rear-gunner", "Rear gunner", "#c084fc"],
];

const ENGINE_KINDS = [
  ["petrol", "Petrol"],
  ["diesel", "Diesel"],
  ["turbine", "Gas turbine"],
];

export const TANK_FIELDS = [
  {
    id: "hull",
    title: "Hull",
    icon: "🛡️",
    fields: [
      SEL("hull.style", "Hull shape", HULL_STYLES),
      R("hull.length", "Length", 3.5, 10, 0.05, "m"),
      R("hull.width", "Width (over the tracks)", 2, 4.2, 0.05, "m"),
      R("hull.height", "Hull height", 1.2, 2.8, 0.05, "m"),
      A("hull.front", "Upper front plate", 700),
      S("hull.frontSlope", "Upper plate angle", "0° is vertical. Angled armour is thicker for a shell flying flat."),
      A("hull.lower", "Lower front plate", 700),
      S("hull.lowerSlope", "Lower plate angle"),
      A("hull.side", "Side armour", 200),
      S("hull.sideSlope", "Side angle", "Panthers had sloped sides"),
      A("hull.rear", "Rear armour", 200),
      A("hull.roof", "Roof", 120),
      T("hull.zimmerit", "Zimmerit coating", "The ridged anti-mine paste on German tanks"),
      T("hull.bolts", "Bolts & weld seams"),
    ],
  },
  {
    id: "turret",
    title: "Turret",
    icon: "🎯",
    fields: [
      SEL("turret.style", "Turret shape", TURRET_STYLES),
      R("turret.at", "Position along hull", 0.25, 0.75, 0.01),
      R("turret.length", "Length", 1.2, 4.5, 0.05, "m"),
      R("turret.width", "Width", 1.2, 3.8, 0.05, "m"),
      R("turret.height", "Height", 0.5, 1.4, 0.02, "m"),
      A("turret.front", "Turret front", 900),
      S("turret.frontSlope", "Front angle"),
      A("turret.side", "Turret side", 300),
      A("turret.rear", "Turret rear", 300),
      A("turret.roof", "Turret roof", 120),
      SEL("turret.cupola", "Commander's cupola", [["blocks", "Vision blocks"], ["hatch", "Simple hatch"], ["mg", "With machine gun"], ["modern", "Modern sight"], ["none", "None"]]),
      SEL("turret.bustle", "Rear stowage", [["none", "None"], ["bin", "Stowage bin"], ["basket", "Basket"], ["modern", "Modern bustle"]]),
      R("turret.smoke", "Smoke launchers per side", 0, 6, 1),
      R("turret.spareLinks", "Spare track links per side", 0, 8, 1),
    ],
  },
  {
    id: "gun",
    title: "Main gun",
    icon: "💥",
    fields: [
      R("gun.caliber", "Calibre", 20, 155, 1, "mm"),
      R("gun.length", "Barrel length", 15, 75, 1, "calibres", "L/56 means 56 times the calibre"),
      SEL("gun.shell", "Main shell", SHELLS),
      SEL("gun.loading", "Loading", [["unitary", "One-piece rounds"], ["separate", "Two-piece (slow)"], ["autoloader", "Autoloader"]]),
      SEL("gun.brake", "Muzzle brake", [["double", "Double baffle"], ["single", "Single baffle"], ["slotted", "Slotted"], ["none", "None"]]),
      SEL("gun.mantlet", "Mantlet", [["box", "Box"], ["saukopf", "Rounded (Saukopf)"], ["cast", "Cast ball"], ["slab", "Modern slab"]]),
      A("gun.mantletArmor", "Mantlet armour", 600),
      T("gun.evacuator", "Fume extractor"),
      T("gun.sleeve", "Thermal sleeve"),
      R("gun.depression", "Gun depression", 0, 15, 1, "°"),
      R("gun.kills", "Kill rings on barrel", 0, 30, 1),
    ],
  },
  {
    id: "gear",
    title: "Tracks & wheels",
    icon: "⚙️",
    fields: [
      SEL("gear.style", "Running gear", WHEEL_STYLES),
      R("gear.wheels", "Road wheels per side", 3, 12, 1),
      R("gear.wheelSize", "Wheel diameter", 0.3, 1.0, 0.01, "m"),
      R("gear.rollers", "Return rollers", 0, 6, 1),
      SEL("gear.drive", "Drive sprocket", [["front", "Front"], ["rear", "Rear"]]),
      R("gear.trackWidth", "Track width", 0.3, 0.95, 0.01, "m"),
      SEL("gear.skirts", "Side skirts", [["none", "None"], ["panels", "Steel panels (Schürzen)"], ["rubber", "Rubber flaps"], ["armour", "Armoured skirts"], ["era", "Reactive armour blocks"]]),
      A("gear.skirtArmor", "Skirt thickness", 120),
    ],
  },
  {
    id: "engine",
    title: "Engine & crew",
    icon: "🔧",
    fields: [
      SEL("engine.kind", "Engine", ENGINE_KINDS),
      R("engine.hp", "Power", 50, 2000, 10, "hp"),
      R("engine.fuel", "Fuel", 50, 2500, 10, "L"),
      R("ammo", "Ammo stowed", 4, 160, 1, "rounds"),
      SEL("crewPreset", "Crew", [["5", "5: commander, gunner, loader, driver, radio"], ["4", "4: no radio operator"], ["3", "3: autoloader (no loader)"], ["2", "2: tiny tank"]]),
    ],
  },
  {
    id: "details",
    title: "Details",
    icon: "🧰",
    fields: [
      SEL("details.exhaust", "Exhausts", [["mufflers", "Mufflers with guards"], ["pipes", "Pipes"], ["deflector", "Deflector"], ["grille", "Modern grille"]]),
      T("details.headlights", "Headlights"),
      T("details.hullMg", "Hull machine gun"),
      T("details.cables", "Tow cables"),
      T("details.tools", "Shovel, axe & tools"),
      T("details.fenders", "Fenders & mudguards"),
      R("details.antennas", "Antennas", 0, 3, 1),
      SEL("details.stowage", "Stowage", [["none", "Clean"], ["field", "Field kit (jerrycans, crates)"], ["logs", "Unditching log"], ["heavy", "Everything (logs, cans, tarp)"]]),
      T("details.sandbags", "Sandbags on the front"),
      T("details.glacisTracks", "Spare tracks on the front"),
      T("details.fuelDrums", "External fuel drums"),
      T("details.grabRails", "Grab rails"),
      T("details.applique", "Appliqué armour patches"),
      T("details.spareWheels", "Spare road wheels"),
    ],
  },
];

export const PLANE_FIELDS = [
  {
    id: "fuselage",
    title: "Fuselage",
    icon: "✈️",
    fields: [
      SEL("fuselage.nose", "Engine & nose", [["inline", "Inline engine (pointed nose)"], ["radial", "Radial engine (round nose)"], ["jet", "Jet (nose intake)"]]),
      R("fuselage.length", "Length", 6, 22, 0.05, "m"),
      R("fuselage.width", "Width", 0.8, 3, 0.02, "m"),
      R("fuselage.height", "Height", 0.9, 3.2, 0.02, "m"),
      R("fuselage.tail", "Tail slimness", 0.1, 0.6, 0.01),
      R("fuselage.hump", "Spine hump", 0, 0.5, 0.01),
      T("fuselage.scoop", "Belly radiator scoop (P-51)"),
      SEL("fuselage.canopy", "Canopy", [["bubble", "Bubble"], ["framed", "Framed"], ["razorback", "Razorback"], ["greenhouse", "Long greenhouse (two seats)"]]),
      R("fuselage.canopyAt", "Cockpit position", 0.3, 0.75, 0.01),
      A("fuselage.armor", "Cockpit armour", 30),
    ],
  },
  {
    id: "wing",
    title: "Wings & tail",
    icon: "🪽",
    fields: [
      SEL("wing.plan", "Wing shape", [["elliptical", "Elliptical (Spitfire)"], ["tapered", "Tapered"], ["swept", "Swept (jet)"], ["delta", "Delta"], ["gull", "Inverted gull (Stuka, Corsair)"]]),
      R("wing.span", "Wingspan", 6, 40, 0.1, "m"),
      R("wing.root", "Root chord", 1, 6, 0.05, "m"),
      R("wing.tip", "Tip chord", 0.3, 4, 0.05, "m"),
      R("wing.sweep", "Sweep", 0, 60, 1, "°"),
      R("wing.dihedral", "Dihedral", -5, 12, 0.5, "°"),
      R("wing.at", "Wing position", 0.25, 0.7, 0.01),
      SEL("wing.mount", "Mounted", [["low", "Low wing"], ["mid", "Mid wing"], ["high", "High wing"]]),
      SEL("wing.profile", "Airfoil", [["classic", "Classic"], ["laminar", "Laminar flow"], ["thick", "Thick"]]),
      SEL("tail.fin", "Tail fin", [["round", "Rounded"], ["angular", "Angular"], ["tall", "Tall with fillet"], ["swept", "Swept"]]),
      R("tail.finHeight", "Fin height", 0.8, 4, 0.05, "m"),
      R("tail.stabSpan", "Tailplane span", 2, 12, 0.1, "m"),
    ],
  },
  {
    id: "engine",
    title: "Engine & propeller",
    icon: "🌀",
    fields: [
      R("engine.hp", "Power (piston)", 300, 3500, 10, "hp"),
      R("engine.thrust", "Thrust (jet)", 5, 150, 0.5, "kN"),
      SEL("engine.charger", "Supercharger", [["single", "Single stage"], ["two", "Two-stage"], ["turbo", "Turbocharger"], ["none", "None"]]),
      R("prop.blades", "Propeller blades", 2, 6, 1),
      R("prop.diameter", "Propeller diameter", 1.8, 4.5, 0.05, "m"),
      C("prop.spinner", "Spinner colour"),
      SEL("prop.spinStyle", "Spinner", [["pointed", "Pointed"], ["round", "Round"], ["spiral", "Spiral stripe"]]),
      R("engine.fuel", "Fuel", 100, 6000, 10, "L"),
    ],
  },
  {
    id: "weapons",
    title: "Weapons",
    icon: "💣",
    fields: [
      R("guns.wingCount", "Wing guns", 0, 8, 1),
      R("guns.wingCal", "Wing gun calibre", 7, 37, 0.1, "mm"),
      R("guns.noseCount", "Nose guns", 0, 6, 1),
      R("guns.noseCal", "Nose gun calibre", 7, 37, 0.1, "mm"),
      R("stores.bombs", "Bombs", 0, 8, 1),
      R("stores.bombKg", "Bomb size", 25, 1000, 25, "kg"),
      R("stores.rockets", "Rockets", 0, 16, 1),
      T("stores.droptank", "Drop tank"),
      T("crew.gunner", "Rear gunner"),
    ],
  },
  {
    id: "details",
    title: "Details",
    icon: "🧰",
    fields: [
      SEL("gear.type", "Landing gear", [["retracted", "Retracted (flying)"], ["down", "Down"], ["fixed", "Fixed with spats"]]),
      T("details.exhaustFlames", "Exhaust flames"),
      T("details.antenna", "Antenna mast & wire"),
      T("details.sharkMouth", "Shark mouth"),
      SEL("details.noseColor", "Nose markings", [["none", "None"], ["yellow", "Yellow nose"], ["red", "Red spinner & band"], ["checker", "Checkerboard"], ["invasion", "Invasion stripes"]]),
    ],
  },
];

export const CAR_FIELDS = [
  {
    id: "body",
    title: "Body",
    icon: "🏎️",
    fields: [
      SEL("body.style", "Style", [["sports", "Sports coupé"], ["super", "Supercar"], ["muscle", "Muscle car"], ["sedan", "Saloon"], ["hatch", "Hatchback"], ["rally", "Rally car"], ["jeep", "Military jeep"], ["pickup", "Pickup"], ["f1", "Open-wheel racer"]]),
      R("body.length", "Length", 2.8, 6, 0.05, "m"),
      R("body.width", "Width", 1.4, 2.3, 0.02, "m"),
      R("body.height", "Height", 0.9, 2, 0.02, "m"),
      R("body.wheelbase", "Wheelbase", 0.5, 0.7, 0.01),
      R("body.wheelSize", "Wheel size", 0.5, 1.0, 0.01, "m"),
      SEL("body.rims", "Rims", [["sport", "5-spoke"], ["multi", "Multi-spoke"], ["steel", "Steel"], ["deep", "Deep dish"], ["offroad", "Off-road"]]),
      SEL("body.spoiler", "Spoiler", [["none", "None"], ["lip", "Lip"], ["ducktail", "Duck tail"], ["wing", "Big wing"]]),
      T("body.splitter", "Front splitter"),
      T("body.roofScoop", "Roof scoop / light bar"),
    ],
  },
  {
    id: "engine",
    title: "Engine",
    icon: "🔥",
    fields: [R("engine.hp", "Power", 40, 2000, 10, "hp"), T("engine.nitro", "Nitro"), T("engine.flames", "Exhaust flames"), SEL("engine.layout", "Engine at", [["front", "Front"], ["mid", "Middle"], ["rear", "Rear"]])],
  },
];

export const PAINT_FIELDS = [
  {
    id: "paint",
    title: "Paint & camo",
    icon: "🎨",
    fields: [
      C("paint.base", "Base colour"),
      SEL("paint.camo", "Pattern", CAMOS),
      C("paint.c1", "Pattern colour 1"),
      C("paint.c2", "Pattern colour 2"),
      C("paint.c3", "Pattern colour 3"),
      R("paint.scale", "Pattern size", 0.3, 3, 0.05),
      R("paint.wear", "Mud & wear", 0, 1, 0.01),
      R("paint.gloss", "Gloss", 0, 1, 0.01),
    ],
  },
  {
    id: "markings",
    title: "Markings",
    icon: "🏷️",
    fields: [
      SEL("markings.insignia", "National marking", [["auto", "Match the nation"], ["usstar", "US star"], ["cross", "Balkenkreuz"], ["redstar", "Red star"], ["roundel", "RAF roundel"], ["roundel-fr", "French roundel"], ["roundel-it", "Italian roundel"], ["hinomaru", "Hinomaru"], ["crowns", "Three crowns"], ["aura", "Aura"], ["none", "None"]]),
      TX("markings.number", "Number / code"),
      C("markings.numberColor", "Number colour"),
      C("markings.outline", "Number outline"),
      SEL("markings.font", "Number font", [["stencil", "Stencil"], ["block", "Block"], ["script", "Script"], ["pixel", "Pixel"]]),
      TX("markings.slogan", "Slogan / name", 28),
      R("markings.kills", "Kill marks", 0, 40, 1),
    ],
  },
];

export const ANIM_FIELDS = [
  {
    id: "anim",
    title: "Animation",
    icon: "🎬",
    fields: [
      T("anim.drive", "Drive (tracks, wheels, propeller)"),
      R("anim.speed", "Speed", 0, 3, 0.05),
      SEL("anim.turret", "Turret", [["none", "Still"], ["scan", "Scan left and right"], ["spin", "Full 360° turns"], ["aim", "Aim at the camera"]]),
      SEL("anim.gun", "Gun", [["none", "Still"], ["recoil", "Fire every few seconds"], ["elevate", "Elevate up and down"]]),
      T("anim.bob", "Suspension bounce"),
      T("anim.smoke", "Exhaust smoke"),
    ],
  },
];

export function fieldsFor(kind) {
  return [...(kind === "plane" ? PLANE_FIELDS : kind === "car" ? CAR_FIELDS : TANK_FIELDS), ...PAINT_FIELDS, ...ANIM_FIELDS];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const TANK_DEFAULTS = {
  hull: { style: "boxy", length: 6.3, width: 3.5, height: 1.9, front: 100, frontSlope: 9, lower: 100, lowerSlope: 25, side: 80, sideSlope: 0, rear: 80, roof: 25, zimmerit: false, bolts: true },
  turret: { style: "horseshoe", at: 0.48, length: 2.9, width: 2.4, height: 0.9, front: 100, frontSlope: 0, side: 80, rear: 80, roof: 25, cupola: "blocks", bustle: "bin", smoke: 3, spareLinks: 4 },
  gun: { caliber: 88, length: 56, shell: "APCBC", loading: "unitary", brake: "double", mantlet: "box", mantletArmor: 120, evacuator: false, sleeve: false, depression: 8, kills: 0 },
  gear: { style: "interleaved", wheels: 8, wheelSize: 0.8, rollers: 0, drive: "front", trackWidth: 0.72, skirts: "none", skirtArmor: 5 },
  engine: { kind: "petrol", hp: 700, fuel: 540 },
  ammo: 92,
  crewPreset: "5",
  details: { exhaust: "mufflers", headlights: true, hullMg: true, cables: true, tools: true, fenders: true, antennas: 1, stowage: "none", sandbags: false, glacisTracks: false, fuelDrums: false, grabRails: true, applique: false, spareWheels: false },
};

export const PLANE_DEFAULTS = {
  fuselage: { nose: "inline", length: 9.1, width: 1.0, height: 1.3, tail: 0.3, hump: 0.15, scoop: false, canopy: "bubble", canopyAt: 0.52, armor: 8 },
  wing: { plan: "elliptical", span: 11.2, root: 2.5, tip: 0.9, sweep: 0, dihedral: 6, at: 0.45, mount: "low", profile: "classic" },
  tail: { fin: "round", finHeight: 1.5, stabSpan: 3.2 },
  engine: { hp: 1470, thrust: 26, charger: "single", fuel: 386, kind: "piston" },
  prop: { blades: 3, diameter: 3.3, spinner: "#2a2d31", spinStyle: "pointed" },
  guns: { wingCount: 4, wingCal: 12.7, noseCount: 0, noseCal: 7.92 },
  stores: { bombs: 0, bombKg: 250, rockets: 0, droptank: false },
  crew: { gunner: false },
  gear: { type: "retracted" },
  details: { exhaustFlames: true, antenna: true, sharkMouth: false, noseColor: "none" },
};

export const CAR_DEFAULTS = {
  body: { style: "sports", length: 4.5, width: 1.9, height: 1.3, wheelbase: 0.6, wheelSize: 0.68, rims: "sport", spoiler: "lip", splitter: false, roofScoop: false },
  engine: { hp: 450, nitro: false, flames: false, layout: "front" },
};

const SHARED = {
  paint: { base: "#4a4f2a", camo: "none", c1: "#3a3f1e", c2: "#5d5236", c3: "#24271a", scale: 1, wear: 0.3, gloss: 0.1, seed: 7 },
  markings: { insignia: "auto", number: "", numberColor: "#f1f2f0", outline: "#111111", font: "stencil", slogan: "", kills: 0 },
  anim: { drive: true, speed: 1, turret: "scan", gun: "recoil", bob: false, smoke: true },
};

export const KINDS = [
  { id: "tank", label: "Tank", defaults: TANK_DEFAULTS },
  { id: "plane", label: "Plane", defaults: PLANE_DEFAULTS },
  { id: "car", label: "Car", defaults: CAR_DEFAULTS },
];

let counter = 0;
export const vehicleId = () => `v${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const addonId = () => `a${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function createVehicle(kind = "tank", extra = {}) {
  const k = KINDS.find((x) => x.id === kind) ?? KINDS[0];
  const v = {
    v: VEHICLE_VERSION,
    id: vehicleId(),
    name: `My ${k.label.toLowerCase()}`,
    kind: k.id,
    nation: "usa",
    preset: null,
    approx: false,
    spec: structuredClone({ ...k.defaults, ...SHARED }),
    addons: [],
  };
  return deepMerge(v, extra);
}

export function deepMerge(target, patch) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, val] of Object.entries(patch ?? {})) {
    out[key] = val && typeof val === "object" && !Array.isArray(val) && target?.[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? deepMerge(target[key], val) : val;
  }
  return out;
}

export function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split(".");
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] ?? {}) };
    cur = cur[keys[i]];
  }
  cur[keys.at(-1)] = value;
  return out;
}

// ---------------------------------------------------------------------------
// Add-ons: extra parts placed anywhere on the vehicle
// ---------------------------------------------------------------------------

export const ADDONS = [
  { id: "box", label: "Box", cat: "Shapes", size: [0.4, 0.3, 0.4] },
  { id: "cylinder", label: "Cylinder", cat: "Shapes", size: [0.25, 0.5, 0.25] },
  { id: "sphere", label: "Sphere", cat: "Shapes", size: [0.3, 0.3, 0.3] },
  { id: "wedge", label: "Wedge", cat: "Shapes", size: [0.5, 0.3, 0.5] },
  { id: "plate", label: "Armour plate", cat: "Armour", size: [0.8, 0.6, 0.05], armor: 30 },
  { id: "era", label: "Reactive armour block", cat: "Armour", size: [0.3, 0.12, 0.25], armor: 120 },
  { id: "sandbags", label: "Sandbags", cat: "Armour", size: [0.5, 0.2, 0.3] },
  { id: "spare", label: "Spare track links", cat: "Stowage", size: [0.5, 0.5, 0.05] },
  { id: "jerrycan", label: "Jerrycan", cat: "Stowage", size: [0.16, 0.34, 0.24] },
  { id: "crate", label: "Ammo crate", cat: "Stowage", size: [0.5, 0.25, 0.3] },
  { id: "log", label: "Log", cat: "Stowage", size: [2.4, 0.22, 0.22] },
  { id: "tarp", label: "Rolled tarp", cat: "Stowage", size: [1.4, 0.25, 0.25] },
  { id: "helmet", label: "Helmet", cat: "Stowage", size: [0.28, 0.16, 0.24] },
  { id: "mg", label: "Machine gun", cat: "Weapons", size: [1.1, 0.12, 0.1] },
  { id: "rocketpod", label: "Rocket pod", cat: "Weapons", size: [1.2, 0.3, 0.3] },
  { id: "smoke", label: "Smoke launchers", cat: "Weapons", size: [0.25, 0.25, 0.4] },
  { id: "antenna", label: "Antenna", cat: "Details", size: [0.05, 2, 0.05] },
  { id: "light", label: "Lamp", cat: "Details", size: [0.18, 0.18, 0.2] },
  { id: "periscope", label: "Periscope", cat: "Details", size: [0.15, 0.12, 0.18] },
  { id: "hatch", label: "Hatch", cat: "Details", size: [0.55, 0.05, 0.55] },
  { id: "exhaust", label: "Exhaust pipe", cat: "Details", size: [0.15, 0.6, 0.15] },
  { id: "searchlight", label: "Searchlight", cat: "Details", size: [0.35, 0.3, 0.3] },
  { id: "flag", label: "Flag", cat: "Details", size: [0.6, 1.4, 0.4] },
  { id: "crew", label: "Crew figure (outside)", cat: "Details", size: [0.5, 0.9, 0.5] },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Clamp a spec against its field definitions; unknown keys fall back to defaults. */
function sanitizeSpec(kind, raw) {
  const k = KINDS.find((x) => x.id === kind) ?? KINDS[0];
  let spec = structuredClone({ ...k.defaults, ...SHARED });
  for (const section of fieldsFor(kind)) {
    for (const f of section.fields) {
      const v = getPath(raw ?? {}, f.k);
      if (v === undefined) continue;
      let ok;
      switch (f.type) {
        case "range":
        case "armor":
        case "slope":
          ok = typeof v === "number" && Number.isFinite(v) ? clamp(v, f.min, f.max) : undefined;
          break;
        case "select":
          ok = f.options.some((o) => o[0] === v) ? v : undefined;
          break;
        case "toggle":
          ok = typeof v === "boolean" ? v : undefined;
          break;
        case "color":
          ok = isHex(v) ? v.toLowerCase() : undefined;
          break;
        default:
          ok = typeof v === "string" ? v.slice(0, f.max ?? 40) : undefined;
      }
      if (ok !== undefined) spec = setPath(spec, f.k, ok);
    }
  }
  const seed = getPath(raw ?? {}, "paint.seed");
  if (typeof seed === "number" && Number.isFinite(seed)) spec = setPath(spec, "paint.seed", Math.round(clamp(seed, 0, 1e9)));
  if (kind === "plane") {
    const ek = getPath(raw ?? {}, "engine.kind");
    spec = setPath(spec, "engine.kind", ek === "jet" ? "jet" : "piston");
  }
  return spec;
}

const num = (v, a, b, d) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, a, b) : d);

export function sanitizeVehicle(input) {
  const src = input && typeof input === "object" ? input : {};
  const kind = KINDS.some((k) => k.id === src.kind) ? src.kind : "tank";
  const okId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  return {
    v: VEHICLE_VERSION,
    id: okId(src.id) ? src.id : vehicleId(),
    name: typeof src.name === "string" && src.name.trim() ? src.name.slice(0, 60) : `My ${kind}`,
    kind,
    nation: NATIONS.some((n) => n.id === src.nation) ? src.nation : "usa",
    preset: typeof src.preset === "string" ? src.preset.slice(0, 40) : null,
    approx: src.approx === true,
    spec: sanitizeSpec(kind, src.spec),
    addons: (Array.isArray(src.addons) ? src.addons.slice(0, 200) : [])
      .filter((a) => a && ADDONS.some((d) => d.id === a.type))
      .map((a) => ({
        id: okId(a.id) ? a.id : addonId(),
        type: a.type,
        on: ["hull", "turret", "gun"].includes(a.on) ? a.on : "hull",
        pos: [0, 1, 2].map((i) => num(a.pos?.[i], -30, 30, 0)),
        rot: [0, 1, 2].map((i) => num(a.rot?.[i], -360, 360, 0)),
        size: [0, 1, 2].map((i) => num(a.size?.[i], 0.01, 20, ADDONS.find((d) => d.id === a.type).size[i])),
        mirror: a.mirror === true,
        color: isHex(a.color) ? a.color.toLowerCase() : null,
        armor: num(a.armor, 0, 800, ADDONS.find((d) => d.id === a.type).armor ?? 0),
      })),
  };
}

// ---------------------------------------------------------------------------
// Random tanks
// ---------------------------------------------------------------------------

const NAMES_A = ["Iron", "Steel", "Thunder", "Grim", "Mad", "Bad", "Big", "Angry", "Royal", "Desert", "Arctic", "Shadow", "Rusty", "Lucky", "Cursed"];
const NAMES_B = ["Badger", "Wolf", "Mammoth", "Brick", "Panzer", "Toaster", "Beast", "Fortress", "Hammer", "Bulldog", "Kettle", "Rhino", "Goblin", "Potato"];

/**
 * A random tank. Normal mode stays believable; "cursed" mode pushes every
 * slider to silly extremes (still valid, just ridiculous).
 */
export function randomVehicle(cursed = false, rnd = Math.random) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (a, b, step = 0.01) => Math.round((a + rnd() * (b - a)) / step) * step;
  const v = createVehicle("tank");
  const s = v.spec;
  const L = cursed ? between(3.5, 10) : between(5.2, 7.8);
  const W = cursed ? between(2, 4.2) : between(2.8, 3.7);
  s.hull = { ...s.hull, style: pick(HULL_STYLES)[0], length: L, width: W, height: cursed ? between(1.2, 2.8) : between(1.7, 2.2), front: Math.round(cursed ? between(5, 700, 1) : between(40, 200, 1)), frontSlope: Math.round(between(0, cursed ? 85 : 65, 1)), lower: Math.round(between(30, 150, 1)), lowerSlope: Math.round(between(10, 60, 1)), side: Math.round(between(20, 100, 1)), sideSlope: rnd() < 0.3 ? Math.round(between(10, 40, 1)) : 0, rear: Math.round(between(20, 80, 1)), roof: Math.round(between(10, 40, 1)), zimmerit: rnd() < 0.25 };
  s.turret = { ...s.turret, style: pick(TURRET_STYLES.filter((t) => cursed || t[0] !== "none"))[0], at: between(cursed ? 0.25 : 0.4, cursed ? 0.75 : 0.6), length: cursed ? between(1.2, 4.5) : between(L * 0.32, L * 0.48), width: cursed ? between(1.2, 3.8) : between(W * 0.62, W * 0.9), height: cursed ? between(0.5, 1.4) : between(0.75, 1.0), front: Math.round(between(50, cursed ? 900 : 250, 1)), frontSlope: Math.round(between(0, 40, 1)), cupola: pick(["blocks", "hatch", "mg", "modern"]), bustle: pick(["none", "bin", "basket", "modern"]), smoke: Math.floor(between(0, 4, 1)), spareLinks: Math.floor(between(0, 5, 1)) };
  const cal = Math.round(cursed ? between(20, 155, 1) : pick([75, 76, 85, 88, 90, 100, 105, 122, 128]));
  s.gun = { ...s.gun, caliber: cal, length: Math.round(cursed ? between(15, 75, 1) : between(40, 71, 1)), shell: pick(["APCBC", "APHE", "APDS", "HEAT", "APFSDS"]), loading: pick(["unitary", "unitary", "separate", "autoloader"]), brake: pick(["double", "single", "slotted", "none"]), mantlet: pick(["box", "saukopf", "cast", "slab"]), mantletArmor: Math.round(between(60, 300, 1)), evacuator: rnd() < 0.4, sleeve: rnd() < 0.3, kills: rnd() < 0.3 ? Math.floor(between(1, 12, 1)) : 0 };
  s.gear = { ...s.gear, style: pick(WHEEL_STYLES)[0], wheels: Math.floor(between(4, cursed ? 12 : 9, 1)), wheelSize: between(0.45, 0.9), rollers: Math.floor(between(0, 5, 1)), drive: pick(["front", "rear"]), trackWidth: between(0.45, 0.8), skirts: pick(["none", "none", "panels", "rubber", "armour", "era"]) };
  s.engine = { kind: pick(["petrol", "diesel", "turbine"]), hp: Math.round(between(cursed ? 50 : 350, cursed ? 2000 : 1200, 10)), fuel: Math.round(between(300, 1500, 10)) };
  s.details = { ...s.details, stowage: pick(["none", "field", "logs", "heavy"]), sandbags: rnd() < 0.2, glacisTracks: rnd() < 0.3, fuelDrums: rnd() < 0.25, applique: rnd() < 0.2, spareWheels: rnd() < 0.2, exhaust: pick(["mufflers", "pipes", "deflector", "grille"]), antennas: Math.floor(between(0, 3, 1)) };
  const p = pick(PAINTS.filter((x) => cursed || !x.gloss));
  s.paint = { ...s.paint, base: p.base, camo: p.camo, c1: p.colors[0], c2: p.colors[1], c3: p.colors[2], gloss: p.gloss ? 0.6 : 0.1, wear: between(0.1, 0.7), seed: Math.floor(rnd() * 1e6) };
  s.markings = { ...s.markings, number: rnd() < 0.6 ? String(Math.floor(between(100, 999, 1))) : "", insignia: "auto" };
  v.nation = pick(NATIONS).id;
  v.name = `${pick(NAMES_A)} ${pick(NAMES_B)}`;
  return sanitizeVehicle(v);
}
