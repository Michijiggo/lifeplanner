import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../lib/types";

let cache: Category[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data) {
          cache = data as Category[];
          setCategories(cache);
        }
      });
  }, []);

  return categories;
}
