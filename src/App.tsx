import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import Login from "./auth/Login";
import ShoppingList from "./pages/ShoppingList";
import Dishes from "./pages/Dishes";
import DishLists from "./pages/DishLists";
import MealPlan from "./pages/MealPlan";
import Laundry from "./pages/Laundry";
import Finanzen from "./pages/Finanzen";
import Rechner from "./pages/Rechner";
import FinanzDashboard from "./pages/FinanzDashboard";

type Area = "shop" | "laundry" | "finance";
type Tab = "list" | "dishes" | "lists" | "plan";
type FinanceTab = "costs" | "calculator" | "dashboard";

export default function App() {
  const { session, loading, logout } = useAuth();
  const [area, setArea] = useState<Area>("shop");
  const [tab, setTab] = useState<Tab>("list");
  const [financeTab, setFinanceTab] = useState<FinanceTab>("costs");
  const [drawer, setDrawer] = useState(false);

  if (loading) {
    return <div className="splash">🛒</div>;
  }

  if (!session) {
    return <Login />;
  }

  const shopTitles: Record<Tab, string> = {
    list: "Einkaufsliste", dishes: "Gerichte", lists: "Listen", plan: "Wochenplan",
  };
  const financeTitles: Record<FinanceTab, string> = {
    costs: "Fixkosten", calculator: "Rechner", dashboard: "Dashboard",
  };
  const headerTitle =
    area === "laundry" ? "Wäsche"
    : area === "finance" ? `💰 ${financeTitles[financeTab]}`
    : shopTitles[tab];

  return (
    <div className="app">
      <header className="topbar">
        <button className="burger" onClick={() => setDrawer(true)} aria-label="Menü">☰</button>
        <h2>{headerTitle}</h2>
        <button className="logout" onClick={logout} aria-label="Abmelden">⏻</button>
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
        {area === "finance" && financeTab === "costs" && <Finanzen />}
        {area === "finance" && financeTab === "calculator" && <Rechner />}
        {area === "finance" && financeTab === "dashboard" && <FinanzDashboard />}
      </main>

      {area === "shop" && (
        <nav className="tabbar">
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
            <span className="tab-ico">🧺</span>Liste
          </button>
          <button className={tab === "dishes" ? "active" : ""} onClick={() => setTab("dishes")}>
            <span className="tab-ico">🍲</span>Gerichte
          </button>
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}>
            <span className="tab-ico">📑</span>Listen
          </button>
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>
            <span className="tab-ico">📅</span>Plan
          </button>
        </nav>
      )}

      {area === "finance" && (
        <nav className="tabbar">
          <button className={financeTab === "costs" ? "active" : ""} onClick={() => setFinanceTab("costs")}>
            <span className="tab-ico">💳</span>Fixkosten
          </button>
          <button className={financeTab === "calculator" ? "active" : ""} onClick={() => setFinanceTab("calculator")}>
            <span className="tab-ico">🧮</span>Rechner
          </button>
          <button className={financeTab === "dashboard" ? "active" : ""} onClick={() => setFinanceTab("dashboard")}>
            <span className="tab-ico">📊</span>Dashboard
          </button>
        </nav>
      )}

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">Bereiche</div>
            <button
              className={`drawer-item ${area === "shop" ? "active" : ""}`}
              onClick={() => { setArea("shop"); setDrawer(false); }}
            >
              🛒 Einkauf
            </button>
            <button
              className={`drawer-item ${area === "laundry" ? "active" : ""}`}
              onClick={() => { setArea("laundry"); setDrawer(false); }}
            >
              🧺 Wäsche
            </button>
            <button
              className={`drawer-item ${area === "finance" ? "active" : ""}`}
              onClick={() => { setArea("finance"); setDrawer(false); }}
            >
              💰 Finanzen
            </button>
            <button className="drawer-logout" onClick={logout}>Abmelden</button>
          </aside>
        </div>
      )}
    </div>
  );
}
