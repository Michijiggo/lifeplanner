import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UNCATEGORIZED, type Category, type Dish, type DishIngredient } from "../lib/types";

type Props = {
  dishId: string;
  categories: Category[];
  onClose: () => void;
  onAddToList: (dishName: string, count: number) => void;
};

export default function DishEditor({ dishId, categories, onClose, onAddToList }: Props) {
  const [dish, setDish] = useState<Dish | null>(null);
  const [ings, setIngs] = useState<DishIngredient[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCat, setNewCat] = useState<number>(UNCATEGORIZED);

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

  async function addIngredient(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const qty = newQty.trim() ? Number(newQty.replace(",", ".")) : null;
    const { data, error } = await supabase
      .from("dish_ingredients")
      .insert({
        dish_id: dishId,
        name,
        quantity: Number.isFinite(qty as number) ? qty : null,
        unit: newUnit.trim() || null,
        category_id: newCat,
        sort_order: ings.length,
      })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setIngs((prev) => [...prev, data as DishIngredient]);
    setNewName("");
    setNewQty("");
    setNewUnit("");
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
    const rows = ings.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category_id: i.category_id ?? UNCATEGORIZED,
      source_dish_id: dishId,
    }));
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) {
      alert(error.message);
      return;
    }
    onAddToList(dish.name, ings.length);
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

      <h3 className="section-title">Zutaten</h3>
      <ul className="items">
        {ings.map((i) => {
          const cat = categories.find((c) => c.id === (i.category_id ?? UNCATEGORIZED));
          return (
            <li key={i.id} className="item">
              <span className="ing-cat">{cat?.emoji ?? "🛒"}</span>
              <span className="item-name">
                {i.name}
                {(i.quantity || i.unit) && (
                  <span className="item-qty">
                    {" "}
                    {i.quantity ?? ""} {i.unit ?? ""}
                  </span>
                )}
              </span>
              <button className="item-del" onClick={() => removeIngredient(i.id)}>
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <form className="add-bar" onSubmit={addIngredient}>
        <input
          className="add-name"
          placeholder="Zutat hinzufügen…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="add-meta">
          <input
            className="add-qty"
            placeholder="Menge"
            inputMode="decimal"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
          />
          <input
            className="add-unit"
            placeholder="Einheit"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          />
          <select value={newCat} onChange={(e) => setNewCat(Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="add-btn">
            +
          </button>
        </div>
      </form>

      <button className="big-btn" onClick={addAllToList} disabled={ings.length === 0}>
        🛒 Alle Zutaten auf die Einkaufsliste
      </button>
    </div>
  );
}
