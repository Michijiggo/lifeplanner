import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  UNCATEGORIZED,
  type Dish,
  type DishIngredient,
  type DishList,
} from "../lib/types";
import { useCategories } from "../data/useCategories";
import DishEditor from "./DishEditor";

type ListWithCount = DishList & { count: number };

export default function DishLists() {
  const [lists, setLists] = useState<ListWithCount[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function reload() {
    const [{ data: ls }, { data: items }] = await Promise.all([
      supabase.from("dish_lists").select("*").order("created_at"),
      supabase.from("dish_list_items").select("list_id"),
    ]);
    const counts = new Map<string, number>();
    for (const it of (items as { list_id: string }[]) ?? []) {
      counts.set(it.list_id, (counts.get(it.list_id) ?? 0) + 1);
    }
    setLists(
      ((ls as DishList[]) ?? []).map((l) => ({ ...l, count: counts.get(l.id) ?? 0 }))
    );
  }

  useEffect(() => {
    reload();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function createList() {
    const name = prompt("Name der Liste? (z. B. Wochenende, Lieblingsessen)");
    if (!name || !name.trim()) return;
    const { error } = await supabase.from("dish_lists").insert({ name: name.trim() });
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  if (openId) {
    return (
      <DishListDetail
        listId={openId}
        onClose={() => {
          setOpenId(null);
          reload();
        }}
        onFlash={flash}
      />
    );
  }

  return (
    <div className="page">
      <div className="dish-toolbar">
        <h3 className="section-title" style={{ flex: 1, margin: 0 }}>
          Deine Listen
        </h3>
        <button className="add-btn" onClick={createList}>
          +
        </button>
      </div>

      {lists.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">📑</div>
          <p>Noch keine Listen.</p>
          <p className="empty-hint">
            Erstelle Listen wie „Wochenende" oder „Lieblingsessen" und fülle sie mit
            Gerichten – die Zutaten landen per Klick auf der Einkaufsliste.
          </p>
        </div>
      )}

      <div className="dish-grid">
        {lists.map((l) => (
          <div key={l.id} className="dish-card" onClick={() => setOpenId(l.id)}>
            <div className="dish-info">
              <div className="dish-name">📑 {l.name}</div>
              <div className="dish-meta">
                {l.count} {l.count === 1 ? "Gericht" : "Gerichte"}
              </div>
            </div>
            <span className="chev">›</span>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function DishListDetail({
  listId,
  onClose,
  onFlash,
}: {
  listId: string;
  onClose: () => void;
  onFlash: (msg: string) => void;
}) {
  const [list, setList] = useState<DishList | null>(null);
  const [members, setMembers] = useState<Dish[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [picker, setPicker] = useState(false);
  const [openDishId, setOpenDishId] = useState<string | null>(null);
  const categories = useCategories();

  async function reload() {
    const [{ data: l }, { data: items }, { data: dishes }] = await Promise.all([
      supabase.from("dish_lists").select("*").eq("id", listId).single(),
      supabase.from("dish_list_items").select("dish_id").eq("list_id", listId),
      supabase.from("dishes").select("*").order("is_favorite", { ascending: false }).order("name"),
    ]);
    setList(l as DishList);
    const ids = new Set(((items as { dish_id: string }[]) ?? []).map((i) => i.dish_id));
    const all = (dishes as Dish[]) ?? [];
    setAllDishes(all);
    setMembers(all.filter((d) => ids.has(d.id)));
  }

  useEffect(() => {
    reload();
  }, [listId]);

  async function addDish(dishId: string) {
    setPicker(false);
    const { error } = await supabase
      .from("dish_list_items")
      .insert({ list_id: listId, dish_id: dishId });
    if (error && !/duplicate/i.test(error.message)) {
      alert(error.message);
      return;
    }
    reload();
  }

  async function removeDish(dishId: string) {
    setMembers((prev) => prev.filter((d) => d.id !== dishId));
    await supabase
      .from("dish_list_items")
      .delete()
      .eq("list_id", listId)
      .eq("dish_id", dishId);
  }

  async function renameList() {
    if (!list) return;
    const name = prompt("Liste umbenennen:", list.name);
    if (!name || !name.trim()) return;
    setList({ ...list, name: name.trim() });
    await supabase.from("dish_lists").update({ name: name.trim() }).eq("id", listId);
  }

  async function deleteList() {
    if (!list) return;
    if (!confirm(`Liste "${list.name}" löschen? (Die Gerichte selbst bleiben erhalten.)`)) return;
    await supabase.from("dish_lists").delete().eq("id", listId);
    onClose();
  }

  async function addAllToShopping() {
    if (members.length === 0) {
      onFlash("Diese Liste hat noch keine Gerichte.");
      return;
    }
    const dishIds = members.map((d) => d.id);
    const { data } = await supabase
      .from("dish_ingredients")
      .select("*")
      .in("dish_id", dishIds);
    const ings = (data as DishIngredient[]) ?? [];
    if (ings.length === 0) {
      onFlash("Die Gerichte haben keine Zutaten.");
      return;
    }
    const rows = ings.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category_id: i.category_id ?? UNCATEGORIZED,
      source_dish_id: i.dish_id,
    }));
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) {
      alert(error.message);
      return;
    }
    onFlash(`✅ ${ings.length} Zutaten auf die Einkaufsliste gesetzt`);
  }

  if (openDishId) {
    return (
      <DishEditor
        dishId={openDishId}
        categories={categories}
        onClose={() => {
          setOpenDishId(null);
          reload();
        }}
        onAddToList={(name, count) =>
          onFlash(`✅ ${count} Zutaten von "${name}" auf die Liste gesetzt`)
        }
      />
    );
  }

  if (!list) return <div className="page">Lädt…</div>;

  const memberIds = new Set(members.map((d) => d.id));
  const addable = allDishes.filter((d) => !memberIds.has(d.id));

  return (
    <div className="page editor">
      <div className="editor-head">
        <button className="back" onClick={onClose}>
          ‹ Zurück
        </button>
        <button className="link-danger" onClick={deleteList}>
          Löschen
        </button>
      </div>

      <h2 className="editor-title" onClick={renameList} style={{ cursor: "pointer" }}>
        📑 {list.name}
      </h2>

      {members.length === 0 && (
        <p className="empty-hint" style={{ textAlign: "left" }}>
          Noch keine Gerichte in dieser Liste.
        </p>
      )}

      <ul className="items">
        {members.map((d) => (
          <li key={d.id} className="item">
            <span className="item-name" onClick={() => setOpenDishId(d.id)}>
              {d.is_favorite ? "★ " : ""}
              {d.name}
            </span>
            <button
              className="ing-edit-btn"
              onClick={() => setOpenDishId(d.id)}
              aria-label="öffnen"
            >
              ›
            </button>
            <button className="item-del" onClick={() => removeDish(d.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button className="bulk-toggle" onClick={() => setPicker(true)} style={{ marginTop: 12 }}>
        + Gericht hinzufügen
      </button>

      <button className="big-btn" onClick={addAllToShopping} disabled={members.length === 0}>
        🛒 Alle Zutaten auf die Einkaufsliste
      </button>

      {picker && (
        <div className="sheet-backdrop" onClick={() => setPicker(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Gericht hinzufügen</h3>
            {addable.length === 0 && (
              <p className="empty-hint">Alle Gerichte sind schon in der Liste.</p>
            )}
            <div className="sheet-list">
              {addable.map((d) => (
                <button key={d.id} className="sheet-item" onClick={() => addDish(d.id)}>
                  {d.is_favorite ? "★ " : ""}
                  {d.name}
                </button>
              ))}
            </div>
            <button className="sheet-close" onClick={() => setPicker(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
