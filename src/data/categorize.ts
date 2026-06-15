import { UNCATEGORIZED } from "../lib/types";

// Bekannte Einheiten (Anzeige-Schreibweise). Wird beim Parsen erkannt.
const UNITS: Record<string, string> = {
  g: "g",
  gr: "g",
  gramm: "g",
  kg: "kg",
  mg: "mg",
  ml: "ml",
  l: "l",
  liter: "l",
  cl: "cl",
  dl: "dl",
  el: "EL",
  tl: "TL",
  msp: "Msp.",
  prise: "Prise",
  prisen: "Prise",
  pck: "Pck.",
  pckg: "Pck.",
  packung: "Pck.",
  pkg: "Pck.",
  dose: "Dose",
  dosen: "Dose",
  glas: "Glas",
  bund: "Bund",
  stück: "Stück",
  stk: "Stück",
  zehe: "Zehe",
  zehen: "Zehe",
  scheibe: "Scheibe",
  scheiben: "Scheibe",
  becher: "Becher",
  flasche: "Flasche",
  tasse: "Tasse",
  kopf: "Kopf",
  knolle: "Knolle",
  handvoll: "Handvoll",
};

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
};

// Stichwort -> Kategorie-ID. Reihenfolge zählt: spezifischere Begriffe zuerst,
// damit z. B. "tomatenmark" vor "tomate" greift.
// Kategorien: 1 = Obst & Gemüse, 3 = Gekühltes, 4 = Fleisch & Fisch.
// Alles ohne Treffer landet in 12 = Sonstiges.
const KEYWORDS: [string, number][] = [
  // Fleisch & Fisch
  ["hackfleisch", 4], ["hähnchen", 4], ["hühnchen", 4], ["hühner", 4],
  ["geflügel", 4], ["pute", 4], ["hack", 4], ["rind", 4], ["schwein", 4],
  ["wurst", 4], ["schinken", 4], ["speck", 4], ["bacon", 4], ["salami", 4],
  ["mett", 4], ["gulasch", 4], ["steak", 4], ["frikadelle", 4], ["lamm", 4],
  ["ente", 4], ["lachs", 4], ["thunfisch", 4], ["fisch", 4], ["garnele", 4],
  ["shrimp", 4], ["kabeljau", 4], ["forelle", 4],
  // Gekühltes (Molkerei, Eier, Tiefkühl)
  ["buttermilch", 3], ["milch", 3], ["butter", 3], ["käse", 3], ["quark", 3],
  ["joghurt", 3], ["jogurt", 3], ["sahne", 3], ["schmand", 3], ["frischkäse", 3],
  ["mozzarella", 3], ["feta", 3], ["parmesan", 3], ["creme fraiche", 3],
  ["crème", 3], ["margarine", 3], ["hüttenkäse", 3], ["skyr", 3], ["ei", 3],
  ["eier", 3], ["tiefkühl", 3], ["tk ", 3], ["pizza", 3],
  // Obst & Gemüse
  ["tomatenmark", 12], ["apfel", 1], ["äpfel", 1], ["banane", 1], ["tomate", 1],
  ["gurke", 1], ["salat", 1], ["zwiebel", 1], ["knoblauch", 1], ["kartoffel", 1],
  ["möhre", 1], ["karotte", 1], ["paprika", 1], ["zucchini", 1],
  ["brokkoli", 1], ["blumenkohl", 1], ["spinat", 1], ["zitrone", 1],
  ["limette", 1], ["orange", 1], ["beere", 1], ["avocado", 1], ["lauch", 1],
  ["sellerie", 1], ["pilz", 1], ["champignon", 1], ["ingwer", 1], ["birne", 1],
  ["traube", 1], ["mango", 1], ["kürbis", 1], ["aubergine", 1], ["rucola", 1],
  ["petersilie", 1], ["basilikum", 1], ["koriander", 1], ["schnittlauch", 1],
  ["erbse", 1], ["mais", 1], ["bohne", 1], ["radieschen", 1], ["kohl", 1],
];

export function detectCategory(name: string): number {
  const n = name.toLowerCase();
  for (const [kw, cat] of KEYWORDS) {
    if (n.includes(kw)) return cat;
  }
  return UNCATEGORIZED;
}

export type ParsedIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  category_id: number;
};

// Zerlegt eine Zeile wie "500 g Mehl" / "2 Eier" / "1 Pck. Hefe" / "Salz".
export function parseIngredientLine(raw: string): ParsedIngredient | null {
  let line = raw.trim().replace(/^[-*•·]\s*/, "");
  if (!line) return null;

  let quantity: number | null = null;
  let unit: string | null = null;

  // Unicode-Bruch am Anfang (½ Zitrone)
  const frac = line[0];
  if (FRACTIONS[frac] !== undefined) {
    quantity = FRACTIONS[frac];
    line = line.slice(1).trim();
  } else {
    // Zahl am Anfang: 500 / 1,5 / 2-3 / 1/2
    const m = line.match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*/);
    const slash = line.match(/^(\d+)\s*\/\s*(\d+)\s*/);
    if (slash) {
      quantity = Number(slash[1]) / Number(slash[2]);
      line = line.slice(slash[0].length).trim();
    } else if (m) {
      quantity = Number(m[1].replace(",", "."));
      line = line.slice(m[0].length).trim();
    }
  }

  // Einheit als erstes Wort?
  const parts = line.split(/\s+/);
  if (parts.length > 1) {
    const token = parts[0].replace(/\.$/, "").toLowerCase();
    if (UNITS[token]) {
      unit = UNITS[token];
      line = parts.slice(1).join(" ").trim();
    }
  }

  const name = line.trim();
  if (!name) return null;

  return { name, quantity, unit, category_id: detectCategory(name) };
}

export type ParsedRecipe = { name: string; lines: string[] };

// Zerlegt einen Block mit mehreren Rezepten. Überschriften beginnen mit
// "//" oder "#"; alle folgenden Zeilen sind Zutaten, bis zur nächsten Überschrift.
export function parseRecipes(text: string): ParsedRecipe[] {
  const recipes: ParsedRecipe[] = [];
  let current: ParsedRecipe | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^(?:\/\/|#)\s*(.+)$/);
    if (header) {
      current = { name: header[1].trim() || `Rezept ${recipes.length + 1}`, lines: [] };
      recipes.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      // Zeilen vor der ersten Überschrift -> erstes (unbenanntes) Rezept
      current = { name: `Rezept ${recipes.length + 1}`, lines: [line] };
      recipes.push(current);
    }
  }
  return recipes.filter((r) => r.lines.length > 0);
}
