// Builds GlobalCorp SE's data products (brief §6.1 and §8): data/world.js (window.WORLD), the six tips in
// data/scenarios.js and their frozen reference figures in data/reference_cases.js.
//
// Deterministic: a fixed seed and fixed inputs (tools/source/accounts.json, tools/source/material_groups.json
// and data/fx.js) give the same bytes on every run (AC-05). The scenarios' prices in pounds are fixed in
// pounds; the background's are set at the bundled rate, so the background stays within a few per cent at
// any snapshot, and a new snapshot rebuilds the world and its frozen figures in the same pull request.
// Every scenario's pattern is planted on purpose (PLAN.md section 3.5); every other group varies within a
// few per cent, so none is flagged at the default parameters. Day numbers count from the day the app is
// opened: day 0 is today, negative days are past.
//
// Usage: node tools/build_world.mjs          writes the three data files
//        node tools/build_world.mjs --check  builds in memory and compares with the files (no write)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULTS } from "../js/params.js";
import { METHOD_VERSION, INCOTERM_GROUPS, baseUnitsPerOrderUnit } from "../js/normalise.js";
import { buildGroups, groupIndex, unitOfLine } from "../js/groups.js";
import { analyseGroup } from "../js/variance.js";
import { valuePipeline } from "../js/pipeline.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SEED = 1729;
export const WORLD_VERSION = "1.0.0";

// ---- deterministic helpers ---------------------------------------------------------------------------
function mulberry32(a) {
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// ---- company, plants, buyers ----------------------------------------------------------------------------
const PLANTS = [
  { id: "1010", company_code: "CC-1000", city: "Frankfurt am Main", country: "DE", role: "Headquarters site and central warehouse", lang: "de" },
  { id: "1020", company_code: "CC-1000", city: "Duisburg", country: "DE", role: "Production", lang: "de" },
  { id: "2010", company_code: "CC-2000", city: "Birmingham", country: "GB", role: "UK production and warehouse", lang: "en" },
  { id: "3010", company_code: "CC-3000", city: "Lyon", country: "FR", role: "French production", lang: "fr" }
];
const PLANT = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
const TEAMS = ["MRO", "Packaging", "Services"];
const BUYER_NAMES = {
  1010: ["Jonas K.", "Miriam S.", "Lena W."],
  1020: ["Mehmet A.", "Sabine R.", "Tobias H."],
  2010: ["Oliver P.", "Hannah T.", "Priya S."],
  3010: ["Claire M.", "Julien B.", "Amélie D."]
};
const BUYERS = PLANTS.flatMap((p, i) => TEAMS.map((team, j) => ({
  id: `BU-${String(i * 3 + j + 1).padStart(2, "0")}`, name: BUYER_NAMES[p.id][j], role: "Buyer", team, plant: p.id
})));
const teamOf = (materialGroup) => (materialGroup.startsWith("PKG") ? "Packaging" : materialGroup.startsWith("SRV") ? "Services" : "MRO");
const buyerOf = (plant, materialGroup) => BUYERS.find((b) => b.plant === plant && b.team === teamOf(materialGroup)).id;

// ---- new accounts (this prototype's additions, ids from 80001) ------------------------------------------
const NEW_ACCOUNTS = [
  { id: "80001", name: "Mercia MRO Ltd", city: "Birmingham", country: "GB", currency: "GBP", category: "MRO supplies", company_code: "CC-2000" },
  { id: "80002", name: "Rhône MRO SARL", city: "Lyon", country: "FR", currency: "EUR", category: "MRO supplies", company_code: "CC-3000" },
  { id: "80003", name: "Mercia Packaging Ltd", city: "Birmingham", country: "GB", currency: "GBP", category: "Packaging", company_code: "CC-2000" },
  { id: "80004", name: "Severn Consulting Ltd", city: "Birmingham", country: "GB", currency: "GBP", category: "Consulting", company_code: "CC-2000" },
  { id: "80005", name: "Mercia Chemicals Ltd", city: "Wolverhampton", country: "GB", currency: "GBP", category: "Chemicals", company_code: "CC-2000" },
  { id: "80006", name: "Severn IT-Services Ltd", city: "Birmingham", country: "GB", currency: "GBP", category: "IT services", company_code: "CC-2000" },
  { id: "80007", name: "Severn Facility Ltd", city: "Coventry", country: "GB", currency: "GBP", category: "Facility management", company_code: "CC-2000" },
  { id: "80008", name: "Severn Security Ltd", city: "Birmingham", country: "GB", currency: "GBP", category: "Security services", company_code: "CC-2000" }
];
const CONTINENTAL = ["DE", "FR", "NL", "AT", "CH", "IT", "ES"];
/** Own country, plus DE and FR for suppliers in DE, FR, NL, AT, CH, IT and ES; the new British accounts GB only. */
export function deliversTo(account) {
  const set = new Set([account.country]);
  if (CONTINENTAL.includes(account.country)) { set.add("DE"); set.add("FR"); }
  return [...set].sort();
}
/** The kept accounts that buy, by vendor category (the rest of the 124 have no order lines). */
const POOLS = {
  "MRO supplies": ["30024", "30041", "30049", "30062", "30063", "30065", "30093", "30135"],
  Packaging: ["30025", "30033", "30061", "30080", "30109", "30119"],
  Chemicals: ["30029", "30037", "30056", "30085", "30108", "30141"],
  Consulting: ["30020", "30044", "30050", "30059", "30128"],
  "IT services": ["30008", "30058", "30060", "30066", "30137"],
  "Facility management": ["30023", "30040", "30054", "30096"],
  "Security services": ["30013", "30019", "30070", "30107"]
};
const GB_ACCOUNT = { "MRO supplies": "80001", Packaging: "80003", Consulting: "80004", Chemicals: "80005", "IT services": "80006", "Facility management": "80007", "Security services": "80008" };

// ---- material catalogue -------------------------------------------------------------------------------
// Scenario and past-case materials first, with fixed ids; then the background, which varies within a few
// per cent. Background fields: base price in € per base unit delivered, and the annual quantity per plant.
const mat = (key, group, en, de, fr, base, conversions, display, orderUnit, price, plants, extra = {}) =>
  ({ key, group, en, de, fr, base, conversions, display, orderUnit, price, plants, ...extra });
const SCENARIO_MATERIALS = [
  mat("GLOVES", "MRO-PPE", "Nitrile gloves, size L", "Nitrilhandschuhe, Größe L", "Gants nitrile, taille L", "EA", { EA: 1, BOX: 100, CS: 1000 }, 100, "BOX", null, {}),
  mat("SHOE-DE", "MRO-PPE", "Safety shoe S3 ESD, black", "Sicherheitsschuh S3 ESD, schwarz", "Chaussure de sécurité S3 ESD, noire", "EA", { EA: 1 }, 1, "EA", null, {}, { manufacturer: "Brekholt", mpn: "BH-7730-S3" }),
  mat("HOSE", "MRO-HYD", "Hydraulic hose assembly DN12, 1,000 mm", "Hydraulikschlauchleitung DN12, 1.000 mm", "Flexible hydraulique DN12, 1 000 mm", "EA", { EA: 1 }, 1, "EA", null, {}),
  mat("CABLETIE", "MRO-FAS", "Cable tie 4.8 x 300 mm, black", "Kabelbinder 4,8 x 300 mm, schwarz", "Collier de serrage 4,8 x 300 mm, noir", "EA", { EA: 1, PAK: 100 }, 100, "PAK", null, {}),
  mat("BOX", "PKG-COR", "Corrugated box 600 x 400 x 400 mm, double wall", "Wellpappkarton 600 x 400 x 400 mm, zweiwellig", "Caisse carton 600 x 400 x 400 mm, double cannelure", "EA", { EA: 1 }, 1, "EA", null, {}),
  mat("PALLET", "PKG-PAL", "Euro pallet 1200 x 800 mm", "Europalette 1200 x 800 mm", "Palette Europe 1200 x 800 mm", "EA", { EA: 1 }, 1, "EA", null, {}),
  mat("FILM", "PKG-FLM", "Stretch film 500 mm x 23 µm, 1,500 m roll", "Stretchfolie 500 mm x 23 µm, Rolle 1.500 m", "Film étirable 500 mm x 23 µm, rouleau de 1 500 m", "ROL", { ROL: 1 }, 1, "ROL", null, {})
];
const BACKGROUND = [
  mat("PPE-GLASSES", "MRO-PPE", "Safety glasses, clear lens", "Schutzbrille, klar", "Lunettes de protection, incolores", "EA", { EA: 1, BOX: 10 }, 1, "BOX", 4.2, { 1010: 2400, 1020: 3600, 3010: 1800, 2010: 1200 }),
  mat("PPE-EARPLUG", "MRO-PPE", "Ear plugs, foam, pair", "Gehörschutzstöpsel, Schaum, Paar", "Bouchons d'oreille mousse, paire", "EA", { EA: 1, BOX: 200 }, 100, "BOX", 0.11, { 1010: 40000, 1020: 80000, 3010: 30000, 2010: 20000 }),
  mat("PPE-VEST", "MRO-PPE", "High-visibility vest, yellow, size XL", "Warnweste, gelb, Größe XL", "Gilet haute visibilité, jaune, taille XL", "EA", { EA: 1 }, 1, "EA", 3.6, { 1010: 600, 1020: 900, 3010: 400, 2010: 300 }),
  mat("PPE-CUTGLOVE", "MRO-PPE", "Cut-resistant gloves, level C, size 9", "Schnittschutzhandschuhe, Stufe C, Größe 9", "Gants anti-coupure, niveau C, taille 9", "EA", { EA: 1, BOX: 12 }, 1, "BOX", 5.8, { 1020: 6000, 3010: 3000, 2010: 2400 }),
  mat("PPE-COVERALL", "MRO-PPE", "Disposable coverall, type 5/6, size XL", "Einwegoverall, Typ 5/6, Größe XL", "Combinaison jetable, type 5/6, taille XL", "EA", { EA: 1, CS: 25 }, 1, "CS", 4.9, { 1020: 2000, 3010: 1000, 2010: 800 }),
  mat("PPE-HELMET", "MRO-PPE", "Safety helmet, white", "Schutzhelm, weiß", "Casque de sécurité, blanc", "EA", { EA: 1, BOX: 20 }, 1, "EA", 8.4, { 1010: 300, 1020: 500, 3010: 250 }),
  mat("HYD-COUPLING", "MRO-HYD", "Hydraulic quick coupling DN12", "Hydraulik-Schnellkupplung DN12", "Coupleur rapide hydraulique DN12", "EA", { EA: 1 }, 1, "EA", 14.8, { 1010: 300, 1020: 900, 3010: 400, 2010: 250 }),
  mat("HYD-FILTER", "MRO-HYD", "Hydraulic return filter element", "Hydraulik-Rücklauffilterelement", "Élément filtrant retour hydraulique", "EA", { EA: 1 }, 1, "EA", 32.5, { 1010: 120, 1020: 360, 3010: 150, 2010: 100 }),
  mat("HYD-ORING", "MRO-HYD", "O-ring assortment, NBR, 382 pieces", "O-Ring-Sortiment NBR, 382 Teile", "Assortiment de joints toriques NBR, 382 pièces", "EA", { EA: 1 }, 1, "EA", 46, { 1020: 60, 3010: 40, 2010: 30 }),
  mat("HYD-FITTING", "MRO-HYD", "Push-in fitting, straight, 8 mm", "Steckverschraubung, gerade, 8 mm", "Raccord instantané droit, 8 mm", "EA", { EA: 1, BOX: 10 }, 10, "BOX", 2.15, { 1020: 4000, 3010: 2000, 2010: 1500 }),
  mat("FAS-ANCHOR", "MRO-FAS", "Wall anchor 8 x 40 mm", "Dübel 8 x 40 mm", "Cheville 8 x 40 mm", "EA", { EA: 1, BOX: 100 }, 100, "BOX", 0.085, { 1010: 20000, 1020: 40000, 3010: 15000, 2010: 10000 }),
  mat("FAS-BOLT", "MRO-FAS", "Hex bolt M10 x 40, grade 8.8, zinc plated", "Sechskantschraube M10 x 40, 8.8, verzinkt", "Vis tête hexagonale M10 x 40, classe 8.8, zinguée", "EA", { EA: 1, BOX: 100 }, 100, "BOX", 0.19, { 1020: 60000, 3010: 25000, 2010: 20000 }),
  mat("FAS-WASHER", "MRO-FAS", "Washer M10, zinc plated", "Unterlegscheibe M10, verzinkt", "Rondelle M10, zinguée", "EA", { EA: 1, BOX: 500 }, 100, "BOX", 0.018, { 1020: 120000, 3010: 50000, 2010: 40000 }),
  mat("FAS-SCREW", "MRO-FAS", "Self-tapping screw 4.2 x 19 mm", "Blechschraube 4,2 x 19 mm", "Vis autotaraudeuse 4,2 x 19 mm", "EA", { EA: 1, BOX: 1000 }, 1000, "BOX", 0.012, { 1010: 40000, 1020: 100000, 3010: 50000 }),
  mat("TLS-CUTDISC", "MRO-TLS", "Cutting disc 125 x 1.0 mm, steel", "Trennscheibe 125 x 1,0 mm, Stahl", "Disque à tronçonner 125 x 1,0 mm, acier", "EA", { EA: 1, BOX: 25 }, 1, "BOX", 1.35, { 1010: 2000, 1020: 12000, 3010: 6000, 2010: 4000 }),
  mat("TLS-DRILL", "MRO-TLS", "Twist drill HSS, 8 mm", "Spiralbohrer HSS, 8 mm", "Foret hélicoïdal HSS, 8 mm", "EA", { EA: 1, BOX: 10 }, 1, "BOX", 2.4, { 1020: 3000, 3010: 1200, 2010: 1000 }),
  mat("TLS-FLAPDISC", "MRO-TLS", "Flap disc 125 mm, grit 80", "Fächerschleifscheibe 125 mm, Körnung 80", "Disque à lamelles 125 mm, grain 80", "EA", { EA: 1, BOX: 10 }, 1, "BOX", 2.1, { 1020: 6000, 3010: 3000, 2010: 2000 }),
  mat("TLS-BANDSAW", "MRO-TLS", "Bandsaw blade 2,750 x 27 mm, bimetal", "Sägeband 2.750 x 27 mm, Bimetall", "Lame de scie à ruban 2 750 x 27 mm, bimétal", "EA", { EA: 1 }, 1, "EA", 38, { 1020: 150, 3010: 80 }),
  mat("TLS-SANDING", "MRO-TLS", "Sanding sheet 230 x 280 mm, grit 120", "Schleifbogen 230 x 280 mm, Körnung 120", "Feuille abrasive 230 x 280 mm, grain 120", "EA", { EA: 1, PAK: 50 }, 1, "PAK", 0.42, { 1010: 3000, 1020: 10000, 3010: 4000 }),
  mat("TLS-HOLESAW", "MRO-TLS", "Hole saw 68 mm, bimetal", "Lochsäge 68 mm, Bimetall", "Scie cloche 68 mm, bimétal", "EA", { EA: 1 }, 1, "EA", 9.2, { 1010: 200, 1020: 500, 2010: 150 }),
  mat("ELE-FUSE", "MRO-ELE", "Fuse 10 A, gG, 10 x 38 mm", "Sicherung 10 A, gG, 10 x 38 mm", "Fusible 10 A, gG, 10 x 38 mm", "EA", { EA: 1, BOX: 10 }, 1, "BOX", 1.15, { 1010: 1500, 1020: 4000, 3010: 1800, 2010: 1200 }),
  mat("ELE-GLAND", "MRO-ELE", "Cable gland M20, nylon", "Kabelverschraubung M20, Polyamid", "Presse-étoupe M20, polyamide", "EA", { EA: 1, BOX: 100 }, 100, "BOX", 0.38, { 1020: 10000, 3010: 4000, 2010: 3000 }),
  mat("ELE-LED", "MRO-ELE", "LED tube T8, 1,500 mm, 24 W", "LED-Röhre T8, 1.500 mm, 24 W", "Tube LED T8, 1 500 mm, 24 W", "EA", { EA: 1, BOX: 10 }, 1, "BOX", 9.8, { 1010: 800, 1020: 1200, 3010: 600, 2010: 500 }),
  mat("ELE-CONTACTOR", "MRO-ELE", "Contactor, 3 poles, 9 A, 24 V DC", "Schütz, 3-polig, 9 A, 24 V DC", "Contacteur tripolaire 9 A, 24 V DC", "EA", { EA: 1 }, 1, "EA", 24.5, { 1020: 300, 3010: 120, 2010: 80 }),
  mat("ELE-CABLE", "MRO-ELE", "Rubber cable H07RN-F 3G2.5", "Gummileitung H07RN-F 3G2,5", "Câble caoutchouc H07RN-F 3G2,5", "M", { M: 1, ROL: 50 }, 1, "ROL", 2.35, { 1020: 6000, 3010: 2500, 2010: 2000 }),
  mat("ELE-TERMINAL", "MRO-ELE", "Terminal block 4 mm², grey", "Reihenklemme 4 mm², grau", "Borne de raccordement 4 mm², grise", "EA", { EA: 1, BOX: 50 }, 1, "BOX", 0.62, { 1020: 8000, 3010: 3000, 2010: 2500 }),
  mat("COR-SMALLBOX", "PKG-COR", "Corrugated box 400 x 300 x 200 mm, single wall", "Wellpappkarton 400 x 300 x 200 mm, einwellig", "Caisse carton 400 x 300 x 200 mm, simple cannelure", "EA", { EA: 1 }, 1, "EA", 0.62, { 1010: 80000, 1020: 60000, 3010: 50000, 2010: 30000 }),
  mat("COR-DIVIDER", "PKG-COR", "Corrugated divider set for 600 x 400 mm", "Wellpapp-Gefacheeinsatz für 600 x 400 mm", "Croisillon carton pour 600 x 400 mm", "EA", { EA: 1 }, 1, "EA", 0.44, { 1020: 30000, 3010: 20000, 2010: 15000 }),
  mat("COR-FOLDBOX", "PKG-COR", "Folding box 300 x 200 x 100 mm", "Faltschachtel 300 x 200 x 100 mm", "Boîte pliante 300 x 200 x 100 mm", "EA", { EA: 1 }, 1, "EA", 0.31, { 1010: 40000, 3010: 25000, 2010: 20000 }),
  mat("PAL-COLLAR", "PKG-PAL", "Pallet collar 1200 x 800 mm, hinged", "Palettenaufsatzrahmen 1200 x 800 mm, klappbar", "Rehausse de palette 1200 x 800 mm, pliable", "EA", { EA: 1 }, 1, "EA", 9.6, { 1010: 2000, 1020: 3000, 3010: 1500, 2010: 1000 }),
  mat("PAL-ONEWAY", "PKG-PAL", "One-way pallet 1200 x 1000 mm", "Einwegpalette 1200 x 1000 mm", "Palette perdue 1200 x 1000 mm", "EA", { EA: 1 }, 1, "EA", 7.4, { 1020: 4000, 3010: 2500, 2010: 2000 }),
  mat("PAL-TOPCOVER", "PKG-PAL", "Pallet top cover, board, 1200 x 800 mm", "Palettendeckel, Pappe, 1200 x 800 mm", "Coiffe de palette carton 1200 x 800 mm", "EA", { EA: 1 }, 1, "EA", 1.1, { 1010: 8000, 1020: 6000, 3010: 4000 }),
  mat("FLM-TAPE", "PKG-FLM", "Packing tape PP, 50 mm x 66 m, brown", "Packband PP, 50 mm x 66 m, braun", "Ruban adhésif PP, 50 mm x 66 m, havane", "ROL", { ROL: 1, CS: 36 }, 1, "CS", 1.45, { 1010: 6000, 1020: 4000, 3010: 3000, 2010: 2500 }),
  mat("FLM-BUBBLE", "PKG-FLM", "Bubble wrap, 1,000 mm x 100 m", "Luftpolsterfolie, 1.000 mm x 100 m", "Film à bulles, 1 000 mm x 100 m", "ROL", { ROL: 1 }, 1, "ROL", 21, { 1010: 400, 3010: 250, 2010: 200 }),
  mat("FLM-HOOD", "PKG-FLM", "Shrink hood, 1,300 x 1,600 mm", "Schrumpfhaube, 1.300 x 1.600 mm", "Housse rétractable, 1 300 x 1 600 mm", "EA", { EA: 1, ROL: 250 }, 1, "ROL", 0.58, { 1020: 20000, 3010: 12000 }),
  mat("LUB-HLP46", "CHM-LUB", "Hydraulic oil HLP 46", "Hydrauliköl HLP 46", "Huile hydraulique HLP 46", "L", { L: 1, DR: 208 }, 1, "DR", 2.05, { 1010: 3000, 1020: 20000, 3010: 8000, 2010: 6000 }),
  mat("LUB-GREASE", "CHM-LUB", "Multipurpose grease EP2, 400 g cartridge", "Mehrzweckfett EP2, Kartusche 400 g", "Graisse multi-usages EP2, cartouche 400 g", "EA", { EA: 1, CS: 40 }, 1, "CS", 3.1, { 1020: 4000, 3010: 2000, 2010: 1500 }),
  mat("LUB-CUTOIL", "CHM-LUB", "Cutting oil, water-miscible", "Schneidöl, wassermischbar", "Huile de coupe soluble", "L", { L: 1, DR: 208 }, 1, "DR", 3.6, { 1020: 10000, 3010: 4000, 2010: 3000 }),
  mat("CLN-ALKALINE", "CHM-CLN", "Industrial cleaner, alkaline", "Industriereiniger, alkalisch", "Nettoyant industriel alcalin", "L", { L: 1, DR: 200 }, 1, "DR", 1.85, { 1010: 2000, 1020: 6000, 3010: 3000, 2010: 2000 }),
  mat("CLN-DEGREASER", "CHM-CLN", "Degreaser spray, 500 ml", "Entfetterspray, 500 ml", "Dégraissant en aérosol, 500 ml", "EA", { EA: 1, CS: 12 }, 1, "CS", 3.4, { 1010: 1200, 1020: 3000, 3010: 1500, 2010: 1000 }),
  mat("CLN-HAND", "CHM-CLN", "Hand cleaner, 4 l can", "Handreiniger, Kanister 4 l", "Nettoyant mains, bidon de 4 l", "EA", { EA: 1, CS: 4 }, 1, "CS", 11.2, { 1010: 300, 1020: 800, 3010: 400, 2010: 300 }),
  mat("CLN-FLOOR", "CHM-CLN", "Floor cleaner concentrate", "Bodenreiniger-Konzentrat", "Détergent sols concentré", "L", { L: 1, DR: 200 }, 1, "DR", 2.4, { 1010: 1600, 1020: 2400, 3010: 1200 }),
  mat("PRC-COOLANT", "CHM-PRC", "Coolant concentrate", "Kühlschmierstoff-Konzentrat", "Concentré de fluide de coupe", "L", { L: 1, DR: 208 }, 1, "DR", 4.15, { 1020: 15000, 3010: 6000, 2010: 4000 }),
  mat("PRC-SPATTER", "CHM-PRC", "Anti-spatter spray, 400 ml", "Schweißtrennspray, 400 ml", "Anti-adhérent de soudure, 400 ml", "EA", { EA: 1, CS: 12 }, 1, "CS", 4.8, { 1020: 2400, 3010: 1200, 2010: 1000 }),
  mat("PRC-PENETRATE", "CHM-PRC", "Penetrating oil spray, 400 ml", "Kriechölspray, 400 ml", "Dégrippant en aérosol, 400 ml", "EA", { EA: 1, CS: 12 }, 1, "CS", 3.95, { 1010: 600, 1020: 1800, 3010: 900 }),
  mat("CON-PROCESS", "SRV-CON", "Procurement process consulting, per day", "Prozessberatung Einkauf, Tagessatz", "Conseil en processus achats, tarif journalier", "PD", {}, 1, "DAY", 1250, { 1010: 40, 3010: 20 }),
  mat("CON-DATAPROT", "SRV-CON", "Data protection consulting, per hour", "Datenschutzberatung, Stundensatz", "Conseil en protection des données, tarif horaire", "PD", {}, 1, "H", 1120, { 1010: 15, 1020: 10 }),
  mat("ITS-DESK", "SRV-ITS", "IT service desk, first level, per hour", "IT-Servicedesk, 1st Level, Stundensatz", "Support informatique niveau 1, tarif horaire", "H", {}, 1, "H", 58, { 1010: 3000, 1020: 2000, 3010: 1500, 2010: 1200 }),
  mat("ITS-FIELD", "SRV-ITS", "IT field engineer on site, per day", "IT-Techniker vor Ort, Tagessatz", "Technicien informatique sur site, tarif journalier", "PD", {}, 1, "DAY", 720, { 1010: 60, 1020: 80, 3010: 40, 2010: 30 }),
  mat("ITS-NETWORK", "SRV-ITS", "Network technician, per hour", "Netzwerktechniker, Stundensatz", "Technicien réseau, tarif horaire", "H", {}, 1, "H", 85, { 1010: 400, 1020: 300, 3010: 200 }),
  mat("FAC-CLEAN", "SRV-FAC", "Office cleaning, per hour", "Büroreinigung, Stundensatz", "Nettoyage des bureaux, tarif horaire", "H", {}, 1, "H", 29.5, { 1010: 6000, 1020: 3000, 3010: 2500, 2010: 2000 }),
  mat("FAC-MAINT", "SRV-FAC", "Building services technician, per hour", "Haustechniker, Stundensatz", "Technicien de maintenance des bâtiments, tarif horaire", "H", {}, 1, "H", 62, { 1010: 1200, 1020: 1500, 3010: 800, 2010: 600 }),
  mat("FAC-WINDOW", "SRV-FAC", "Window cleaning, per hour", "Glasreinigung, Stundensatz", "Nettoyage des vitres, tarif horaire", "H", {}, 1, "H", 34, { 1010: 400, 3010: 200, 2010: 150 }),
  mat("SEC-GUARD", "SRV-SEC", "Site guarding, per hour", "Objektschutz, Stundensatz", "Gardiennage du site, tarif horaire", "H", {}, 1, "H", 31, { 1010: 8760, 1020: 8760, 3010: 4380, 2010: 4380 }),
  mat("SEC-GATE", "SRV-SEC", "Gate control, per hour", "Pfortendienst, Stundensatz", "Contrôle d'accès, tarif horaire", "H", {}, 1, "H", 29, { 1020: 6000, 3010: 3000, 2010: 2500 }),
  mat("SEC-ALARM", "SRV-SEC", "Alarm response call-out", "Alarmverfolgung, Einsatz", "Intervention sur alarme", "EA", { EA: 1 }, 1, "EA", 95, { 1010: 40, 1020: 60, 3010: 30 })
];
const SHOE_FR = mat("SHOE-FR", "MRO-PPE", "Chaussure de sécurité S3 ESD noire", "Sicherheitsschuh S3 ESD, schwarz", "Chaussure de sécurité S3 ESD noire", "EA", { EA: 1 }, 1, "EA", null, {}, { manufacturer: "Brekholt", mpn: "BH-7730-S3" });
/** Background materials whose main supplier holds a contract with company code CC-1000. */
const CONTRACTED = ["PPE-GLASSES", "PPE-EARPLUG", "PPE-CUTGLOVE", "HYD-COUPLING", "FAS-BOLT", "TLS-CUTDISC", "ELE-FUSE", "ELE-LED", "COR-SMALLBOX", "PAL-COLLAR", "FLM-TAPE", "LUB-HLP46", "CLN-ALKALINE", "PRC-COOLANT", "ITS-DESK", "FAC-CLEAN", "SEC-GUARD", "LUB-GREASE"];

const INCOTERM_WEIGHTS = [["DAP", 50], ["DDP", 15], ["CPT", 8], ["CIP", 5], ["FCA", 10], ["EXW", 8], ["FOB", 4]];
const URGENT_REASONS = {
  de: ["Eilbestellung wegen Maschinenstillstand", "Expresslieferung für dringende Reparatur", "Eilauftrag: Fertigungsauftrag vorgezogen"],
  fr: ["Commande urgente : arrêt de ligne", "Livraison express pour une réparation", "Urgence : ordre de fabrication avancé"],
  en: ["Express order: line stop", "Urgent delivery for a breakdown repair", "Rush order: production order brought forward"]
};

// ---- the build --------------------------------------------------------------------------------------
export function buildWorld({ accounts, taxonomy, fx }) {
  const bundled = ratesOf(fx);
  const rng = mulberry32(SEED);
  const rand = (a = 0, b = 1) => a + (b - a) * rng();
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (xs) => xs[Math.floor(rng() * xs.length)];
  const weighted = (pairs) => { let r = rng() * pairs.reduce((s, [, w]) => s + w, 0); for (const [x, w] of pairs) { r -= w; if (r < 0) return x; } return pairs[pairs.length - 1][0]; };
  const spreadDays = (n, from = -360, to = -3) => Array.from({ length: n }, (_, k) => Math.round(from + (k + rand(0.15, 0.85)) * ((to - from) / n)));

  // Suppliers: the 124 kept accounts and the additions, each with the countries it delivers to.
  const suppliers = [
    ...accounts.accounts.map((a) => ({ ...a, delivers_to: deliversTo(a), added: false })),
    ...NEW_ACCOUNTS.map((a) => ({ ...a, delivers_to: a.country === "GB" ? ["GB"] : deliversTo(a), added: true }))
  ];
  const supplierById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const groupOf = Object.fromEntries(taxonomy.groups.map((g) => [g.code, g]));

  // Materials with their ids: scenario materials, background, then the French shoe.
  const catalogue = [...SCENARIO_MATERIALS, ...BACKGROUND, SHOE_FR];
  const materialId = {};
  catalogue.forEach((m, i) => { materialId[m.key] = String(20001001 + i); });
  const materials = catalogue.map((m) => ({
    id: materialId[m.key],
    description: m.en,
    material_group: m.group,
    base_unit: m.base,
    conversions: m.conversions,
    display_quantity: m.display,
    manufacturer: m.manufacturer ?? null,
    mpn: m.mpn ?? null
  }));
  const materialOf = Object.fromEntries(catalogue.map((m) => [m.key, m]));
  const textOf = (m, plant) => (PLANT[plant].lang === "en" ? m.en : m[PLANT[plant].lang]);

  const lines = [];
  const contracts = [];
  const addContract = (c) => { contracts.push(c); return c; };
  const addLine = (l) => {
    const m = l.material ? catalogue.find((x) => materialId[x.key] === l.material) : null;
    const mg = l.material_group || m.group;
    lines.push({
      plant: l.plant,
      supplier: l.supplier,
      material: l.material ?? null,
      short_text: l.short_text ?? textOf(m, l.plant),
      material_group: mg,
      quantity: l.quantity,
      order_unit: l.order_unit,
      net_price: l.net_price,
      price_unit: l.price_unit ?? 1,
      currency: l.currency ?? supplierById[l.supplier].currency,
      incoterm: l.incoterm === undefined ? (mg.startsWith("SRV") ? null : "DAP") : l.incoterm,
      order_day: l.order_day,
      contract: l.contract ?? null,
      urgent: Boolean(l.urgent),
      urgent_reason: l.urgent ? l.urgent_reason : null,
      cancelled: Boolean(l.cancelled),
      tag: l.tag ?? null
    });
  };
  const series = (spec) => {
    const days = spec.days || spreadDays(spec.quantities.length, spec.from, spec.to);
    spec.quantities.forEach((q, k) => addLine({ ...spec, quantity: q, order_day: days[k], urgent_reason: spec.reasons ? spec.reasons[k % spec.reasons.length] : spec.urgent_reason }));
  };
  const reasonsFor = (plant) => URGENT_REASONS[PLANT[plant].lang];

  // Scenario 1: gloves at three sites (PLAN.md 3.5).
  const gloves = materialId.GLOVES;
  const kGloves = addContract({ supplier: "30024", company_code: "CC-1000", material: gloves, price: 6.9, price_unit: 1, order_unit: "BOX", incoterm: "DAP", currency: "EUR", valid_from: -420, valid_to: 310 });
  series({ tag: "S1", plant: "1010", supplier: "30024", material: gloves, order_unit: "BOX", net_price: 6.9, contract: kGloves, quantities: Array(12).fill(500) });
  series({ tag: "S1", plant: "3010", supplier: "80002", material: gloves, order_unit: "BOX", net_price: 9.8, quantities: [500, 450, 500, 475, 450, 500, 475, 475] });
  series({ tag: "S1", plant: "3010", supplier: "80002", material: gloves, order_unit: "BOX", net_price: 9.8, quantities: [200, 250, 225], urgent: true, reasons: reasonsFor("3010"), from: -300, to: -40 });
  series({ tag: "S1", plant: "2010", supplier: "80001", material: gloves, order_unit: "CS", net_price: 62, incoterm: "FCA", quantities: Array(5).fill(50) });
  series({ tag: "S1", plant: "1020", supplier: "30024", material: gloves, order_unit: "BOX", net_price: 720, price_unit: 100, quantities: [250, 250] });
  series({ tag: "S1", plant: "1020", supplier: "30062", material: gloves, order_unit: "BOX", net_price: 6, quantities: [200], days: [-131] });
  addLine({ tag: "S1-excluded", plant: "3010", supplier: "80002", material: gloves, order_unit: "PAL", net_price: 882, quantity: 1, order_day: -208 });
  addLine({ tag: "S1-cancelled", plant: "3010", supplier: "80002", material: gloves, order_unit: "BOX", net_price: 9.8, quantity: 300, order_day: -77, cancelled: true });

  // Scenario 2: the same consultant at different day rates, as free text (a cluster only after confirmation).
  const consulting = (plant, supplier, text, unit, price, quantities) => series({ tag: "S2", plant, supplier, material: null, material_group: "SRV-CON", short_text: text, order_unit: unit, net_price: price, incoterm: null, quantities });
  consulting("1010", "30059", "SAP FI/CO Senior-Berater, Tagessatz", "DAY", 1150, [20, 20, 20, 20, 20, 20]);
  consulting("1020", "30044", "SAP FI/CO Finanzberater, Abrechnung nach Stunden", "H", 150, [40, 40, 40, 40]);
  consulting("3010", "30128", "Consultant senior SAP FI/CO, tarif journalier", "DAY", 1450, [20, 20, 20]);
  consulting("2010", "80004", "SAP FI/CO finance consultant, hourly rate", "H", 170, [80, 80, 80, 80]);

  // Scenario 3: urgent orders explain part of the gap for hydraulic hoses, routine orders the larger part.
  const hose = materialId.HOSE;
  const kHose = addContract({ supplier: "30065", company_code: "CC-1000", material: hose, price: 38, price_unit: 1, order_unit: "EA", incoterm: "DAP", currency: "EUR", valid_from: -400, valid_to: 330 });
  series({ tag: "S3", plant: "1010", supplier: "30065", material: hose, order_unit: "EA", net_price: 38, contract: kHose, quantities: Array(8).fill(250) });
  series({ tag: "S3", plant: "1020", supplier: "30093", material: hose, order_unit: "EA", net_price: 44.5, quantities: Array(7).fill(240) });
  series({ tag: "S3", plant: "1020", supplier: "30093", material: hose, order_unit: "EA", net_price: 44.5, quantities: Array(4).fill(180), urgent: true, reasons: reasonsFor("1020"), from: -330, to: -20 });
  series({ tag: "S3", plant: "3010", supplier: "30063", material: hose, order_unit: "EA", net_price: 38.4, quantities: Array(4).fill(150) });

  // Scenario 4: the UK's delivered price against Lyon's ex-works price: an honest negative.
  const box = materialId.BOX;
  series({ tag: "S4", plant: "3010", supplier: "30080", material: box, order_unit: "EA", net_price: 1.8, incoterm: "EXW", quantities: Array(10).fill(12000) });
  series({ tag: "S4", plant: "1010", supplier: "30025", material: box, order_unit: "EA", net_price: 1.9, quantities: Array(8).fill(10000) });
  series({ tag: "S4", plant: "1020", supplier: "30109", material: box, order_unit: "EA", net_price: 1.91, quantities: Array(8).fill(5000) });
  series({ tag: "S4", plant: "2010", supplier: "80003", material: box, order_unit: "EA", net_price: 1.62, quantities: Array(6).fill(3000) });

  // Scenario 5: pallets in pounds.
  const pallet = materialId.PALLET;
  const kPallet = addContract({ supplier: "30109", company_code: "CC-1000", material: pallet, price: 12.4, price_unit: 1, order_unit: "EA", incoterm: "DAP", currency: "EUR", valid_from: -390, valid_to: 340 });
  series({ tag: "S5", plant: "1010", supplier: "30109", material: pallet, order_unit: "EA", net_price: 12.4, contract: kPallet, quantities: Array(9).fill(1000) });
  series({ tag: "S5", plant: "1020", supplier: "30109", material: pallet, order_unit: "EA", net_price: 12.4, contract: kPallet, quantities: Array(6).fill(1000) });
  series({ tag: "S5", plant: "3010", supplier: "30080", material: pallet, order_unit: "EA", net_price: 12.65, quantities: Array(8).fill(500) });
  series({ tag: "S5", plant: "2010", supplier: "80003", material: pallet, order_unit: "EA", net_price: 14.8, quantities: Array(7).fill(500) });

  // Scenario 6: the same shoe on two material numbers (same manufacturer and part number).
  const shoeDe = materialId["SHOE-DE"];
  const shoeFr = materialId["SHOE-FR"];
  const kShoe = addContract({ supplier: "30135", company_code: "CC-1000", material: shoeDe, price: 61.5, price_unit: 1, order_unit: "EA", incoterm: "DAP", currency: "EUR", valid_from: -380, valid_to: 350 });
  series({ tag: "S6", plant: "1010", supplier: "30135", material: shoeDe, order_unit: "EA", net_price: 61.5, contract: kShoe, quantities: Array(6).fill(200) });
  series({ tag: "S6", plant: "1020", supplier: "30135", material: shoeDe, order_unit: "EA", net_price: 61.5, contract: kShoe, quantities: Array(5).fill(100) });
  series({ tag: "S6", plant: "3010", supplier: "80002", material: shoeFr, order_unit: "EA", net_price: 78, quantities: Array(7).fill(100) });

  // Past case, implemented: Duisburg's cable ties moved from 30049 to 30041 at a contract price, day -90.
  const tie = materialId.CABLETIE;
  const kTie = addContract({ supplier: "30041", company_code: "CC-1000", material: tie, price: 4, price_unit: 1, order_unit: "PAK", incoterm: "DAP", currency: "EUR", valid_from: -95, valid_to: 635 });
  series({ tag: "P1-baseline", plant: "1020", supplier: "30049", material: tie, order_unit: "PAK", net_price: 5, quantities: Array(8).fill(1000), days: [-452, -406, -360, -315, -270, -225, -180, -135] });
  series({ tag: "P1-baseline", plant: "1020", supplier: "30049", material: tie, order_unit: "PAK", net_price: 5, quantities: [600], days: [-100] });
  series({ tag: "P1-after", plant: "1020", supplier: "30041", material: tie, order_unit: "PAK", net_price: 4, contract: kTie, quantities: [600, 500, 600, 300], days: [-80, -58, -26, -9] });
  series({ tag: "P1-leakage", plant: "1020", supplier: "30093", material: tie, order_unit: "PAK", net_price: 4.5, quantities: [200], days: [-47] });
  series({ tag: "P1", plant: "1010", supplier: "30041", material: tie, order_unit: "PAK", net_price: 4, contract: kTie, quantities: [300, 300], days: [-70, -21] });
  series({ tag: "P1", plant: "1010", supplier: "30065", material: tie, order_unit: "PAK", net_price: 4.02, quantities: [300, 300, 300, 300], days: [-340, -270, -200, -130] });
  series({ tag: "P1", plant: "3010", supplier: "30063", material: tie, order_unit: "PAK", net_price: 4.03, quantities: [200, 200, 200, 200, 200], days: [-320, -250, -180, -110, -35] });

  // Past case, approved and not implemented: Lyon's stretch film, approved twelve days ago.
  const film = materialId.FILM;
  const kFilm = addContract({ supplier: "30025", company_code: "CC-1000", material: film, price: 17.8, price_unit: 1, order_unit: "ROL", incoterm: "DAP", currency: "EUR", valid_from: -410, valid_to: 320 });
  series({ tag: "P2", plant: "1010", supplier: "30025", material: film, order_unit: "ROL", net_price: 17.8, contract: kFilm, quantities: Array(6).fill(400) });
  series({ tag: "P2", plant: "1020", supplier: "30025", material: film, order_unit: "ROL", net_price: 17.8, contract: kFilm, quantities: Array(6).fill(250) });
  series({ tag: "P2", plant: "3010", supplier: "30080", material: film, order_unit: "ROL", net_price: 19.5, quantities: Array(8).fill(250) });
  series({ tag: "P2", plant: "2010", supplier: "80003", material: film, order_unit: "ROL", net_price: 15.5, quantities: Array(4).fill(250) });

  // Background: every other material varies within a few per cent.
  for (const m of BACKGROUND) {
    const category = groupOf[m.group].vendor_category;
    const pool = POOLS[category];
    const isService = m.group.startsWith("SRV");
    let contract = null;
    let mainSupplier = null;
    for (const plant of Object.keys(m.plants).sort()) {
      const annual = m.plants[plant];
      const gb = PLANT[plant].country === "GB";
      const sameCountry = pool.filter((id) => supplierById[id].country === PLANT[plant].country);
      const candidates = gb ? [GB_ACCOUNT[category]] : pool;
      const main = gb ? candidates[0]
        : plant !== "3010" && mainSupplier && CONTRACTED.includes(m.key) ? mainSupplier
          : weighted(candidates.map((id) => [id, sameCountry.includes(id) ? 3 : 1]));
      if (!gb && plant !== "3010" && !mainSupplier) mainSupplier = main;
      const second = !gb && rng() < 0.25 ? pick(candidates.filter((id) => id !== main)) : null;
      const pairs = second ? [[main, 0.75], [second, 0.25]] : [[main, 1]];
      for (const [supplier, part] of pairs) {
        const onContract = CONTRACTED.includes(m.key) && supplier === mainSupplier && PLANT[plant].company_code === "CC-1000";
        const factor = onContract ? 0.995 : rand(0.99, 1.02);
        const incoterm = isService ? null : onContract ? "DAP" : weighted(INCOTERM_WEIGHTS);
        const uplift = incoterm && ["E", "F"].includes(INCOTERM_GROUPS[incoterm]) ? DEFAULTS.logistics_uplift : 0;
        const currency = supplierById[supplier].currency;
        const rate = bundled[currency];
        const orderUnit = m.orderUnit;
        const basePerOrder = baseUnitsPerOrderUnit(orderUnit, { base_unit: m.base, conversions: m.conversions }, DEFAULTS);
        const target = m.price * factor;
        const perOrderUnit = (target * basePerOrder) / (rate * (1 + uplift));
        const priceUnit = [1, 10, 100, 1000].find((u) => perOrderUnit * u >= 5) ?? 1000;
        const listNet = round2(perOrderUnit * priceUnit);
        if (onContract && !contract) {
          contract = addContract({ supplier, company_code: "CC-1000", material: materialId[m.key], price: listNet, price_unit: priceUnit, order_unit: orderUnit, incoterm, currency, valid_from: -randInt(370, 420), valid_to: randInt(250, 360) });
        }
        const n = Math.max(2, Math.round(randInt(3, 11) * part));
        const quantityBase = annual * part;
        const weights = Array.from({ length: n }, () => rand(0.6, 1.4));
        const total = weights.reduce((s, w) => s + w, 0);
        const days = spreadDays(n, -362, -2);
        weights.forEach((w, k) => {
          const quantity = Math.max(1, Math.round((quantityBase * w) / total / basePerOrder));
          const net = onContract ? listNet : round2(perOrderUnit * priceUnit * (1 + rand(-0.003, 0.003)));
          const urgent = rng() < 0.03;
          addLine({ tag: "background", plant, supplier, material: materialId[m.key], order_unit: orderUnit, net_price: net, price_unit: priceUnit, currency, incoterm, quantity, order_day: days[k], contract: onContract ? contract : null, urgent, urgent_reason: urgent ? pick(reasonsFor(plant)) : null, cancelled: rng() < 0.007 });
        });
      }
    }
  }
  // An order unit without a conversion in the background (excluded and listed).
  addLine({ tag: "excluded", plant: "1020", supplier: "30093", material: materialId["TLS-CUTDISC"], order_unit: "KAR", net_price: 31.9, quantity: 4, order_day: -164, incoterm: "DAP" });

  // Free-text lines in the background: in no comparable group unless a person confirms a cluster.
  const freeText = [
    ["1010", "30054", "SRV-FAC", "Umzugsservice Büroetage 3, pauschal", "AU", 4800, 1, -233],
    ["1010", "30096", "SRV-FAC", "Entsorgung Altmobiliar, pauschal", "AU", 1350, 1, -96],
    ["1020", "30040", "SRV-FAC", "Wartung Rolltore Halle 2, Stundensatz", "H", 64, 24, -187],
    ["1020", "30040", "SRV-FAC", "Wartung Rolltore Halle 4, Stundensatz", "H", 64, 16, -61],
    ["3010", "30023", "SRV-FAC", "Nettoyage vitres, forfait trimestriel", "AU", 1180, 1, -270],
    ["3010", "30023", "SRV-FAC", "Nettoyage vitres, forfait trimestriel", "AU", 1180, 1, -179],
    ["3010", "30023", "SRV-FAC", "Nettoyage vitres, forfait trimestriel", "AU", 1180, 1, -88],
    ["2010", "80007", "SRV-FAC", "Pest control visit, quarterly", "AU", 240, 1, -250],
    ["2010", "80007", "SRV-FAC", "Pest control visit, quarterly", "AU", 240, 1, -160],
    ["2010", "80007", "SRV-FAC", "Pest control visit, quarterly", "AU", 240, 1, -70],
    ["1010", "30050", "SRV-CON", "Interim-Leitung Einkauf, Tagessatz", "DAY", 1380, 15, -140],
    ["1010", "30020", "SRV-CON", "Moderation Lieferantenstrategie, pauschal", "AU", 6400, 1, -300],
    ["3010", "30128", "SRV-CON", "Audit fournisseurs, prestation forfaitaire", "AU", 5200, 1, -215],
    ["1020", "30137", "SRV-ITS", "Netzwerkverkabelung Werkhalle, pauschal", "AU", 7600, 1, -120],
    ["1010", "30066", "SRV-ITS", "Softwarelizenzberatung, Stundensatz", "H", 135, 12, -205],
    ["3010", "30060", "SRV-ITS", "Câblage réseau atelier, forfait", "AU", 6900, 1, -52],
    ["2010", "80006", "SRV-ITS", "Laptop imaging, per device", "EA", 45, 60, -110],
    ["1020", "30070", "SRV-SEC", "Brandwache Instandhaltungswochenende, Stundensatz", "H", 38, 48, -150],
    ["3010", "30107", "SRV-SEC", "Rondes de sécurité week-end, tarif horaire", "H", 33, 96, -230],
    ["2010", "80008", "SRV-SEC", "Event security, hourly rate", "H", 36, 40, -30]
  ];
  for (const [plant, supplier, group, text, unit, price, quantity, day] of freeText) {
    addLine({ tag: "free-text", plant, supplier, material: null, material_group: group, short_text: text, order_unit: unit, net_price: price, quantity, order_day: day, incoterm: null });
  }

  // Order numbers in time order; contract ids in creation order.
  contracts.forEach((c, i) => { c.id = String(4600000101 + i); });
  const order = [...lines].sort((a, b) => a.order_day - b.order_day || a.plant.localeCompare(b.plant) || a.supplier.localeCompare(b.supplier) || String(a.material ?? "").localeCompare(String(b.material ?? "")) || a.short_text.localeCompare(b.short_text) || a.quantity - b.quantity);
  const poLines = order.map((l, i) => {
    const orderNo = String(4500010001 + i);
    return {
      id: `${orderNo}-00010`,
      order: orderNo,
      item: "00010",
      company_code: PLANT[l.plant].company_code,
      plant: l.plant,
      supplier: l.supplier,
      material: l.material,
      short_text: l.short_text,
      material_group: l.material_group,
      quantity: l.quantity,
      order_unit: l.order_unit,
      net_price: l.net_price,
      price_unit: l.price_unit,
      currency: l.currency,
      incoterm: l.incoterm,
      order_day: l.order_day,
      contract: l.contract ? l.contract.id : null,
      buyer: buyerOf(l.plant, l.material_group),
      urgent: l.urgent,
      urgent_reason: l.urgent_reason,
      cancelled: l.cancelled
    };
  });
  const tags = order.map((l) => l.tag);

  const valueLog = [
    { id: "VL-01", group: tie, option: "H", plant: "1020", old_supplier: "30049", new_supplier: "30041", new_price: 0.04, approved_day: -120, approved_savings_eur: 8000, bundle_part_eur: 0, implemented_day: -90 },
    { id: "VL-02", group: film, option: "H", plant: "3010", old_supplier: "30080", new_supplier: "30025", new_price: 17.8, approved_day: -12, approved_savings_eur: 3400, bundle_part_eur: 0, implemented_day: null }
  ];

  const world = {
    meta: {
      company: "GlobalCorp SE",
      company_note: "GlobalCorp SE, its company codes, plants, supplier accounts, materials, contracts, prices and order lines are fictional. Fictional company, no client data.",
      world_version: WORLD_VERSION,
      seed: SEED,
      generator: "tools/build_world.mjs",
      days: "Day numbers count from the day the app is opened: day 0 is today, negative days are past.",
      window_days: DEFAULTS.window_days,
      method_version: METHOD_VERSION,
      sources: {
        accounts: `tools/source/accounts.json (Rebate Hunter ${accounts.source.commit ?? ""}, world ${accounts.source.world_version}): ${accounts.counts.kept} accounts`,
        material_groups: `tools/source/material_groups.json ${taxonomy.version}`,
        background_rate: `The scenarios' prices in pounds are fixed in pounds; the background's are set at the bundled rate (${fx.version}).`
      }
    },
    company_code: accounts.company_codes.map(({ id, code, name, city, country, currency }) => ({ id, code, name, city, country, currency })),
    plant: PLANTS.map(({ lang, ...p }) => p),
    material_group: taxonomy.groups.map(({ code, name, category, vendor_category }) => ({ id: code, name, category, vendor_category })),
    supplier: suppliers.map(({ id, name, city, country, currency, category, company_code, delivers_to, added }) => ({ id, name, city, country, currency, category, company_code, delivers_to, added })),
    buyer: BUYERS,
    material: materials,
    contract: contracts.map(({ id, supplier, company_code, material, price, price_unit, order_unit, incoterm, currency, valid_from, valid_to }) => ({ id, supplier, company_code, material, price, price_unit, order_unit, incoterm, currency, valid_from, valid_to })),
    po_line: poLines,
    value_log: valueLog
  };
  const scenarioLines = (tag) => poLines.filter((_, i) => tags[i] === tag).map((l) => l.id);
  return { world, materialId, tags, cluster: { id: "CL-01", base_unit: "PD", material_group: "SRV-CON", label: "SAP FI/CO finance consultant", line_ids: scenarioLines("S2") } };
}

// ---- scenarios and their frozen reference figures ---------------------------------------------------------
export function scenariosOf(materialId) {
  return [
    { id: "SC-GLOVES", number: 1, title: "Gloves at three sites", short: "Gloves", category: "MRO supplies", seed: "Lyon seems to pay far more for nitrile gloves than Frankfurt.", group_id: materialId.GLOVES },
    { id: "SC-CONSULT", number: 2, title: "Same consultant, different day rate", short: "Consultants", category: "Consulting", seed: "Our SAP finance consultants cost very different amounts depending on who orders them.", group_id: null, material_group: "SRV-CON" },
    { id: "SC-HOSES", number: 3, title: "Express is not a reason", short: "Hoses", category: "MRO supplies", seed: "Duisburg says its higher prices for hydraulic hoses come from urgent orders.", group_id: materialId.HOSE },
    { id: "SC-BOXES", number: 4, title: "It's the delivery terms", short: "Boxes", category: "Packaging", seed: "The UK pays 6% more for corrugated boxes than Lyon.", group_id: materialId.BOX },
    { id: "SC-PALLETS", number: 5, title: "Pallets in pounds", short: "Pallets", category: "Packaging", seed: "Birmingham's pallet prices look high, but they are in pounds.", group_id: materialId.PALLET },
    { id: "SC-SHOES", number: 6, title: "Same shoe, two numbers", short: "Shoes", category: "MRO supplies", seed: "Our safety shoes are on two different material numbers.", group_id: "MPN:Brekholt:BH-7730-S3" }
  ];
}

/** The engine's context for the world at a set of rates. */
export function contextOf(world, rates, params = DEFAULTS) {
  return {
    rates,
    params,
    today: 0,
    plants: Object.fromEntries(world.plant.map((p) => [p.id, p])),
    suppliers: Object.fromEntries(world.supplier.map((s) => [s.id, s]))
  };
}
export const ratesOf = (fx) => Object.fromEntries(Object.entries(fx.currencies).map(([c, v]) => [c, v.rate_to_eur]));

/** The figures a check compares: totals, benchmark, flag and the options. */
export function figuresOf(a) {
  const option = (o) => ({
    applicable: o.applicable, savings: o.savings, bundle: o.bundle, one_off: o.one_off, net: o.net, residual: o.residual,
    index_after: o.index_after, days_to_first_saving: o.days_to_first_saving, plants: o.plants, suppliers: o.suppliers,
    ...(o.id === "H" ? { plants_moved: o.plants_moved, plants_not_covered: o.plants_not_covered, share_after: o.share_after } : {})
  });
  return {
    group: a.id, kind: a.kind, base_unit: a.base_unit, display_quantity: a.display_quantity,
    lines: a.lines.length, excluded: a.excluded.map((x) => x.reason), cancelled: a.cancelled.length,
    quantity: a.quantity, spend: a.spend, gap: a.gap, justified: a.justified, unexplained: a.unexplained,
    index: a.index, spread: a.spread, flagged: a.flagged,
    benchmark: a.benchmark && { pair: a.benchmark.pair, price: a.benchmark.price, share: a.benchmark.share },
    highest: a.highest && { pair: a.highest.pair, price: a.highest.price },
    pairs: a.pairs.map((p) => ({ pair: p.id, quantity: p.quantity, price: p.price, share: p.share, unexplained: p.unexplained })),
    options: { H: option(a.options.H), R: option(a.options.R), B: option(a.options.B) }
  };
}

/** Analyses of the world at a set of rates (with a confirmed cluster when given). */
export function analyseWorld(world, rates, { clusters = [], params = DEFAULTS } = {}) {
  const ctx = contextOf(world, rates, params);
  const groups = buildGroups(world, ctx, { clusters });
  return { ctx, analyses: groups.map((g) => analyseGroup(g, ctx)) };
}

export function referenceOf(world, fx, scenarios, cluster) {
  const rates = ratesOf(fx);
  const { analyses } = analyseWorld(world, rates, { clusters: [cluster] });
  const byId = Object.fromEntries(analyses.map((a) => [a.id, a]));
  const shifted = (factor) => ({ ...rates, GBP: rates.GBP * factor });
  const at = (factor) => Object.fromEntries(analyseWorld(world, shifted(factor), { clusters: [cluster] }).analyses.map((a) => [a.id, a]));
  const low = at(0.95);
  const high = at(1.05);
  const index = groupIndex(world, { clusters: [cluster] });
  const ctx = contextOf(world, rates);
  const pipeline = valuePipeline({ valueLog: world.value_log, approvals: [], identified: 0, lines: world.po_line, unitOf: (l) => unitOfLine(index, l), ctx });
  const tie = world.value_log[0].group;
  const withoutRule = analyseGroup({ ...buildGroups({ ...world, value_log: [] }, ctx).find((g) => g.id === tie) }, ctx);
  const cases = {};
  for (const s of scenarios) {
    const id = s.group_id ?? cluster.id;
    cases[s.id] = {
      number: s.number,
      group_id: id,
      ...(s.group_id ? {} : { cluster: { id: cluster.id, base_unit: cluster.base_unit, material_group: cluster.material_group, line_ids: cluster.line_ids } }),
      figures: figuresOf(byId[id]),
      flagged_at_rate_minus_5_pct: low[id].flagged,
      flagged_at_rate_plus_5_pct: high[id].flagged
    };
  }
  const [vl1, vl2] = world.value_log;
  const real = pipeline.cases[0];
  return {
    about: "Each scenario's figures as the engine computes them from data/world.js at the bundled rates of data/fx.js, frozen for the checks in tools/check_world.mjs. Never shown to the agent; the simulation recomputes every figure at playback.",
    world_version: world.meta.world_version,
    fx_version: fx.version,
    method_version: METHOD_VERSION,
    cases,
    past_cases: {
      implemented: {
        entry: vl1.id, group: vl1.group, plant: vl1.plant, baseline: real.baseline, baseline_lines: real.baseline_lines.length,
        realised: real.realised, leakage_lines: real.leakage.length, leakage_quantity: real.leakage_quantity, missed: real.missed,
        analysed_after_implementation: { flagged: byId[tie].flagged, opportunity: byId[tie].opportunity, lines: byId[tie].lines.length },
        without_the_rule: { flagged: withoutRule.flagged, opportunity: withoutRule.opportunity, lines: withoutRule.lines.length }
      },
      approved: { entry: vl2.id, group: vl2.group, plant: vl2.plant, flagged: byId[vl2.group].flagged, opportunity: byId[vl2.group].opportunity }
    },
    pipeline: { approved: pipeline.approved, implemented: pipeline.implemented, realised: pipeline.realised, leakage_lines: pipeline.leakage_lines, leakage_missed: pipeline.leakage_missed }
  };
}

// ---- files ---------------------------------------------------------------------------------------------
function recordsText(name, rows) {
  return `"${name}": [\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(",\n")}\n]`;
}
export function worldText(world) {
  const parts = Object.entries(world).map(([k, v]) => (Array.isArray(v) ? recordsText(k, v) : `"${k}": ${JSON.stringify(v, null, 2)}`));
  return `/*
 * PRICE VARIANCE AGENT: GlobalCorp SE's data products (written by tools/build_world.mjs; do not edit by hand).
 *
 * Fictional company, no client data. The company codes and supplier accounts are those of Rebate Hunter's
 * world (tools/source/accounts.json); materials, contracts, prices and order lines are invented, with each
 * scenario's pattern planted on purpose. Day numbers count from the day the app is opened (day 0 is today).
 * Data products: company_code, plant, material_group, supplier, buyer, material, contract, po_line, value_log;
 * the exchange rates (fx_rate) are in data/fx.js.
 */
window.WORLD = {
${parts.join(",\n")}
};
`;
}
export function scenariosText(scenarios) {
  return `/*
 * PRICE VARIANCE AGENT: the six tips (written by tools/build_world.mjs).
 *
 * Each scenario is a short, unverified tip, written the way a first hint arrives. In Live mode the agent
 * gets the tip ("seed") and nothing else. group_id is the comparable group the board shows when the
 * scenario is chosen (null for scenario 2, whose group exists only after a person confirms a cluster); the
 * agent never sees it.
 */
window.SCENARIOS = ${JSON.stringify(scenarios, null, 2)};
`;
}
export function referenceText(reference) {
  return `/*
 * PRICE VARIANCE AGENT: frozen reference figures (written by tools/build_world.mjs, for the checks only).
 */
window.REFERENCE_CASES = ${JSON.stringify(reference, null, 2)};
`;
}

function loadScript(file, name) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(file, "utf8"), sandbox);
  return sandbox.window[name];
}

/** Builds the three files' texts from the inputs on disk. */
export function buildAll() {
  const accounts = JSON.parse(readFileSync(path.join(ROOT, "tools", "source", "accounts.json"), "utf8"));
  const taxonomy = JSON.parse(readFileSync(path.join(ROOT, "tools", "source", "material_groups.json"), "utf8"));
  const fx = loadScript(path.join(ROOT, "data", "fx.js"), "FX");
  const { world, materialId, cluster } = buildWorld({ accounts, taxonomy, fx });
  const scenarios = scenariosOf(materialId);
  const reference = referenceOf(world, fx, scenarios, cluster);
  return {
    "data/world.js": worldText(world),
    "data/scenarios.js": scenariosText(scenarios),
    "data/reference_cases.js": referenceText(reference)
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const files = buildAll();
  if (process.argv.includes("--check")) {
    const stale = Object.entries(files).filter(([f, text]) => { try { return readFileSync(path.join(ROOT, f), "utf8") !== text; } catch { return true; } }).map(([f]) => f);
    if (stale.length) { console.log(`WORLD FILES DIFFER: ${stale.join(", ")} (node tools/build_world.mjs)`); process.exit(1); }
    console.log("WORLD FILES CURRENT");
  } else {
    for (const [f, text] of Object.entries(files)) writeFileSync(path.join(ROOT, f), text);
    console.log(`WORLD BUILT: ${Object.keys(files).join(", ")}`);
  }
}
