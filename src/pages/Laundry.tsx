import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LaundryKind, LaundryTimer } from "../lib/types";

const MACHINES: {
  kind: LaundryKind;
  label: string;
  emoji: string;
  presets: number[];
}[] = [
  { kind: "washer", label: "Waschmaschine", emoji: "🧺", presets: [30, 45, 60, 90] },
  { kind: "dryer", label: "Trockner", emoji: "🌀", presets: [40, 60, 90, 120] },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtRemaining(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      const opts: NotificationOptions = {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "laundry",
      };
      // renotify/vibrate sind nicht überall typisiert
      (opts as Record<string, unknown>).renotify = true;
      (opts as Record<string, unknown>).vibrate = [200, 100, 200];
      reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* Fallback unten */
  }
  try {
    new Notification(title, { body });
  } catch {
    /* ignorieren */
  }
}

export default function Laundry() {
  const [timers, setTimers] = useState<Record<string, string | null>>({});
  const [now, setNow] = useState(Date.now());
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [mins, setMins] = useState<Record<string, string>>({});
  const notified = useRef<Set<string>>(new Set());

  async function reload() {
    const { data } = await supabase.from("laundry_timers").select("*");
    const map: Record<string, string | null> = {};
    for (const t of (data as LaundryTimer[]) ?? []) map[t.kind] = t.finish_at;
    setTimers(map);
  }

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("laundry-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "laundry_timers" },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bei Ablauf benachrichtigen
  useEffect(() => {
    for (const m of MACHINES) {
      const fin = timers[m.kind];
      if (!fin) continue;
      const end = new Date(fin).getTime();
      const key = m.kind + fin;
      if (end <= now && !notified.current.has(key)) {
        notified.current.add(key);
        notify(`${m.emoji} ${m.label} fertig!`, "Die Wäsche ist durch. 🎉");
      }
    }
  }, [now, timers]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      alert("Dieser Browser unterstützt keine Benachrichtigungen.");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  async function start(kind: LaundryKind, minutes: number) {
    if (!minutes || minutes <= 0) return;
    const finish = new Date(Date.now() + minutes * 60000).toISOString();
    setTimers((prev) => ({ ...prev, [kind]: finish }));
    setMins((prev) => ({ ...prev, [kind]: "" }));
    if (perm === "default") enableNotifications();
    await supabase
      .from("laundry_timers")
      .upsert({ kind, finish_at: finish, updated_at: new Date().toISOString() });
  }

  async function cancel(kind: LaundryKind) {
    setTimers((prev) => ({ ...prev, [kind]: null }));
    await supabase
      .from("laundry_timers")
      .upsert({ kind, finish_at: null, updated_at: new Date().toISOString() });
  }

  return (
    <div className="page">
      {perm !== "granted" && (
        <button className="notif-banner" onClick={enableNotifications}>
          🔔 Benachrichtigungen aktivieren
        </button>
      )}
      {perm === "denied" && (
        <p className="empty-hint" style={{ textAlign: "left", marginTop: -6 }}>
          Benachrichtigungen sind blockiert. In den Browser-/Handy-Einstellungen für
          diese Seite wieder erlauben.
        </p>
      )}

      {MACHINES.map((m) => {
        const fin = timers[m.kind];
        const end = fin ? new Date(fin).getTime() : 0;
        const remaining = end - now;
        const running = !!fin && remaining > 0;
        const done = !!fin && remaining <= 0;

        return (
          <div key={m.kind} className={`machine ${done ? "done" : ""}`}>
            <div className="machine-head">
              <span className="machine-emoji">{m.emoji}</span>
              <span className="machine-label">{m.label}</span>
            </div>

            {running && (
              <>
                <div className="machine-count">{fmtRemaining(remaining)}</div>
                <div className="machine-sub">fertig um {fmtClock(new Date(end))} Uhr</div>
                <button className="machine-cancel" onClick={() => cancel(m.kind)}>
                  Abbrechen
                </button>
              </>
            )}

            {done && (
              <>
                <div className="machine-count done-text">✅ Fertig!</div>
                <button className="machine-ok" onClick={() => cancel(m.kind)}>
                  Erledigt
                </button>
              </>
            )}

            {!running && !done && (
              <>
                <div className="preset-row">
                  {m.presets.map((p) => (
                    <button key={p} className="preset" onClick={() => start(m.kind, p)}>
                      {p}&thinsp;min
                    </button>
                  ))}
                </div>
                <div className="custom-row">
                  <input
                    className="custom-min"
                    inputMode="numeric"
                    placeholder="Minuten"
                    value={mins[m.kind] ?? ""}
                    onChange={(e) =>
                      setMins((prev) => ({ ...prev, [m.kind]: e.target.value }))
                    }
                  />
                  <button
                    className="add-btn-wide"
                    onClick={() => start(m.kind, Number(mins[m.kind]))}
                  >
                    Starten
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <p className="empty-hint" style={{ textAlign: "left" }}>
        Tipp: Damit die Benachrichtigung auch bei gesperrtem Handy ankommt, füge die
        App zum Home-Bildschirm hinzu und lass sie im Hintergrund. (Zuverlässiger
        Push bei komplett geschlossener App folgt als nächster Ausbau.)
      </p>
    </div>
  );
}
