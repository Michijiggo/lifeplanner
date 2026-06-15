import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../lib/types";

let cache: Category[] | null = null;
const listeners = new Set<(c: Category[]) => void>();

async function load() {
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  if (data) {
    cache = data as Category[];
    listeners.forEach((l) => l(cache!));
  }
  return cache ?? [];
}

// Nach dem Ändern der Reihenfolge aufrufen – aktualisiert alle Verbraucher.
export function reloadCategories() {
  return load();
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    const l = (c: Category[]) => setCategories(c);
    listeners.add(l);
    if (cache) setCategories(cache);
    else load();
    return () => {
      listeners.delete(l);
    };
  }, []);

  return categories;
}
