// frontend/src/pages/Dashboards.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiFetch from "../utils/apiFetch";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Dashboard() {
  const nav = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    // load customers
    apiFetch("/customers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomers(data))
      .catch(() => setCustomers([]));

    // load services
    apiFetch("/services")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setServices(data))
      .catch(() => setServices([]));

    // load staff
    apiFetch("/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setStaff(data))
      .catch(() => setStaff([]));
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>

      <section>
        <h2>Customers</h2>
        <p>Total: {customers.length}</p>
      </section>

      <section>
        <h2>Services</h2>
        <p>Total: {services.length}</p>
      </section>

      <section>
        <h2>Staff</h2>
        <p>Total: {staff.length}</p>
      </section>

      <Link to="/appointments">Go to Appointments</Link>
    </div>
  );
}