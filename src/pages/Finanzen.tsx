import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import type { FixedCost } from "../lib/types";

const PERSONS = [1, 2] as const;
const PERSON_LABELS: Record<1 | 2, string> = { 1: "Person 1", 2: "Person 2" };

const emptyForm = {
  name: "",
  amount: "",
  debit_day: "",
  account: "",
};

export default function Finanzen() {
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [activePerson, setActivePerson] = useState<1 | 2>(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    supabase
      .from("fixed_costs")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        if (data) setCosts(data as FixedCost[]);
        setLoading(false);
      });
  }, []);

  function forPerson(p: 1 | 2) {
    return costs.filter((c) => c.person === p);
  }

  function total(p: 1 | 2) {
    return forPerson(p).reduce((s, c) => s + Number(c.amount), 0);
  }

  function totalAll() {
    return costs.reduce((s, c) => s + Number(c.amount), 0);
  }

  function fmt(n: number) {
    return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function save() {
    const name = form.name.trim();
    const amount = parseFloat(form.amount.replace(",", "."));
    if (!name || isNaN(amount) || amount <= 0) return;

    const debit_day = form.debit_day ? parseInt(form.debit_day) : null;
    const account = form.account.trim() || null;

    if (editingId) {
      const { data } = await supabase
        .from("fixed_costs")
        .update({ name, amount, debit_day, account })
        .eq("id", editingId)
        .select()
        .single();
      if (data) {
        setCosts((prev) => prev.map((c) => (c.id === editingId ? (data as FixedCost) : c)));
      }
      setEditingId(null);
    } else {
      const { data } = await supabase
        .from("fixed_costs")
        .insert({ person: activePerson, name, amount, debit_day, account })
        .select()
        .single();
      if (data) setCosts((prev) => [...prev, data as FixedCost]);
    }
    setForm(emptyForm);
    setShowSheet(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowSheet(true);
  }

  function startEdit(c: FixedCost) {
    setEditingId(c.id);
    setActivePerson(c.person);
    setForm({
      name: c.name,
      amount: String(c.amount),
      debit_day: c.debit_day != null ? String(c.debit_day) : "",
      account: c.account ?? "",
    });
    setShowSheet(true);
  }

  function closeSheet() {
    setEditingId(null);
    setForm(emptyForm);
    setShowSheet(false);
  }

  async function remove(id: string) {
    await supabase.from("fixed_costs").delete().eq("id", id);
    setCosts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="page">
      {loading && <p className="empty-hint">Laden…</p>}

      {/* Pro Person */}
      {PERSONS.map((p) => (
        <div key={p} className="fc-section">
          <div className="fc-section-head">
            <span className="fc-section-title">👤 {PERSON_LABELS[p]}</span>
            <span className="fc-section-total">{fmt(total(p))} €</span>
          </div>

          {forPerson(p).length === 0 ? (
            <p className="empty-hint">Noch keine Fixkosten</p>
          ) : (
            <div className="fc-list">
              {forPerson(p).map((c) => (
                <div key={c.id} className="fc-item card">
                  <div className="fc-item-main">
                    <span className="fc-item-name">{c.name}</span>
                    <div className="fc-item-meta">
                      {c.debit_day != null && (
                        <span className="fc-badge">📅 {c.debit_day}.</span>
                      )}
                      {c.account && (
                        <span className="fc-badge">🏦 {c.account}</span>
                      )}
                    </div>
                  </div>
                  <div className="fc-item-right">
                    <span className="fc-item-amount">{fmt(Number(c.amount))} €</span>
                    <div className="fc-item-btns">
                      <button
                        className="icon-btn edit-btn"
                        onClick={() => startEdit(c)}
                        aria-label="Bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        className="icon-btn del-btn"
                        onClick={() => remove(c.id)}
                        aria-label="Löschen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Gesamtsumme */}
      {costs.length > 0 && (
        <div className="fc-total-bar">
          <span>Gesamt</span>
          <span className="fc-total-amount">{fmt(totalAll())} €</span>
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={openNew} aria-label="Neue Fixkosten">
        +
      </button>

      {/* Eingabe-Sheet */}
      {showSheet &&
        createPortal(
          <div className="sheet-backdrop" onClick={closeSheet}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <h3>{editingId ? "Eintrag bearbeiten" : "Neue Fixkosten"}</h3>

              {/* Personen-Auswahl (nur bei neuem Eintrag) */}
              {!editingId && (
                <div className="fc-person-tabs" style={{ marginBottom: 10 }}>
                  {PERSONS.map((p) => (
                    <button
                      key={p}
                      className={`fc-person-tab ${activePerson === p ? "active" : ""}`}
                      onClick={() => setActivePerson(p)}
                    >
                      {PERSON_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}

              <div className="sheet-form">
                <input
                  autoFocus
                  className="fc-input"
                  placeholder="Bezeichnung (z.B. Miete)"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
                <div className="fc-row">
                  <input
                    className="fc-input fc-amount"
                    placeholder="Betrag €"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                  />
                  <input
                    className="fc-input fc-day"
                    placeholder="Tag"
                    inputMode="numeric"
                    maxLength={2}
                    value={form.debit_day}
                    onChange={(e) => setForm((f) => ({ ...f, debit_day: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                  />
                  <input
                    className="fc-input fc-account"
                    placeholder="Konto"
                    value={form.account}
                    onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                  />
                </div>
                <div className="fc-actions">
                  <button className="fc-cancel-btn" onClick={closeSheet}>
                    Abbrechen
                  </button>
                  <button className="fc-save-btn" onClick={save}>
                    {editingId ? "Speichern" : "Hinzufügen"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
