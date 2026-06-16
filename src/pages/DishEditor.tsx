import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { UNCATEGORIZED, type Category, type Dish, type DishIngredient } from "../lib/types";
import { extractNutritionFromLines, parseIngredientLine } from "../data/categorize";
import { useShopping } from "../shopping/ShoppingProvider";

type Props = {
  dishId: string;
  categories: Category[];
  onClose: () => void;
};

export default function DishEditor({ dishId, categories, onClose }: Props) {
  const { addToShopping } = useShopping();
  const [dish, setDish] = useState<Dish | null>(null);
  const [ings, setIngs] = useState<DishIngredient[]>([]);
  const [quick, setQuick] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [{ data: d }, { data: i }] = await Promise.all([
      supabase.from("dishes").select("*").eq("id", dishId).single(),
      supabase.from("dish_ingredients").select("*").eq("dish_id", dishId).order("sort_order"),
    ]);
    setDish(d as Dish);
    setIngs((i as DishIngredient[]) ?? []);
  }

  useEffect(() => {
    reload();
  }, [dishId]);

  async function saveDishField(patch: Partial<Dish>) {
    setDish((prev) => (prev ? { ...prev, ...patch } : prev));
    await supabase.from("dishes").update(patch).eq("id", dishId);
  }

  // Mehrere Zeilen auf einmal einfügen und parsen.
  async function addLines(text: string) {
    const lines = text
      .split("\n")
      .map((l) => parseIngredientLine(l))
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (lines.length === 0) return 0;

    const base = ings.length;
    const rows = lines.map((p, idx) => ({
      dish_id: dishId,
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      category_id: p.category_id,
      sort_order: base + idx,
    }));
    const { data, error } = await supabase.from("dish_ingredients").insert(rows).select();
    if (error) {
      alert(error.message);
      return 0;
    }
    setIngs((prev) => [...prev, ...((data as DishIngredient[]) ?? [])]);
    return lines.length;
  }

  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    await addLines(quick);
    setQuick("");
    quickRef.current?.focus();
  }

  async function addBulk() {
    const rawLines = bulk.split("\n");
    const { nutrition, remaining } = extractNutritionFromLines(rawLines);
    const hasNutrition = Object.keys(nutrition).length > 0;
    if (hasNutrition) {
      const patch: Partial<Dish> = {};
      if (nutrition.kcal !== undefined) patch.kcal_per_serving = nutrition.kcal;
      if (nutrition.protein !== undefined) patch.protein_per_serving = nutrition.protein;
      if (nutrition.carbs !== undefined) patch.carbs_per_serving = nutrition.carbs;
      if (nutrition.fat !== undefined) patch.fat_per_serving = nutrition.fat;
      await saveDishField(patch);
    }
    const n = await addLines(remaining.join("\n"));
    if (n > 0 || hasNutrition) {
      setBulk("");
      setShowBulk(false);
    }
  }

  async function setIngredientCategory(id: string, category_id: number) {
    setIngs((prev) => prev.map((i) => (i.id === id ? { ...i, category_id } : i)));
    await supabase.from("dish_ingredients").update({ category_id }).eq("id", id);
  }

  // Lokale Änderung beim Tippen (sofort sichtbar)
  function patchLocal(id: string, patch: Partial<DishIngredient>) {
    setIngs((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  // In die Datenbank speichern (beim Verlassen des Feldes)
  async function persist(id: string, patch: Partial<DishIngredient>) {
    await supabase.from("dish_ingredients").update(patch).eq("id", id);
  }

  async function removeIngredient(id: string) {
    setIngs((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("dish_ingredients").delete().eq("id", id);
  }

  async function deleteDish() {
    if (!dish) return;
    if (!confirm(`Gericht "${dish.name}" wirklich löschen?`)) return;
    await supabase.from("dishes").delete().eq("id", dishId);
    onClose();
  }

  async function addAllToList() {
    if (!dish || ings.length === 0) return;
    await addToShopping(
      ings.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category_id: i.category_id ?? UNCATEGORIZED,
        source_dish_id: dishId,
      }))
    );
  }

  if (!dish) return <div className="page">Lädt…</div>;

  return (
    <div className="page editor">
      <div className="editor-head">
        <button className="back" onClick={onClose}>
          ‹ Zurück
        </button>
        <button className="link-danger" onClick={deleteDish}>
          Löschen
        </button>
      </div>

      <input
        className="editor-title"
        value={dish.name}
        onChange={(e) => setDish({ ...dish, name: e.target.value })}
        onBlur={(e) => saveDishField({ name: e.target.value.trim() || "Unbenannt" })}
      />

      <div className="editor-row">
        <label>
          Portionen
          <input
            type="number"
            min={1}
            value={dish.servings}
            onChange={(e) => saveDishField({ servings: Number(e.target.value) || 1 })}
          />
        </label>
        <button
          className={`fav-toggle ${dish.is_favorite ? "on" : ""}`}
          onClick={() => saveDishField({ is_favorite: !dish.is_favorite })}
        >
          {dish.is_favorite ? "★ Favorit" : "☆ Favorit"}
        </button>
      </div>

      <textarea
        className="editor-notes"
        placeholder="Notizen / Zubereitung (optional)…"
        value={dish.notes ?? ""}
        onChange={(e) => setDish({ ...dish, notes: e.target.value })}
        onBlur={(e) => saveDishField({ notes: e.target.value || null })}
      />

      <h3 className="section-title">Nährwerte pro Portion (optional)</h3>
      <div className="nutrition-row">
        {(
          [
            { key: "kcal_per_serving", label: "kcal", unit: "kcal" },
            { key: "protein_per_serving", label: "Protein", unit: "g" },
            { key: "carbs_per_serving", label: "Kohlenhydrate", unit: "g" },
            { key: "fat_per_serving", label: "Fett", unit: "g" },
          ] as { key: keyof Dish; label: string; unit: string }[]
        ).map(({ key, label, unit }) => (
          <label key={key} className="nutrition-field">
            <span className="nutrition-label">{label}</span>
            <div className="nutrition-input-wrap">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="–"
                value={(dish[key] as number | null) ?? ""}
                onChange={(e) =>
                  setDish({ ...dish, [key]: e.target.value === "" ? null : Number(e.target.value) })
                }
                onBlur={(e) =>
                  saveDishField({ [key]: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <span className="nutrition-unit">{unit}</span>
            </div>
          </label>
        ))}
      </div>

      <h3 className="section-title">Zutaten</h3>

      {/* Schnelle Einzel-Eingabe mit Auto-Erkennung */}
      <form className="quick-add" onSubmit={addQuick}>
        <input
          ref={quickRef}
          className="quick-input"
          placeholder="z. B. 500 g Mehl, 2 Eier, Salz…"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
        />
        <button type="submit" className="add-btn">
          +
        </button>
      </form>

      {/* Sammel-Eingabe: ganze Liste auf einmal */}
      {!showBulk ? (
        <button className="bulk-toggle" onClick={() => setShowBulk(true)}>
          📋 Ganze Liste einfügen
        </button>
      ) : (
        <div className="bulk-box">
          <textarea
            className="bulk-text"
            autoFocus
            placeholder={"Eine Zutat pro Zeile, z. B.:\n500 g Mehl\n2 Eier\n1 Pck. Trockenhefe\nSalz"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="bulk-actions">
            <button className="sheet-close" onClick={() => setShowBulk(false)}>
              Abbrechen
            </button>
            <button className="add-btn-wide" onClick={addBulk}>
              Alle hinzufügen
            </button>
          </div>
        </div>
      )}

      <ul className="items">
        {ings.map((i) => (
          <li key={i.id} className="item ing-row">
            <select
              className="ing-cat-select"
              value={i.category_id ?? UNCATEGORIZED}
              onChange={(e) => setIngredientCategory(i.id, Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji}
                </option>
              ))}
            </select>

            {editingId === i.id ? (
              <div className="ing-edit">
                <input
                  className="ing-edit-name"
                  autoFocus
                  value={i.name}
                  placeholder="Zutat"
                  onChange={(e) => patchLocal(i.id, { name: e.target.value })}
                  onBlur={(e) => persist(i.id, { name: e.target.value.trim() || "Zutat" })}
                />
                <div className="ing-edit-row">
                  <input
                    className="ing-edit-qty"
                    inputMode="decimal"
                    placeholder="Menge"
                    value={i.quantity ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      patchLocal(i.id, {
                        quantity: v === "" ? null : Number(v.replace(",", ".")),
                      });
                    }}
                    onBlur={() => persist(i.id, { quantity: i.quantity })}
                  />
                  <input
                    className="ing-edit-unit"
                    placeholder="Einheit"
                    value={i.unit ?? ""}
                    onChange={(e) => patchLocal(i.id, { unit: e.target.value || null })}
                    onBlur={(e) => persist(i.id, { unit: e.target.value.trim() || null })}
                  />
                  <button className="ing-done" onClick={() => setEditingId(null)}>
                    ✓
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="item-name" onClick={() => setEditingId(i.id)}>
                  {i.name}
                  {(i.quantity || i.unit) && (
                    <span className="item-qty">
                      {" "}
                      {i.quantity ?? ""} {i.unit ?? ""}
                    </span>
                  )}
                </span>
                <button
                  className="ing-edit-btn"
                  onClick={() => setEditingId(i.id)}
                  aria-label="bearbeiten"
                >
                  ✎
                </button>
                <button className="item-del" onClick={() => removeIngredient(i.id)}>
                  ✕
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <button className="big-btn" onClick={addAllToList} disabled={ings.length === 0}>
        🛒 Alle Zutaten auf die Einkaufsliste
      </button>
    </div>
  );
}
