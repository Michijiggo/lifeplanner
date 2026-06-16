import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LaundryKind, LaundryTimer } from "../lib/types";

const VAPID_PUBLIC_KEY =
  "BKcK9Jwuu8ufy9GxcGBJ3nfCtiUTDzehZitMvBKi2Vrzc5Y-hU5AHfXoh_HVsF0DRnSWWUfxIKkSRK3bH9mqL_8";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

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

  // Wenn die App wieder in den Vordergrund kommt, sofort jetzt-Zeit aktualisieren,
  // damit abgelaufene Timer direkt erkannt werden ohne auf den nächsten Tick warten.
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) setNow(Date.now());
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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

  async function subscribeToPush(reg: ServiceWorkerRegistration) {
    try {
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("push_subscriptions").upsert(
        { subscription: sub.toJSON(), user_id: user?.id },
        { onConflict: "user_id" }
      );
    } catch (e) {
      console.error("Push-Registrierung fehlgeschlagen:", e);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      alert("Dieser Browser unterstützt keine Benachrichtigungen.");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) await subscribeToPush(reg);
    }
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
        Tipp: Aktiviere Benachrichtigungen und füge die App zum Home-Bildschirm hinzu.
        Du bekommst dann auch dann eine Push-Nachricht, wenn die App komplett geschlossen ist.
      </p>
    </div>
  );
}
