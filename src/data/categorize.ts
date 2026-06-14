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
// damit z. B. "tomatenmark" (Vorrat) vor "tomate" (Obst & Gemüse) greift.
const KEYWORDS: [string, number][] = [
  // Vorrat / Konserven (spezifisch zuerst)
  ["tomatenmark", 6], ["passierte tomaten", 6], ["gehackte tomaten", 6],
  ["kokosmilch", 6], ["mais", 6], ["kichererbsen", 6], ["kidneybohnen", 6],
  ["bohnen", 6], ["linsen", 6], ["brühe", 6], ["fond", 6], ["oliven", 6],
  ["essiggurke", 6], ["gewürzgurke", 6], ["konserve", 6],
  // Fleisch & Fisch
  ["hackfleisch", 4], ["hähnchen", 4], ["hühnchen", 4], ["hühner", 4],
  ["geflügel", 4], ["pute", 4], ["hack", 4], ["rind", 4], ["schwein", 4],
  ["wurst", 4], ["schinken", 4], ["speck", 4], ["bacon", 4], ["salami", 4],
  ["mett", 4], ["gulasch", 4], ["steak", 4], ["frikadelle", 4], ["lamm", 4],
  ["ente", 4], ["lachs", 4], ["thunfisch", 4], ["fisch", 4], ["garnele", 4],
  ["shrimp", 4], ["kabeljau", 4], ["forelle", 4],
  // Molkerei & Eier (Gekühltes)
  ["buttermilch", 3], ["milch", 3], ["butter", 3], ["käse", 3], ["quark", 3],
  ["joghurt", 3], ["jogurt", 3], ["sahne", 3], ["schmand", 3], ["frischkäse", 3],
  ["mozzarella", 3], ["feta", 3], ["parmesan", 3], ["creme fraiche", 3],
  ["crème", 3], ["margarine", 3], ["hüttenkäse", 3], ["skyr", 3], ["ei", 3],
  ["eier", 3],
  // Backwaren
  ["brötchen", 2], ["baguette", 2], ["toast", 2], ["semmel", 2],
  ["croissant", 2], ["brezel", 2], ["brot", 2],
  // Obst & Gemüse
  ["apfel", 1], ["äpfel", 1], ["banane", 1], ["tomate", 1], ["gurke", 1],
  ["salat", 1], ["zwiebel", 1], ["knoblauch", 1], ["kartoffel", 1],
  ["möhre", 1], ["karotte", 1], ["paprika", 1], ["zucchini", 1],
  ["brokkoli", 1], ["blumenkohl", 1], ["spinat", 1], ["zitrone", 1],
  ["limette", 1], ["orange", 1], ["beere", 1], ["avocado", 1], ["lauch", 1],
  ["sellerie", 1], ["pilz", 1], ["champignon", 1], ["ingwer", 1], ["birne", 1],
  ["traube", 1], ["mango", 1], ["kürbis", 1], ["aubergine", 1], ["rucola", 1],
  ["petersilie", 1], ["basilikum", 1], ["koriander", 1], ["schnittlauch", 1],
  // Nudeln, Reis & Getreide
  ["spaghetti", 7], ["nudel", 7], ["pasta", 7], ["reis", 7], ["couscous", 7],
  ["bulgur", 7], ["quinoa", 7], ["haferflocken", 7], ["müsli", 7],
  ["cornflakes", 7], ["gnocchi", 7], ["spätzle", 7],
  // Gewürze & Backen
  ["salz", 8], ["pfeffer", 8], ["zucker", 8], ["mehl", 8], ["backpulver", 8],
  ["hefe", 8], ["vanille", 8], ["zimt", 8], ["curry", 8], ["paprikapulver", 8],
  ["kreuzkümmel", 8], ["muskat", 8], ["olivenöl", 8], ["öl", 8], ["essig", 8],
  ["senf", 8], ["sojasoße", 8], ["sojasauce", 8], ["honig", 8], ["sirup", 8],
  ["stärke", 8], ["oregano", 8], ["thymian", 8], ["chili", 8],
  // Tiefkühl
  ["tiefkühl", 5], ["tk ", 5], ["pommes", 5], ["eis", 5],
  // Getränke
  ["wasser", 9], ["saft", 9], ["cola", 9], ["limo", 9], ["bier", 9],
  ["wein", 9], ["kaffee", 9], ["tee", 9], ["sprudel", 9], ["smoothie", 9],
  // Süßes & Snacks
  ["schokolade", 10], ["schoko", 10], ["keks", 10], ["chips", 10],
  ["bonbon", 10], ["nuss", 10], ["mandel", 10], ["riegel", 10], ["kuchen", 10],
  // Haushalt & Drogerie
  ["spülmittel", 11], ["klopapier", 11], ["toilettenpapier", 11],
  ["küchenrolle", 11], ["waschmittel", 11], ["shampoo", 11], ["zahnpasta", 11],
  ["seife", 11], ["müllbeutel", 11], ["alufolie", 11], ["frischhaltefolie", 11],
  ["taschentuch", 11], ["reiniger", 11], ["schwamm", 11],
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
