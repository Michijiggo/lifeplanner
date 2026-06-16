import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { useCategories, reloadCategories } from "../data/useCategories";
import { UNCATEGORIZED, type Category, type ShoppingItem } from "../lib/types";
import { parseIngredientLine } from "../data/categorize";

export default function ShoppingList() {
  const categories = useCategories();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCat, setNewCat] = useState<number>(UNCATEGORIZED);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSort, setShowSort] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  function openAddSheet() {
    setNewName("");
    setNewQty("");
    setNewUnit("");
    setNewCat(UNCATEGORIZED);
    setBulkText("");
    setShowAddSheet(true);
  }

  function closeAddSheet() {
    setShowAddSheet(false);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const typedQty = newQty.trim() ? Number(newQty.replace(",", ".")) : null;

    // Name automatisch zerlegen ("500 g Mehl") und Kategorie erkennen.
    const parsed = parseIngredientLine(name);
    const quantity =
      typedQty != null && Number.isFinite(typedQty) ? typedQty : parsed?.quantity ?? null;
    const unit = newUnit.trim() || parsed?.unit || null;
    // Kategorie nur automatisch, wenn der Nutzer keine eigene gewählt hat.
    const category_id =
      newCat !== UNCATEGORIZED ? newCat : parsed?.category_id ?? UNCATEGORIZED;

    const optimistic: ShoppingItem = {
      id: crypto.randomUUID(),
      name: parsed?.name || name,
      quantity,
      unit,
      category_id,
      checked: false,
      checked_at: null,
      source_dish_id: null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setNewName("");
    setNewQty("");
    setNewUnit("");
    setNewCat(UNCATEGORIZED);
    setShowAddSheet(false);
    const { error } = await supabase.from("shopping_items").insert({
      id: optimistic.id,
      name: optimistic.name,
      quantity: optimistic.quantity,
      unit: optimistic.unit,
      category_id: optimistic.category_id,
    });
    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
      alert("Konnte nicht gespeichert werden: " + error.message);
    }
  }

  async function addBulkItems() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const optimisticItems: ShoppingItem[] = lines.map((line) => {
      const parsed = parseIngredientLine(line);
      return {
        id: crypto.randomUUID(),
        name: parsed?.name || line,
        quantity: parsed?.quantity ?? null,
        unit: parsed?.unit || null,
        category_id: parsed?.category_id ?? UNCATEGORIZED,
        checked: false,
        checked_at: null,
        source_dish_id: null,
        created_at: new Date().toISOString(),
      };
    });

    setItems((prev) => [...prev, ...optimisticItems]);
    setBulkText("");
    setShowAddSheet(false);

    const { error } = await supabase.from("shopping_items").insert(
      optimisticItems.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category_id: i.category_id,
      }))
    );
    if (error) {
      setItems((prev) =>
        prev.filter((i) => !optimisticItems.some((o) => o.id === i.id))
      );
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

  // Bearbeiten: lokal sofort, in DB beim Verlassen des Feldes speichern.
  function patchLocal(id: string, patch: Partial<ShoppingItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function persist(id: string, patch: Partial<ShoppingItem>) {
    await supabase.from("shopping_items").update(patch).eq("id", id);
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
      <button className="sort-cats-btn" onClick={() => setShowSort(true)}>
        ↕ Kategorien sortieren
      </button>

      {showSort && (
        <CategorySortSheet categories={categories} onClose={() => setShowSort(false)} />
      )}

      {open.length === 0 && done.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">🧺</div>
          <p>Deine Einkaufsliste ist leer.</p>
          <p className="empty-hint">
            Tippe auf + um Artikel hinzuzufügen.
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
              {list.map((it) =>
                editingId === it.id ? (
                  <li key={it.id} className="item">
                    <select
                      className="ing-cat-select"
                      value={it.category_id ?? UNCATEGORIZED}
                      onChange={(e) => {
                        const c = Number(e.target.value);
                        patchLocal(it.id, { category_id: c });
                        persist(it.id, { category_id: c });
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji}
                        </option>
                      ))}
                    </select>
                    <div className="ing-edit">
                      <input
                        className="ing-edit-name"
                        autoFocus
                        value={it.name}
                        onChange={(e) => patchLocal(it.id, { name: e.target.value })}
                        onBlur={(e) => persist(it.id, { name: e.target.value.trim() || "Artikel" })}
                      />
                      <div className="ing-edit-row">
                        <input
                          className="ing-edit-qty"
                          inputMode="decimal"
                          placeholder="Menge"
                          value={it.quantity ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            patchLocal(it.id, {
                              quantity: v === "" ? null : Number(v.replace(",", ".")),
                            });
                          }}
                          onBlur={() => persist(it.id, { quantity: it.quantity })}
                        />
                        <input
                          className="ing-edit-unit"
                          placeholder="Einheit"
                          value={it.unit ?? ""}
                          onChange={(e) => patchLocal(it.id, { unit: e.target.value || null })}
                          onBlur={(e) => persist(it.id, { unit: e.target.value.trim() || null })}
                        />
                        <button className="ing-done" onClick={() => setEditingId(null)}>
                          ✓
                        </button>
                      </div>
                    </div>
                  </li>
                ) : (
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
                    <button
                      className="ing-edit-btn"
                      onClick={() => setEditingId(it.id)}
                      aria-label="bearbeiten"
                    >
                      ✎
                    </button>
                    <button className="item-del" onClick={() => remove(it)} aria-label="löschen">
                      ✕
                    </button>
                  </li>
                )
              )}
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

      {/* FAB */}
      <button className="fab" onClick={openAddSheet} aria-label="Artikel hinzufügen">
        +
      </button>

      {/* Hinzufügen-Sheet */}
      {showAddSheet &&
        createPortal(
          <div className="sheet-backdrop" onClick={closeAddSheet}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <h3>Artikel hinzufügen</h3>

              {/* Modus-Toggle */}
              <div className="fc-person-tabs" style={{ marginBottom: 14 }}>
                <button
                  className={`fc-person-tab ${!bulkMode ? "active" : ""}`}
                  onClick={() => setBulkMode(false)}
                >
                  Einzeln
                </button>
                <button
                  className={`fc-person-tab ${bulkMode ? "active" : ""}`}
                  onClick={() => setBulkMode(true)}
                >
                  Mehrere
                </button>
              </div>

              {bulkMode ? (
                <div className="sheet-form">
                  <p className="empty-hint" style={{ margin: "0 0 8px", textAlign: "left" }}>
                    Einen Artikel pro Zeile, z.B. „500 g Mehl"
                  </p>
                  <textarea
                    autoFocus
                    className="bulk-text"
                    placeholder={"Milch\n2 kg Äpfel\n500 g Mehl"}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={6}
                  />
                  <div className="fc-actions">
                    <button className="fc-cancel-btn" onClick={closeAddSheet}>
                      Abbrechen
                    </button>
                    <button
                      className="fc-save-btn"
                      onClick={addBulkItems}
                      disabled={!bulkText.trim()}
                    >
                      Alle hinzufügen
                    </button>
                  </div>
                </div>
              ) : (
                <form className="sheet-form" onSubmit={addItem}>
                  <input
                    ref={nameInputRef}
                    autoFocus
                    className="fc-input"
                    placeholder="Artikel, z.B. 500 g Mehl"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <div className="fc-row">
                    <input
                      className="fc-input fc-amount"
                      placeholder="Menge"
                      inputMode="decimal"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                    />
                    <input
                      className="fc-input fc-account"
                      placeholder="Einheit"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                    />
                  </div>
                  <select
                    className="fc-input"
                    value={newCat}
                    onChange={(e) => setNewCat(Number(e.target.value))}
                    style={{ color: newCat === UNCATEGORIZED ? "var(--muted)" : "inherit" }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="fc-actions">
                    <button type="button" className="fc-cancel-btn" onClick={closeAddSheet}>
                      Abbrechen
                    </button>
                    <button type="submit" className="fc-save-btn">
                      Hinzufügen
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function CategorySortSheet({
  categories,
  onClose,
}: {
  categories: Category[];
  onClose: () => void;
}) {
  const [order, setOrder] = useState<Category[]>(categories);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Der eigentliche Scroll-Container der App ist `.content`, nicht der Body.
    // Deshalb wird das Sheet per Portal an den Body gehängt (siehe unten) und
    // jeder Touch ausserhalb der scrollbaren Liste global geblockt. Damit kann
    // auf dem iPhone (auch als Home-Screen-PWA) garantiert nichts im Hintergrund
    // scrollen, während die Liste im Sheet selbst frei scrollt.
    const guard = (e: TouchEvent) => {
      const list = listRef.current;
      if (list && list.contains(e.target as Node)) {
        // Innerhalb der Liste: natives Scrollen erlauben, aber Scroll-Chaining
        // an den Raendern verhindern (sonst scrollt iOS den Hintergrund weiter).
        const atTop = list.scrollTop <= 0;
        const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        const noScroll = list.scrollHeight <= list.clientHeight;
        if (noScroll) {
          e.preventDefault();
          return;
        }
        if (e.cancelable) {
          const touchY = e.touches[0]?.clientY ?? 0;
          const lastY = (list as any)._lastTouchY ?? touchY;
          (list as any)._lastTouchY = touchY;
          const goingDown = touchY > lastY;
          if ((atTop && goingDown) || (atBottom && !goingDown)) e.preventDefault();
        }
        return;
      }
      e.preventDefault();
    };
    document.addEventListener("touchmove", guard, { passive: false });
    return () => document.removeEventListener("touchmove", guard);
  }, []);

  async function persist(arr: Category[]) {
    await Promise.all(
      arr.map((c, idx) =>
        supabase.from("categories").update({ sort_order: (idx + 1) * 10 }).eq("id", c.id)
      )
    );
    reloadCategories();
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    persist(next);
  }

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Kategorien sortieren</h3>
        <p className="empty-hint" style={{ textAlign: "left", marginTop: 0 }}>
          Bring die Reihenfolge in deinen Laden-Rundgang. Gilt für die ganze App.
        </p>
        <div ref={listRef} className="sheet-list">
          {order.map((c, i) => (
            <div key={c.id} className="sort-row">
              <span className="sort-name">
                {c.emoji} {c.name}
              </span>
              <div className="sort-arrows">
                <button
                  className="sort-arrow"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="nach oben"
                >
                  ▲
                </button>
                <button
                  className="sort-arrow"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="nach unten"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="sheet-close" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>,
    document.body
  );
}
