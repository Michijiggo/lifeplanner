import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { isStaple } from "../data/categorize";
import { UNCATEGORIZED } from "../lib/types";

export type NewShoppingItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  category_id: number | null;
  source_dish_id?: string | null;
};

type Pending = {
  others: NewShoppingItem[];
  staples: NewShoppingItem[];
  have: boolean[]; // true = "habe ich noch" (nicht kaufen)
};

type Ctx = {
  addToShopping: (rows: NewShoppingItem[]) => Promise<void>;
};

const ShoppingContext = createContext<Ctx | null>(null);

type Toast = { msg: string; undoIds?: string[] };

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();

  function flash(msg: string, undoIds?: string[]) {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, undoIds });
    // Mit Rückgängig-Button etwas länger stehen lassen.
    timer.current = window.setTimeout(() => setToast(null), undoIds ? 7000 : 2600);
  }

  async function insert(rows: NewShoppingItem[]) {
    if (rows.length === 0) {
      flash("Nichts hinzugefügt – alles schon vorrätig.");
      return;
    }
    const payload = rows.map((r) => ({
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      category_id: r.category_id ?? UNCATEGORIZED,
      source_dish_id: r.source_dish_id ?? null,
    }));
    const { data, error } = await supabase.from("shopping_items").insert(payload).select("id");
    if (error) {
      alert(error.message);
      return;
    }
    const ids = ((data as { id: string }[]) ?? []).map((r) => r.id);
    flash(`✅ ${rows.length} Zutaten hinzugefügt`, ids);
  }

  async function undo(ids: string[]) {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
    await supabase.from("shopping_items").delete().in("id", ids);
    flash("Rückgängig gemacht");
  }

  async function addToShopping(rows: NewShoppingItem[]) {
    if (rows.length === 0) return;
    const staples: NewShoppingItem[] = [];
    const others: NewShoppingItem[] = [];
    for (const r of rows) (isStaple(r.name) ? staples : others).push(r);

    if (staples.length === 0) {
      await insert(others);
      return;
    }
    // Grundzutaten standardmäßig als "habe ich noch" markieren.
    setPending({ others, staples, have: staples.map(() => true) });
  }

  async function confirm() {
    if (!pending) return;
    const toBuy = pending.staples.filter((_, i) => !pending.have[i]);
    const all = [...pending.others, ...toBuy];
    setPending(null);
    await insert(all);
  }

  return (
    <ShoppingContext.Provider value={{ addToShopping }}>
      {children}

      {pending && (
        <div className="sheet-backdrop" onClick={() => setPending(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Vorräte prüfen</h3>
            <p className="empty-hint" style={{ textAlign: "left", marginTop: 0 }}>
              Diese Grundzutaten hast du vielleicht noch. Tippe an, was du
              <strong> kaufen </strong>musst.
            </p>
            <div className="sheet-list">
              {pending.staples.map((s, i) => {
                const buy = !pending.have[i];
                return (
                  <button
                    key={i}
                    className={`staple-row ${buy ? "buy" : ""}`}
                    onClick={() =>
                      setPending((p) =>
                        p
                          ? { ...p, have: p.have.map((h, j) => (j === i ? !h : h)) }
                          : p
                      )
                    }
                  >
                    <span>
                      {s.name}
                      {(s.quantity || s.unit) && (
                        <span className="item-qty">
                          {" "}
                          {s.quantity ?? ""} {s.unit ?? ""}
                        </span>
                      )}
                    </span>
                    <span className="staple-state">
                      {buy ? "🛒 kaufen" : "✓ habe ich"}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="staple-allbuy"
              onClick={() =>
                setPending((p) => (p ? { ...p, have: p.have.map(() => false) } : p))
              }
            >
              Alle kaufen
            </button>

            <div className="bulk-actions">
              <button className="sheet-close" onClick={() => setPending(null)}>
                Abbrechen
              </button>
              <button className="add-btn-wide" onClick={confirm}>
                Auf die Liste
                {pending.others.length > 0 && ` (+${pending.others.length} weitere)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>{toast.msg}</span>
          {toast.undoIds && toast.undoIds.length > 0 && (
            <button className="toast-undo" onClick={() => undo(toast.undoIds!)}>
              Rückgängig
            </button>
          )}
        </div>
      )}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping muss innerhalb von ShoppingProvider stehen");
  return ctx;
}
