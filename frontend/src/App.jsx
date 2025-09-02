// frontend/src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useState } from "react";
import "./App.css";

// pages / components
import Brand from "./components/Brand";
import Dashboard from "./pages/Dashboard.jsx";
import Appointments from "./pages/Appointments.jsx";
import Reports from "./pages/Reports.jsx";
import CustomerReport from "./pages/CustomerReport.jsx";
import StaffReport from "./pages/StaffReport.jsx";
import Invoices from "./pages/Invoices.jsx";
import NewInvoice from "./pages/NewInvoice.jsx";
import Customers from "./pages/Customers.jsx";
import Expenses from "./pages/Expenses.jsx";
import Services from "./pages/Services.jsx";
import Staff from "./pages/Staff.jsx";
import Settings from "./pages/Settings.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import Login from "./pages/login.jsx";
import FeedbackForm from "./pages/FeedbackForm.jsx";
import RateKiosk from "./pages/RateKiosk.jsx";

/* -------------------- Auth helpers -------------------- */
function getAuthUser() {
  try {
    const raw = localStorage.getItem("authUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function hasReportAccess() {
  const u = getAuthUser();
  const role = String(u?.role || "").toLowerCase();
  return role === "admin" || role === "supervisor";
}

/* -------------------- Guards -------------------- */
function RequireAuth({ children }) {
  const token = localStorage.getItem("authToken");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
function RequireRole({ allowed = [], children }) {
  const u = getAuthUser();
  const role = String(u?.role || "").toLowerCase();
  const ok = allowed.map((r) => r.toLowerCase()).includes(role);
  if (!ok) return <Navigate to="/" replace />;
  return children;
}
function Logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
  return <Navigate to="/login" replace />;
}

/* -------------------- Layout with sidebar -------------------- */
function Layout() {
  const [openReports, setOpenReports] = useState(true);

  const iconProps = {
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  const caret = (open) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      style={{
        transition: "transform .15s",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const canSeeReports = hasReportAccess();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "24px",
        padding: "16px",
      }}
    >
      <aside>
        <h2 style={{ marginTop: 0 }}>
          <Brand />
        </h2>

        <nav className="links">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              "navlink blue" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
              </svg>
            </span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/appointments"
            className={({ isActive }) =>
              "navlink amber" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            <span>Appointments</span>
          </NavLink>

          {canSeeReports && (
            <div
              className={"navgroup red" + (openReports ? " open" : "")}
              style={{ marginBottom: 6 }}
            >
              <div
                className="navlink red"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setOpenReports((v) => !v)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="ico">
                    <svg {...iconProps} viewBox="0 0 24 24">
                      <path d="M3 12h4v8H3zM10 6h4v14h-4zM17 10h4v10h-4z" />
                    </svg>
                  </span>
                  <span>Reports</span>
                </div>
                <span>{caret(openReports)}</span>
              </div>

              {openReports && (
                <div
                  style={{ marginTop: 6, marginLeft: 10, display: "grid", gap: 4 }}
                >
                  <NavLink
                    to="/reports"
                    end
                    className={({ isActive }) =>
                      "navlink subtle" + (isActive ? " active" : "")
                    }
                    style={{ paddingLeft: 34 }}
                  >
                    Overview
                  </NavLink>

                  <NavLink
                    to="/reports/customers"
                    className={({ isActive }) =>
                      "navlink subtle" + (isActive ? " active" : "")
                    }
                    style={{ paddingLeft: 34 }}
                  >
                    Customer Report
                  </NavLink>

                  <NavLink
                    to="/reports/staff"
                    className={({ isActive }) =>
                      "navlink subtle" + (isActive ? " active" : "")
                    }
                    style={{ paddingLeft: 34 }}
                  >
                    Staff Report
                  </NavLink>
                </div>
              )}
            </div>
          )}

          <NavLink
            to="/invoices"
            className={({ isActive }) =>
              "navlink teal" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="M7 9h10M7 13h6" />
              </svg>
            </span>
            <span>Invoices</span>
          </NavLink>

          <NavLink
            to="/customers"
            className={({ isActive }) =>
              "navlink green" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <circle cx="8" cy="8" r="3" />
                <circle cx="16" cy="9" r="3" />
                <path d="M2.5 20a6 6 0 0 1 11 0M13 20a5 5 0 0 1 9 0" />
              </svg>
            </span>
            <span>Customers</span>
          </NavLink>

          <NavLink
            to="/expenses"
            className={({ isActive }) =>
              "navlink violet" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M7 12h1M16 12h1" />
              </svg>
            </span>
            <span>Expenses</span>
          </NavLink>

          <NavLink
            to="/services"
            className={({ isActive }) =>
              "navlink purple" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <path d="M14 7l-7 7 3 3 7-7" />
                <path d="M16.5 5.5l2 2" />
              </svg>
            </span>
            <span>Services</span>
          </NavLink>

          <NavLink
            to="/staff"
            className={({ isActive }) =>
              "navlink slate" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3" />
                <path d="M5 21a7 7 0 0 1 14 0" />
              </svg>
            </span>
            <span>Staff</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              "navlink indigo" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span>Settings</span>
          </NavLink>

          <NavLink
            to="/logout"
            className={({ isActive }) =>
              "navlink gray" + (isActive ? " active" : "")
            }
          >
            <span className="ico">
              <svg {...iconProps} viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
            <span>Logout</span>
          </NavLink>
        </nav>
      </aside>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

/* -------------------- App routes -------------------- */
export default function App() {
  return (
    <Router>
      <Routes>
        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/feedback" element={<FeedbackForm />} />
        <Route path="/rate" element={<RateKiosk />} />

        {/* protected with sidebar */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/appointments" element={<Appointments />} />

          <Route
            path="/reports"
            element={
              <RequireRole allowed={["admin", "supervisor"]}>
                <Reports />
              </RequireRole>
            }
          />
          <Route
            path="/reports/customers"
            element={
              <RequireRole allowed={["admin", "supervisor"]}>
                <CustomerReport />
              </RequireRole>
            }
          />
          <Route
            path="/reports/staff"
            element={
              <RequireRole allowed={["admin", "supervisor"]}>
                <StaffReport />
              </RequireRole>
            }
          />

          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/services" element={<Services />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logout" element={<Logout />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}