import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCategories } from "../data/useCategories";
import { UNCATEGORIZED, type Dish, type DishIngredient } from "../lib/types";
import DishEditor from "./DishEditor";

export default function Dishes() {
  const categories = useCategories();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    const rows = list.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category_id: i.category_id ?? UNCATEGORIZED,
      source_dish_id: d.id,
    }));
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) {
      alert(error.message);
      return;
    }
    flash(`✅ ${list.length} Zutaten von "${d.name}" auf die Liste gesetzt`);
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
        onAddToList={(name, count) =>
          flash(`✅ ${count} Zutaten von "${name}" auf die Liste gesetzt`)
        }
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
              <div className="dish-meta">{d.servings} Portionen</div>
            </div>
            <button className="dish-add" onClick={() => addToList(d)}>
              + Liste
            </button>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
