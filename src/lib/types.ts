export type Category = {
  id: number;
  name: string;
  emoji: string;
  sort_order: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category_id: number | null;
  checked: boolean;
  checked_at: string | null;
  source_dish_id: string | null;
  created_at: string;
};

export type Dish = {
  id: string;
  name: string;
  notes: string | null;
  servings: number;
  is_favorite: boolean;
  kcal_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  created_at: string;
  updated_at: string;
};

export type DishIngredient = {
  id: string;
  dish_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category_id: number | null;
  sort_order: number;
};

export type MealPlanEntry = {
  id: string;
  plan_date: string; // YYYY-MM-DD
  dish_id: string;
  created_at: string;
};

export type DishList = {
  id: string;
  name: string;
  created_at: string;
};

export type DishListItem = {
  id: string;
  list_id: string;
  dish_id: string;
  created_at: string;
};

export const UNCATEGORIZED = 12; // "Sonstiges"

export type FinanceSettings = {
  id: 1;
  income_p1: number;
  income_p2: number;
  shopping_budget: number;
  savings_budget: number;
  goal1_name: string;
  goal1_amount: number;
  goal2_name: string;
  goal2_amount: number;
  goal3_name: string;
  goal3_amount: number;
  leftover_p1: number;
  leftover_p2: number;
  updated_at: string;
};

export type FixedCost = {
  id: string;
  person: 1 | 2;
  name: string;
  amount: number;
  debit_day: number | null;
  account: string | null;
  created_at: string;
};

export type LaundryKind = "washer" | "dryer";
export type LaundryTimer = {
  kind: LaundryKind;
  finish_at: string | null;
  updated_at: string;
};
