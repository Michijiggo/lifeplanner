# 🛒 Einkaufsplaner

Gemeinsamer Wocheneinkauf für zwei Personen: Gerichte speichern, mit einem Klick alle
Zutaten auf die Einkaufsliste setzen und die Liste **live** zwischen zwei Geräten teilen –
hakt einer etwas ab, verschwindet es sofort beim anderen.

Gebaut als **PWA** (Progressive Web App): im Browser nutzbar und über „Zum Home-Bildschirm
hinzufügen" auf iPhone/Android wie eine echte App installierbar.

## Tech-Stack

- **React + TypeScript + Vite** (Frontend)
- **Supabase** (Postgres, Auth, Realtime)
- **Vercel** (Hosting)
- **vite-plugin-pwa** (installierbar + Offline-Cache)

## Funktionen

- 🧺 **Einkaufsliste** – Artikel mit Menge/Einheit, nach Kategorien gruppiert, abhaken,
  „Erledigt"-Bereich aufräumen. **Live-Sync über Supabase Realtime.**
- 🍲 **Gerichte** – Lieblingsgerichte mit Zutaten anlegen, als Favorit markieren,
  per Knopfdruck **alle Zutaten auf die Einkaufsliste** setzen.
- 📅 **Wochenplan** – Gerichte den Wochentagen zuordnen und die **Zutaten der ganzen Woche**
  in einem Rutsch auf die Liste setzen.
- 🔐 **Login** – Einmal mit E-Mail registrieren, danach Anmeldung nur per **4-stelligem PIN**.
  Beide Partner nutzen denselben Account → alle Daten werden automatisch geteilt.

## Lokal starten

```bash
npm install
cp .env.example .env   # Werte sind bereits eingetragen (öffentlich, durch RLS geschützt)
npm run dev
```

App läuft dann auf http://localhost:5173

## Supabase – einmalige Einstellung (wichtig!)

Damit die Anmeldung **ohne** Bestätigungs-Mail funktioniert (nur E-Mail + 4-stelliger PIN):

1. Supabase-Dashboard → Projekt **einkaufsplaner** öffnen
2. **Authentication → Sign In / Providers → Email**
3. **„Confirm email" deaktivieren** und speichern

Danach: In der App auf „Neuen Account anlegen", E-Mail + 4-stelligen PIN eingeben – fertig.
Auf dem zweiten Gerät (Partnerin) dieselbe E-Mail + denselben PIN eingeben.

> Lässt man „Confirm email" an, muss der Registrierungs-Link in der Mail einmal angeklickt
> werden, bevor die PIN-Anmeldung klappt.

Das Datenbank-Schema (Tabellen `categories`, `dishes`, `dish_ingredients`,
`meal_plan_entries`, `shopping_items`) inkl. RLS und aktiviertem Realtime ist im Projekt
bereits angelegt.

## Deployment auf Vercel

1. Repo bei Vercel importieren (Framework wird automatisch als **Vite** erkannt)
2. Unter **Settings → Environment Variables** eintragen:
   - `VITE_SUPABASE_URL` = `https://axtvypuggxukordldtzp.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_OvWQD5bBN86RtngE7oaLaQ_0s9PMLA2`
3. Deployen. Build-Command `npm run build`, Output `dist` (Standard für Vite).

## Als App aufs Handy

- **iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm".
- **Android:** Chrome zeigt „App installieren" an bzw. Menü → „Zum Startbildschirm hinzufügen".

## Geplant / nächste Schritte

- 📸 **Cookidoo-Import per Screenshot** – Zutaten aus einem Screenshot automatisch auslesen
  (via Supabase Edge Function + Bilderkennung).
- 🔔 **Push-Benachrichtigungen** – z. B. „Partnerin hat Artikel hinzugefügt" (Web Push;
  auf iPhone nur als installierte PWA verfügbar).
