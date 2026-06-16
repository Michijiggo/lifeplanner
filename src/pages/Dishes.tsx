import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCategories } from "../data/useCategories";
import { UNCATEGORIZED, type Dish, type DishIngredient } from "../lib/types";
import { extractNutritionFromLines, parseIngredientLine, parseRecipes } from "../data/categorize";
import { useShopping } from "../shopping/ShoppingProvider";
import DishEditor from "./DishEditor";

export default function Dishes() {
  const categories = useCategories();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const { addToShopping } = useShopping();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  async function reload() {
    const { data } = await supabase
      .from("dishes")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("name");
    setDishes((data as Dish[]) ?? []);
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dishes;
    return dishes.filter((d) => d.name.toLowerCase().includes(q));
  }, [dishes, search]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function createDish() {
    const name = prompt("Name des Gerichts?");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from("dishes")
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    await reload();
    setOpenId((data as Dish).id);
  }

  async function importRecipes() {
    const recipes = parseRecipes(importText);
    if (recipes.length === 0) {
      flash("Keine Rezepte erkannt.");
      return;
    }
    setImporting(true);
    let dishCount = 0;
    let ingCount = 0;
    for (const r of recipes) {
      const { nutrition, remaining } = extractNutritionFromLines(r.lines);
      const dishInsert: Record<string, unknown> = { name: r.name };
      if (nutrition.servings !== undefined) dishInsert.servings = nutrition.servings;
      if (nutrition.kcal !== undefined) dishInsert.kcal_per_serving = nutrition.kcal;
      if (nutrition.protein !== undefined) dishInsert.protein_per_serving = nutrition.protein;
      if (nutrition.carbs !== undefined) dishInsert.carbs_per_serving = nutrition.carbs;
      if (nutrition.fat !== undefined) dishInsert.fat_per_serving = nutrition.fat;
      const { data: d, error } = await supabase
        .from("dishes")
        .insert(dishInsert)
        .select()
        .single();
      if (error || !d) continue;
      dishCount++;
      const parsed = remaining
        .map((l) => parseIngredientLine(l))
        .filter((p): p is NonNullable<typeof p> => p !== null);
      if (parsed.length > 0) {
        const rows = parsed.map((p, idx) => ({
          dish_id: (d as Dish).id,
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category_id: p.category_id,
          sort_order: idx,
        }));
        const { error: e2 } = await supabase.from("dish_ingredients").insert(rows);
        if (!e2) ingCount += parsed.length;
      }
    }
    setImporting(false);
    setImportText("");
    setShowImport(false);
    await reload();
    flash(`✅ ${dishCount} Rezepte mit ${ingCount} Zutaten importiert`);
  }

  async function toggleFav(d: Dish) {
    setDishes((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, is_favorite: !x.is_favorite } : x))
    );
    await supabase.from("dishes").update({ is_favorite: !d.is_favorite }).eq("id", d.id);
    reload();
  }

  async function addToList(d: Dish) {
    const { data: ings } = await supabase
      .from("dish_ingredients")
      .select("*")
      .eq("dish_id", d.id);
    const list = (ings as DishIngredient[]) ?? [];
    if (list.length === 0) {
      flash(`"${d.name}" hat noch keine Zutaten.`);
      return;
    }
    await addToShopping(
      list.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category_id: i.category_id ?? UNCATEGORIZED,
        source_dish_id: d.id,
      }))
    );
  }

  if (openId) {
    return (
      <DishEditor
        dishId={openId}
        categories={categories}
        onClose={() => {
          setOpenId(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="dish-toolbar">
        <input
          className="search"
          placeholder="Gericht suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="import-btn" onClick={() => setShowImport(true)} aria-label="Rezepte importieren">
          📋
        </button>
        <button className="add-btn" onClick={createDish}>
          +
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">🍲</div>
          <p>Noch keine Gerichte gespeichert.</p>
          <p className="empty-hint">
            Lege deine Lieblingsgerichte an – dann genügt ein Klick, um alle Zutaten auf die
            Einkaufsliste zu setzen.
          </p>
        </div>
      )}

      <div className="dish-grid">
        {filtered.map((d) => (
          <div key={d.id} className="dish-card">
            <button className="fav" onClick={() => toggleFav(d)} aria-label="Favorit">
              {d.is_favorite ? "★" : "☆"}
            </button>
            <div className="dish-info" onClick={() => setOpenId(d.id)}>
              <div className="dish-name">{d.name}</div>
              <div className="dish-meta">
                {d.servings} Portionen
                {d.kcal_per_serving != null && (
                  <span> · {d.kcal_per_serving} kcal</span>
                )}
              </div>
            </div>
            <button className="dish-add" onClick={() => addToList(d)}>
              + Liste
            </button>
          </div>
        ))}
      </div>

      {showImport && (
        <div className="sheet-backdrop" onClick={() => !importing && setShowImport(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Mehrere Rezepte importieren</h3>
            <p className="empty-hint" style={{ textAlign: "left", marginTop: 0 }}>
              Pro Rezept eine Überschrift mit <code>//</code> davor, darunter die Zutaten
              (eine pro Zeile).
            </p>
            <textarea
              className="bulk-text"
              autoFocus
              placeholder={"// Spaghetti Bolognese\n500 g Hackfleisch\n1 Dose Tomaten\n1 Zwiebel\n\n// Pfannkuchen\n250 g Mehl\n3 Eier\n500 ml Milch"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="bulk-actions">
              <button
                className="sheet-close"
                onClick={() => setShowImport(false)}
                disabled={importing}
              >
                Abbrechen
              </button>
              <button className="add-btn-wide" onClick={importRecipes} disabled={importing}>
                {importing ? "Importiere…" : "Importieren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
