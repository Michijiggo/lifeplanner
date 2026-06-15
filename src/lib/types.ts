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

export type LaundryKind = "washer" | "dryer";
export type LaundryTimer = {
  kind: LaundryKind;
  finish_at: string | null;
  updated_at: string;
};
