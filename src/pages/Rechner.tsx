import { useFinanceSettings } from "../data/useFinanceSettings";

function NumInput({
  label, value, onChange, placeholder,
}: { label: string; value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <div className="rc-field">
      <label className="rc-label">{label}</label>
      <div className="rc-input-wrap">
        <input
          className="rc-input"
          inputMode="decimal"
          placeholder={placeholder ?? "0"}
          defaultValue={value || ""}
          key={value}
          onBlur={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v) && v >= 0) onChange(v);
          }}
        />
        <span className="rc-suffix">€</span>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="rc-input rc-text"
      placeholder={label}
      defaultValue={value}
      key={value}
      onBlur={(e) => onChange(e.target.value.trim())}
    />
  );
}

export default function Rechner() {
  const { settings: s, loading, save } = useFinanceSettings();

  if (loading) return <p className="empty-hint">Laden…</p>;

  const p1pct = s.income_p1 + s.income_p2 > 0
    ? Math.round((s.income_p1 / (s.income_p1 + s.income_p2)) * 100)
    : 50;
  const p2pct = 100 - p1pct;

  function setRatio(p1: number) {
    const clamped = Math.max(0, Math.min(100, p1));
    save({ leftover_p1: clamped, leftover_p2: 100 - clamped });
  }

  return (
    <div className="page">

      {/* Einkommen */}
      <div className="rc-section card">
        <div className="rc-section-title">💰 Einkommen</div>
        <div className="rc-row">
          <NumInput
            label="Person 1"
            value={s.income_p1}
            onChange={(v) => save({ income_p1: v })}
          />
          <NumInput
            label="Person 2"
            value={s.income_p2}
            onChange={(v) => save({ income_p2: v })}
          />
        </div>
        {(s.income_p1 > 0 || s.income_p2 > 0) && (
          <div className="rc-ratio-hint">
            Einkommensquote: <strong>P1 {p1pct}%</strong> / <strong>P2 {p2pct}%</strong>
          </div>
        )}
      </div>

      {/* Gemeinsame Budgets */}
      <div className="rc-section card">
        <div className="rc-section-title">🛒 Gemeinsame Budgets</div>
        <NumInput
          label="Einkaufsbudget / Monat"
          value={s.shopping_budget}
          onChange={(v) => save({ shopping_budget: v })}
        />
        <NumInput
          label="Sparbudget / Monat"
          value={s.savings_budget}
          onChange={(v) => save({ savings_budget: v })}
        />
      </div>

      {/* Zusätzliche Sparziele */}
      <div className="rc-section card">
        <div className="rc-section-title">🎯 Weitere Sparziele</div>
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="rc-goal-row">
            <TextInput
              label={`Ziel ${n} (z.B. Urlaub)`}
              value={(s as any)[`goal${n}_name`]}
              onChange={(v) => save({ [`goal${n}_name`]: v } as any)}
            />
            <div className="rc-input-wrap">
              <input
                className="rc-input rc-goal-amount"
                inputMode="decimal"
                placeholder="0"
                defaultValue={(s as any)[`goal${n}_amount`] || ""}
                key={(s as any)[`goal${n}_amount`]}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  save({ [`goal${n}_amount`]: isNaN(v) ? 0 : v } as any);
                }}
              />
              <span className="rc-suffix">€</span>
            </div>
          </div>
        ))}
      </div>

      {/* Restgeld-Aufteilung */}
      <div className="rc-section card">
        <div className="rc-section-title">✂️ Restgeld-Aufteilung</div>
        <p className="rc-hint">
          Wie wird das verbleibende Geld (nach allen Abzügen) aufgeteilt?
        </p>
        <div className="rc-ratio-row">
          <div className="rc-ratio-person">
            <span className="rc-ratio-label">Person 1</span>
            <div className="rc-input-wrap">
              <input
                className="rc-input rc-ratio-input"
                inputMode="numeric"
                defaultValue={s.leftover_p1}
                key={s.leftover_p1}
                onBlur={(e) => setRatio(parseInt(e.target.value) || 50)}
              />
              <span className="rc-suffix">%</span>
            </div>
          </div>
          <div className="rc-ratio-divider">/</div>
          <div className="rc-ratio-person">
            <span className="rc-ratio-label">Person 2</span>
            <div className="rc-input-wrap">
              <input
                className="rc-input rc-ratio-input"
                inputMode="numeric"
                defaultValue={s.leftover_p2}
                key={s.leftover_p2}
                onBlur={(e) => setRatio(100 - (parseInt(e.target.value) || 50))}
              />
              <span className="rc-suffix">%</span>
            </div>
          </div>
        </div>
        <div className="rc-ratio-bar">
          <div className="rc-ratio-fill" style={{ width: `${s.leftover_p1}%` }} />
        </div>
        <div className="rc-ratio-labels">
          <span>{s.leftover_p1}%</span>
          <span>{s.leftover_p2}%</span>
        </div>
      </div>
    </div>
  );
}
