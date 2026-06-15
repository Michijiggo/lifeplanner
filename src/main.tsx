import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { ShoppingProvider } from "./shopping/ShoppingProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ShoppingProvider>
        <App />
      </ShoppingProvider>
    </AuthProvider>
  </React.StrictMode>
);
