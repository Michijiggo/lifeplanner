import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCategories } from "../data/useCategories";
import { UNCATEGORIZED, type Category, type ShoppingItem } from "../lib/types";

export default function ShoppingList() {
  const categories = useCategories();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCat, setNewCat] = useState<number>(UNCATEGORIZED);

  // Erstes Laden
  useEffect(() => {
    supabase
      .from("shopping_items")
      .select("*")
      .order("created_at")
      .then(({ data }) => setItems((data as ShoppingItem[]) ?? []));
  }, []);

  // Live-Sync: jede Änderung an shopping_items sofort übernehmen
  useEffect(() => {
    const channel = supabase
      .channel("shopping_items-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as ShoppingItem;
              if (prev.some((i) => i.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as ShoppingItem;
              return prev.map((i) => (i.id === row.id ? row : i));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as ShoppingItem;
              return prev.filter((i) => i.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const catMap = useMemo(() => {
    const m = new Map<number, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  // Offene Artikel nach Kategorie gruppieren
  const grouped = useMemo(() => {
    const groups = new Map<number, ShoppingItem[]>();
    for (const it of open) {
      const cid = it.category_id ?? UNCATEGORIZED;
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)!.push(it);
    }
    return [...groups.entries()].sort((a, b) => {
      const sa = catMap.get(a[0])?.sort_order ?? 999;
      const sb = catMap.get(b[0])?.sort_order ?? 999;
      return sa - sb;
    });
  }, [open, catMap]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const qty = newQty.trim() ? Number(newQty.replace(",", ".")) : null;
    const optimistic: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      quantity: Number.isFinite(qty as number) ? (qty as number) : null,
      unit: newUnit.trim() || null,
      category_id: newCat,
      checked: false,
      checked_at: null,
      source_dish_id: null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setNewName("");
    setNewQty("");
    setNewUnit("");
    const { error } = await supabase.from("shopping_items").insert({
      id: optimistic.id,
      name: optimistic.name,
      quantity: optimistic.quantity,
      unit: optimistic.unit,
      category_id: optimistic.category_id,
    });
    if (error) {
      // Rollback bei Fehler
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
      alert("Konnte nicht gespeichert werden: " + error.message);
    }
  }

  async function toggle(item: ShoppingItem) {
    const checked = !item.checked;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, checked, checked_at: checked ? new Date().toISOString() : null }
          : i
      )
    );
    await supabase
      .from("shopping_items")
      .update({ checked, checked_at: checked ? new Date().toISOString() : null })
      .eq("id", item.id);
  }

  async function remove(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase.from("shopping_items").delete().eq("id", item.id);
  }

  async function clearChecked() {
    if (done.length === 0) return;
    if (!confirm(`${done.length} erledigte Artikel entfernen?`)) return;
    const ids = done.map((i) => i.id);
    setItems((prev) => prev.filter((i) => !i.checked));
    await supabase.from("shopping_items").delete().in("id", ids);
  }

  return (
    <div className="page">
      <form className="add-bar" onSubmit={addItem}>
        <input
          className="add-name"
          placeholder="Artikel hinzufügen…"
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

      {open.length === 0 && done.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">🧺</div>
          <p>Deine Einkaufsliste ist leer.</p>
          <p className="empty-hint">
            Füge oben Artikel hinzu oder schiebe Zutaten aus deinen Gerichten hierher.
          </p>
        </div>
      )}

      {grouped.map(([cid, list]) => {
        const cat = catMap.get(cid);
        return (
          <section key={cid} className="cat-group">
            <h3 className="cat-title">
              <span>{cat?.emoji ?? "🛒"}</span> {cat?.name ?? "Sonstiges"}
            </h3>
            <ul className="items">
              {list.map((it) => (
                <li key={it.id} className="item">
                  <button className="check" onClick={() => toggle(it)} aria-label="abhaken" />
                  <span className="item-name" onClick={() => toggle(it)}>
                    {it.name}
                    {(it.quantity || it.unit) && (
                      <span className="item-qty">
                        {" "}
                        {it.quantity ?? ""} {it.unit ?? ""}
                      </span>
                    )}
                  </span>
                  <button className="item-del" onClick={() => remove(it)} aria-label="löschen">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="cat-group done-group">
          <h3 className="cat-title done-title">
            <span>Erledigt ({done.length})</span>
            <button className="clear-btn" onClick={clearChecked}>
              Aufräumen
            </button>
          </h3>
          <ul className="items">
            {done.map((it) => (
              <li key={it.id} className="item item-done">
                <button className="check checked" onClick={() => toggle(it)} aria-label="rückgängig">
                  ✓
                </button>
                <span className="item-name" onClick={() => toggle(it)}>
                  {it.name}
                  {(it.quantity || it.unit) && (
                    <span className="item-qty">
                      {" "}
                      {it.quantity ?? ""} {it.unit ?? ""}
                    </span>
                  )}
                </span>
                <button className="item-del" onClick={() => remove(it)} aria-label="löschen">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
