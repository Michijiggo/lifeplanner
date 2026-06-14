import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Hilfreiche Fehlermeldung statt eines kryptischen Crashs
  throw new Error(
    "Supabase-Konfiguration fehlt. Lege eine .env-Datei an (siehe .env.example) bzw. setze die Environment Variables bei Vercel."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
