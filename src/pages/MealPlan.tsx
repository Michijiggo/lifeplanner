import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { UNCATEGORIZED, type Dish, type DishIngredient, type MealPlanEntry } from "../lib/types";
import { useShopping } from "../shopping/ShoppingProvider";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Montag = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type EntryWithDish = MealPlanEntry & { dish: Dish | null };

export default function MealPlan() {
  const { addToShopping } = useShopping();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<EntryWithDish[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  async function reload() {
    const from = iso(weekStart);
    const to = iso(addDays(weekStart, 6));
    const { data } = await supabase
      .from("meal_plan_entries")
      .select("*, dish:dishes(*)")
      .gte("plan_date", from)
      .lte("plan_date", to);
    setEntries((data as EntryWithDish[]) ?? []);
  }

  useEffect(() => {
    reload();
  }, [weekStart]);

  useEffect(() => {
    supabase
      .from("dishes")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("name")
      .then(({ data }) => setDishes((data as Dish[]) ?? []));
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function addEntry(dishId: string) {
    if (!pickerDate) return;
    const { error } = await supabase
      .from("meal_plan_entries")
      .insert({ plan_date: pickerDate, dish_id: dishId });
    setPickerDate(null);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  async function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("meal_plan_entries").delete().eq("id", id);
  }

  async function weekToList() {
    const dishIds = [...new Set(entries.map((e) => e.dish_id))];
    if (dishIds.length === 0) {
      flash("Diese Woche ist noch nichts geplant.");
      return;
    }
    const { data } = await supabase
      .from("dish_ingredients")
      .select("*")
      .in("dish_id", dishIds);
    const list = (data as DishIngredient[]) ?? [];
    if (list.length === 0) {
      flash("Die geplanten Gerichte haben keine Zutaten.");
      return;
    }
    await addToShopping(
      list.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category_id: i.category_id ?? UNCATEGORIZED,
        source_dish_id: i.dish_id,
      }))
    );
  }

  const monthLabel = `${weekStart.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  })} – ${addDays(weekStart, 6).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  })}`;

  const todayIso = iso(new Date());

  return (
    <div className="page">
      <div className="week-nav">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <span>{monthLabel}</span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
      </div>

      {days.map((d, idx) => {
        const dIso = iso(d);
        const dayEntries = entries.filter((e) => e.plan_date === dIso);
        return (
          <div key={dIso} className={`day-row ${dIso === todayIso ? "today" : ""}`}>
            <div className="day-label">
              <strong>{DAYS[idx]}</strong>
              <span>{d.getDate()}.</span>
            </div>
            <div className="day-dishes">
              {dayEntries.map((e) => (
                <span key={e.id} className="chip">
                  {e.dish?.name ?? "—"}
                  <button onClick={() => removeEntry(e.id)}>✕</button>
                </span>
              ))}
              <button className="chip-add" onClick={() => setPickerDate(dIso)}>
                +
              </button>
            </div>
          </div>
        );
      })}

      <button className="big-btn" onClick={weekToList}>
        🛒 Zutaten der Woche auf die Einkaufsliste
      </button>

      {pickerDate && (
        <div className="sheet-backdrop" onClick={() => setPickerDate(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Gericht auswählen</h3>
            {dishes.length === 0 && <p className="empty-hint">Erst Gerichte anlegen.</p>}
            <div className="sheet-list">
              {dishes.map((d) => (
                <button key={d.id} className="sheet-item" onClick={() => addEntry(d.id)}>
                  {d.is_favorite ? "★ " : ""}
                  {d.name}
                </button>
              ))}
            </div>
            <button className="sheet-close" onClick={() => setPickerDate(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
