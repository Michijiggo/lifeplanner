import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import Login from "./auth/Login";
import ShoppingList from "./pages/ShoppingList";
import Dishes from "./pages/Dishes";
import MealPlan from "./pages/MealPlan";

type Tab = "list" | "dishes" | "plan";

export default function App() {
  const { session, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("list");

  if (loading) {
    return <div className="splash">🛒</div>;
  }

  if (!session) {
    return <Login />;
  }

  const titles: Record<Tab, string> = {
    list: "Einkaufsliste",
    dishes: "Gerichte",
    plan: "Wochenplan",
  };

  return (
    <div className="app">
      <header className="topbar">
        <h2>{titles[tab]}</h2>
        <button className="logout" onClick={logout} aria-label="Abmelden">
          ⏻
        </button>
      </header>

      <main className="content">
        {tab === "list" && <ShoppingList />}
        {tab === "dishes" && <Dishes />}
        {tab === "plan" && <MealPlan />}
      </main>

      <nav className="tabbar">
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
          <span className="tab-ico">🧺</span>
          Liste
        </button>
        <button className={tab === "dishes" ? "active" : ""} onClick={() => setTab("dishes")}>
          <span className="tab-ico">🍲</span>
          Gerichte
        </button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>
          <span className="tab-ico">📅</span>
          Plan
        </button>
      </nav>
    </div>
  );
}
