import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function Login() {
  const { register, login, lastEmail } = useAuth();
  // Wenn schon einmal registriert wurde, direkt in den PIN-Login starten.
  const [mode, setMode] = useState<"login" | "register">(
    lastEmail ? "login" : "register"
  );
  const [email, setEmail] = useState(lastEmail ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pressDigit(d: string) {
    setError(null);
    setPin((p) => (p.length >= 4 ? p : p + d));
  }
  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  async function submit() {
    if (pin.length !== 4) {
      setError("Bitte 4 Ziffern eingeben.");
      return;
    }
    if (mode === "register" && !email.includes("@")) {
      setError("Bitte eine gültige E-Mail eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(email, pin);
      } else {
        await login(email, pin);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already registered/i.test(msg)) {
        setError("Diese E-Mail ist bereits registriert – bitte anmelden.");
        setMode("login");
      } else if (/Email not confirmed/i.test(msg)) {
        setError(
          "E-Mail noch nicht bestätigt. Bitte in Supabase die E-Mail-Bestätigung deaktivieren (siehe README)."
        );
      } else if (/Invalid login credentials/i.test(msg)) {
        setError("Falscher PIN oder falsche E-Mail.");
      } else {
        setError(msg);
      }
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">🛒</div>
        <h1>Einkaufsplaner</h1>
        <p className="login-sub">
          {mode === "register"
            ? "Einmalig registrieren – danach genügt der 4-stellige PIN."
            : "Mit deinem PIN anmelden."}
        </p>

        {mode === "register" && (
          <input
            className="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {mode === "login" && email && (
          <div className="login-asemail">
            angemeldet als <strong>{email}</strong>
          </div>
        )}

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} className="pin-key" onClick={() => pressDigit(d)} disabled={busy}>
              {d}
            </button>
          ))}
          <button className="pin-key pin-key-muted" onClick={backspace} disabled={busy}>
            ⌫
          </button>
          <button className="pin-key" onClick={() => pressDigit("0")} disabled={busy}>
            0
          </button>
          <button
            className="pin-key pin-key-ok"
            onClick={submit}
            disabled={busy || pin.length !== 4}
          >
            {busy ? "…" : "✓"}
          </button>
        </div>

        <button
          className="login-switch"
          onClick={() => {
            setMode((m) => (m === "register" ? "login" : "register"));
            setPin("");
            setError(null);
          }}
        >
          {mode === "register"
            ? "Schon registriert? Anmelden"
            : "Neuen Account anlegen"}
        </button>
      </div>
    </div>
  );
}
