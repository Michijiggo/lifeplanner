import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { FinanceSettings } from "../lib/types";

const DEFAULT: FinanceSettings = {
  id: 1,
  income_p1: 0, income_p2: 0,
  shopping_budget: 0, savings_budget: 0,
  goal1_name: "", goal1_amount: 0,
  goal2_name: "", goal2_amount: 0,
  goal3_name: "", goal3_amount: 0,
  leftover_p1: 50, leftover_p2: 50,
  updated_at: "",
};

export function useFinanceSettings() {
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("finance_settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as FinanceSettings);
        setLoading(false);
      });
  }, []);

  async function save(patch: Partial<Omit<FinanceSettings, "id" | "updated_at">>) {
    const next = { ...settings, ...patch, updated_at: new Date().toISOString() };
    setSettings(next as FinanceSettings);
    await supabase
      .from("finance_settings")
      .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
  }

  return { settings, loading, save };
}
