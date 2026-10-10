import { Dashboard } from "./Dashboard.jsx";
import { Survey } from "./Survey.jsx";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/dashboard" ? <Dashboard /> : <Survey />;
}
