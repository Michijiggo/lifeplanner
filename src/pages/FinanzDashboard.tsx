import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useFinanceSettings } from "../data/useFinanceSettings";
import type { FixedCost } from "../lib/types";

function fmt(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="db-row">
      <div className="db-row-left">
        <span className="db-row-label">{label}</span>
        {sub && <span className="db-row-sub">{sub}</span>}
      </div>
      <span className="db-row-value">{fmt(value)} €</span>
    </div>
  );
}

export default function FinanzDashboard() {
  const { settings: s, loading } = useFinanceSettings();
  const [costs, setCosts] = useState<FixedCost[]>([]);

  useEffect(() => {
    supabase.from("fixed_costs").select("*").then(({ data }) => {
      if (data) setCosts(data as FixedCost[]);
    });
  }, []);

  if (loading) return <p className="empty-hint">Laden…</p>;

  const totalIncome = s.income_p1 + s.income_p2;
  if (totalIncome === 0) {
    return (
      <div className="page">
        <p className="empty-hint">Bitte zuerst im Rechner die Einkommen eintragen.</p>
      </div>
    );
  }

  const p1ratio = s.income_p1 / totalIncome;
  const p2ratio = s.income_p2 / totalIncome;

  const fixedCostsP1 = costs.filter((c) => c.person === 1).reduce((s, c) => s + Number(c.amount), 0);
  const fixedCostsP2 = costs.filter((c) => c.person === 2).reduce((s, c) => s + Number(c.amount), 0);
  const totalFixedCosts = fixedCostsP1 + fixedCostsP2;

  const totalGoals =
    Number(s.goal1_amount) + Number(s.goal2_amount) + Number(s.goal3_amount);

  const totalShared =
    totalFixedCosts + Number(s.shopping_budget) + Number(s.savings_budget) + totalGoals;

  const leftover = totalIncome - totalShared;

  // Per-person shares (proportional to income ratio)
  const p1FixedShare = p1ratio * totalFixedCosts;
  const p2FixedShare = p2ratio * totalFixedCosts;
  const p1ShoppingShare = p1ratio * Number(s.shopping_budget);
  const p2ShoppingShare = p2ratio * Number(s.shopping_budget);
  const p1SavingsShare = p1ratio * Number(s.savings_budget);
  const p2SavingsShare = p2ratio * Number(s.savings_budget);

  const goals = [
    { name: s.goal1_name, amount: Number(s.goal1_amount) },
    { name: s.goal2_name, amount: Number(s.goal2_amount) },
    { name: s.goal3_name, amount: Number(s.goal3_amount) },
  ].filter((g) => g.amount > 0);

  // Das Restgeld auf dem Konto ist einfach der Anteil am Gesamtrestgeld
  const p1Leftover = leftover * (s.leftover_p1 / 100);
  const p2Leftover = leftover * (s.leftover_p2 / 100);

  return (
    <div className="page">

      {/* Gesamtübersicht */}
      <div className="db-section card">
        <div className="db-section-title">📊 Gesamtübersicht / Monat</div>
        <Row label="Gesamteinkommen" value={totalIncome} />
        <div className="db-divider" />
        <Row label="Fixkosten gesamt" value={totalFixedCosts} />
        <Row label="Einkaufsbudget" value={Number(s.shopping_budget)} />
        <Row label="Sparbudget" value={Number(s.savings_budget)} />
        {goals.map((g) => (
          <Row key={g.name} label={g.name || "Sparplan"} value={g.amount} />
        ))}
        <div className="db-divider" />
        <Row label="Alle Ausgaben & Sparen" value={totalShared} />
        <div className={`db-leftover-row ${leftover < 0 ? "negative" : ""}`}>
          <span>Restgeld</span>
          <span className="db-leftover-value">{fmt(leftover)} €</span>
        </div>
      </div>

      {/* Person 1 */}
      <PersonCard
        label="👤 Person 1"
        income={s.income_p1}
        incomePct={Math.round(p1ratio * 100)}
        fixedShare={p1FixedShare}
        shoppingShare={p1ShoppingShare}
        savingsShare={p1SavingsShare}
        goals={goals.map((g) => ({ name: g.name, amount: p1ratio * g.amount }))}
        leftover={p1Leftover}
        leftoverPct={s.leftover_p1}
      />

      {/* Person 2 */}
      <PersonCard
        label="👤 Person 2"
        income={s.income_p2}
        incomePct={Math.round(p2ratio * 100)}
        fixedShare={p2FixedShare}
        shoppingShare={p2ShoppingShare}
        savingsShare={p2SavingsShare}
        goals={goals.map((g) => ({ name: g.name, amount: p2ratio * g.amount }))}
        leftover={p2Leftover}
        leftoverPct={s.leftover_p2}
      />
    </div>
  );
}

function PersonCard({
  label, income, incomePct, fixedShare, shoppingShare, savingsShare,
  goals, leftover, leftoverPct,
}: {
  label: string; income: number; incomePct: number;
  fixedShare: number; shoppingShare: number; savingsShare: number;
  goals: { name: string; amount: number }[];
  leftover: number; leftoverPct: number;
}) {
  const totalCostShare = fixedShare + shoppingShare + savingsShare +
    goals.reduce((s, g) => s + g.amount, 0);

  return (
    <div className="db-section card">
      <div className="db-section-title">
        {label}
        <span className="db-income-badge">{fmt(income)} € · {incomePct}%</span>
      </div>
      <Row label="Einkommen" value={income} />
      <div className="db-divider" />
      <Row label="Fixkosten-Anteil" value={fixedShare} sub={`${incomePct}% von Gesamt`} />
      <Row label="Einkaufsbudget-Anteil" value={shoppingShare} />
      <Row label="Sparbudget-Anteil" value={savingsShare} />
      {goals.map((g) => (
        <Row key={g.name} label={g.name || "Sparplan"} value={g.amount} />
      ))}
      <div className="db-divider" />
      <div className="db-total-row">
        <span>Gesamte Abzüge</span>
        <span>{fmt(totalCostShare)} €</span>
      </div>
      {/* Restgeld auf dem Konto = Anteil am Gesamtrestgeld nach dem gewählten Verhältnis */}
      <div className={`db-net-row ${leftover < -0.01 ? "negative" : "positive"}`}>
        <span>💳 Restgeld auf Konto ({leftoverPct}%)</span>
        <span className="db-net-value">{fmt(leftover)} €</span>
      </div>
    </div>
  );
}
