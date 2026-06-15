import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import Login from "./auth/Login";
import ShoppingList from "./pages/ShoppingList";
import Dishes from "./pages/Dishes";
import DishLists from "./pages/DishLists";
import MealPlan from "./pages/MealPlan";
import Laundry from "./pages/Laundry";

type Area = "shop" | "laundry";
type Tab = "list" | "dishes" | "lists" | "plan";

export default function App() {
  const { session, loading, logout } = useAuth();
  const [area, setArea] = useState<Area>("shop");
  const [tab, setTab] = useState<Tab>("list");
  const [drawer, setDrawer] = useState(false);

  if (loading) {
    return <div className="splash">🛒</div>;
  }

  if (!session) {
    return <Login />;
  }

  const titles: Record<Tab, string> = {
    list: "Einkaufsliste",
    dishes: "Gerichte",
    lists: "Listen",
    plan: "Wochenplan",
  };
  const headerTitle = area === "laundry" ? "Wäsche" : titles[tab];

  return (
    <div className="app">
      <header className="topbar">
        <button className="burger" onClick={() => setDrawer(true)} aria-label="Menü">
          ☰
        </button>
        <h2>{headerTitle}</h2>
        <button className="logout" onClick={logout} aria-label="Abmelden">
          ⏻
        </button>
      </header>

      <main className="content">
        {area === "shop" && (
          <>
            {tab === "list" && <ShoppingList />}
            {tab === "dishes" && <Dishes />}
            {tab === "lists" && <DishLists />}
            {tab === "plan" && <MealPlan />}
          </>
        )}
        {area === "laundry" && <Laundry />}
      </main>

      {area === "shop" && (
        <nav className="tabbar">
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
            <span className="tab-ico">🧺</span>
            Liste
          </button>
          <button className={tab === "dishes" ? "active" : ""} onClick={() => setTab("dishes")}>
            <span className="tab-ico">🍲</span>
            Gerichte
          </button>
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}>
            <span className="tab-ico">📑</span>
            Listen
          </button>
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>
            <span className="tab-ico">📅</span>
            Plan
          </button>
        </nav>
      )}

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">Bereiche</div>
            <button
              className={`drawer-item ${area === "shop" ? "active" : ""}`}
              onClick={() => {
                setArea("shop");
                setDrawer(false);
              }}
            >
              🛒 Einkauf
            </button>
            <button
              className={`drawer-item ${area === "laundry" ? "active" : ""}`}
              onClick={() => {
                setArea("laundry");
                setDrawer(false);
              }}
            >
              🧺 Wäsche
            </button>
            <button className="drawer-logout" onClick={logout}>
              Abmelden
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
