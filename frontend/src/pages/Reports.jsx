// frontend/src/pages/Reports.jsx
import apiFetch from "../utils/apiFetch";

import { useEffect, useMemo, useState } from "react";

/**
 * Reports (advanced)
 * Data sources: /api/invoices, /api/services, /api/staff, /api/customers, /api/expenses
 * No backend change required.
 */
export default function Reports() {
  // raw data
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [from, setFrom] = useState(() =>
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("all"); // all | in | out
  const [payment, setPayment] = useState("all"); // all | Cash | Card | Transfer...
  const [therapist, setTherapist] = useState("all"); // name or all
  const [serviceName, setServiceName] = useState("all"); // service or all

  // load data once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const req = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${url} ${r.status}`))));
        const [inv, srv, stf, cus, exp] = await Promise.allSettled([
          req("http://apiFetch(/api/invoices"),
          req("http://apiFetch(/api/services"),
          req("http://apiFetch(/api/staff"),
          req("http://apiFetch(/api/customers"),
          req("http://apiFetch(/api/expenses"),
        ]);

        if (inv.status !== "fulfilled") throw inv.reason;
        if (srv.status !== "fulfilled") throw srv.reason;
        if (alive) {
          setInvoices(Array.isArray(inv.value) ? inv.value : []);
          setServices(Array.isArray(srv.value) ? srv.value : []);
          setStaff(stf.status === "fulfilled" && Array.isArray(stf.value) ? stf.value : []);
          setCustomers(cus.status === "fulfilled" && Array.isArray(cus.value) ? cus.value : []);
          setExpenses(exp.status === "fulfilled" && Array.isArray(exp.value) ? exp.value : []);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // helpers
  const startDate = useMemo(() => new Date(from + "T00:00:00"), [from]);
  const endDate = useMemo(() => new Date(to + "T23:59:59"), [to]);

  const serviceDurations = useMemo(() => {
    const m = new Map();
    for (const s of services) {
      const name = s.name || s.serviceName || "";
      const durMin = Number(s.duration || s.durationMin || 0);
      if (name) m.set(name, durMin);
    }
    return m;
  }, [services]);

  const customersMap = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c.name || c.fullName || c.displayName || `#${c.id}`);
    return m;
  }, [customers]);

  // filter invoices
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const d = new Date(inv.createdAt || inv.date || Date.now());
      if (d < startDate || d > endDate) return false;
      if (mode !== "all") {
        const m = (inv.mode || "").toLowerCase();
        if (mode === "in" && m !== "in") return false;
        if (mode === "out" && m !== "out") return false;
      }
      if (payment !== "all" && (inv.paymentMethod || "").toLowerCase() !== payment.toLowerCase()) return false;
      if (therapist !== "all" && (inv.therapist || "") !== therapist) return false;
      if (serviceName !== "all") {
        const has = (inv.items || []).some((it) => (it.serviceName || it.service || "") === serviceName);
        if (!has) return false;
      }
      return true;
    });
  }, [invoices, startDate, endDate, mode, payment, therapist, serviceName]);

  // filter expenses by date
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date || e.createdAt || Date.now());
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // totals per invoice
  const invoiceTotals = (inv) => {
    const subtotal =
      inv.subtotal ??
      (inv.items || []).reduce((s, it) => s + (Number(it.total) || Number(it.qty) * Number(it.price) || 0), 0);
    const taxRate = Number(inv.taxRate ?? 0);
    const tax = inv.tax ?? (subtotal * taxRate) / 100;
    const extra = Number(inv.extra ?? 0);
    const discount = Number(inv.discount ?? 0);
    const gross = inv.total ?? Math.max(0, subtotal + tax + extra - discount);
    const taxi = Number(inv.taxiCost ?? 0);
    const net = gross - taxi;
    return { subtotal, tax, extra, discount, gross, taxi, net };
  };

  // currency
  const currency =
    filtered[0]?.currency || invoices[0]?.currency || filteredExpenses[0]?.currency || "AED";
  const fmt = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency }), [currency]);

  // KPIs (sales)
  const kpis = useMemo(() => {
    let invoicesCount = 0,
      itemsCount = 0;
    let gross = 0,
      net = 0,
      tax = 0,
      extra = 0,
      discount = 0,
      taxi = 0;
    for (const inv of filtered) {
      invoicesCount++;
      itemsCount += (inv.items || []).length;
      const t = invoiceTotals(inv);
      gross += t.gross;
      net += t.net;
      tax += t.tax;
      extra += t.extra;
      discount += t.discount;
      taxi += t.taxi;
    }
    const expensesTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount || e.total || e.value || 0), 0);
    const profit = net - expensesTotal;
    const avgTicket = invoicesCount ? gross / invoicesCount : 0;
    return { invoicesCount, itemsCount, gross, net, tax, extra, discount, taxi, avgTicket, expensesTotal, profit };
  }, [filtered, filteredExpenses]);

  // By Day (sales)
  const byDay = useMemo(() => {
    const map = new Map();
    for (const inv of filtered) {
      const day = new Date(inv.createdAt || inv.date).toISOString().slice(0, 10);
      const t = invoiceTotals(inv);
      const v = map.get(day) || { revenue: 0, count: 0 };
      v.revenue += t.gross;
      v.count += 1;
      map.set(day, v);
    }
    return Array.from(map, ([key, v]) => ({ key, revenue: v.revenue, count: v.count })).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
  }, [filtered]);

  // Expenses: by day & by category
  const expensesByDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredExpenses) {
      const day = new Date(e.date || e.createdAt).toISOString().slice(0, 10);
      map.set(day, (map.get(day) || 0) + Number(e.amount || e.total || 0));
    }
    return Array.from(map, ([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredExpenses]);

  const expensesByCat = useMemo(() => {
    const map = new Map();
    for (const e of filteredExpenses) {
      const cat = e.category || e.type || "Other";
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || e.total || 0));
    }
    return Array.from(map, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Service mix
  const serviceMix = useMemo(() => {
    const map = new Map();
    let totalRevenue = 0;
    for (const inv of filtered) {
      for (const it of inv.items || []) {
        const name = it.serviceName || it.service || "-";
        const qty = Number(it.qty || 0);
        const revenue = Number(it.total ?? qty * Number(it.price || 0)) || 0;
        const cur = map.get(name) || { qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += revenue;
        map.set(name, cur);
        totalRevenue += revenue;
      }
    }
    const rows = Array.from(map, ([key, v]) => ({
      key,
      qty: v.qty,
      revenue: v.revenue,
      share: totalRevenue ? v.revenue / totalRevenue : 0,
    }));
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Therapist performance
  const therapistPerf = useMemo(() => {
    const map = new Map();
    for (const inv of filtered) {
      if (!inv.therapist) continue;
      const key = inv.therapist;
      const cur = map.get(key) || { revenue: 0, items: 0, minutes: 0 };
      const t = invoiceTotals(inv);
      cur.revenue += t.gross;
      cur.items += (inv.items || []).length;
      let mins = 0;
      for (const it of inv.items || []) {
        const name = it.serviceName || it.service || "";
        const qty = Number(it.qty || 0);
        const dur = serviceDurations.get(name) || 0;
        mins += dur * qty;
      }
      cur.minutes += mins;
      map.set(key, cur);
    }
    const rows = Array.from(map, ([key, v]) => {
      const hours = v.minutes / 60;
      return {
        key,
        revenue: v.revenue,
        items: v.items,
        avgTicket: v.items ? v.revenue / v.items : 0,
        hours,
        revPerHour: hours ? v.revenue / hours : 0,
      };
    });
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [filtered, serviceDurations]);

  // Customer value (uses customersMap if name missing)
  const customerValue = useMemo(() => {
    const map = new Map();
    for (const inv of filtered) {
      const cid = inv.customerId ?? inv.customer?.id ?? inv.customerName ?? "Unknown";
      const nameFromInvoice = inv.customerName || inv.customer?.name;
      const name =
        nameFromInvoice ||
        (typeof cid === "number" ? customersMap.get(cid) : String(cid)) ||
        String(cid);
      const t = invoiceTotals(inv);
      const cur = map.get(cid) || { name, visits: 0, revenue: 0, last: null };
      cur.visits += 1;
      cur.revenue += t.gross;
      const d = new Date(inv.createdAt || inv.date || Date.now());
      cur.last = !cur.last || d > cur.last ? d : cur.last;
      map.set(cid, cur);
    }
    const rows = Array.from(map, ([key, v]) => ({
      key,
      name: v.name,
      visits: v.visits,
      revenue: v.revenue,
      last: v.last ? v.last.toLocaleDateString() : "-",
    }));
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [filtered, customersMap]);

  // In vs Out
  const inOut = useMemo(() => {
    const agg = { in: { gross: 0, taxi: 0, net: 0, count: 0 }, out: { gross: 0, taxi: 0, net: 0, count: 0 } };
    for (const inv of filtered) {
      const m = (inv.mode || "").toLowerCase() === "out" ? "out" : "in";
      const t = invoiceTotals(inv);
      agg[m].gross += t.gross;
      agg[m].taxi += t.taxi;
      agg[m].net += t.net;
      agg[m].count += 1;
    }
    return [
      { key: "In-Center", ...agg.in },
      { key: "Out-Call", ...agg.out },
    ];
  }, [filtered]);

  // Hour heatmap
  const hourHeat = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }));
    for (const inv of filtered) {
      const d = new Date(inv.createdAt || inv.date || Date.now());
      const h = d.getHours();
      const t = invoiceTotals(inv);
      rows[h].revenue += t.gross;
      rows[h].count += 1;
    }
    return rows;
  }, [filtered]);

  // Export CSV
  const exportCSV = (rows, headers, filename) => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(",")]
      .concat(rows.map((r) => headers.map((h) => esc(r[h])).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (error) return <div style={{ padding: 20, color: "crimson" }}>Failed to load: {error}</div>;

  const therapistNames = Array.from(new Set(invoices.map((i) => i.therapist).filter(Boolean))).sort();
  const serviceNames = Array.from(new Set(services.map((s) => s.name || s.serviceName).filter(Boolean))).sort();

  return (
    <div className="page">
      <h1>Reports</h1>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Session
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All</option>
            <option value="in">In-Center</option>
            <option value="out">Out-Call</option>
          </select>
        </label>
        <label>
          Payment
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">All</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Transfer">Transfer</option>
          </select>
        </label>
        <label>
          Therapist
          <select value={therapist} onChange={(e) => setTherapist(e.target.value)}>
            <option value="all">All</option>
            {therapistNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
            <option value="all">All</option>
            {serviceNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
        <Card title="Invoices">{kpis.invoicesCount}</Card>
        <Card title="Items">{kpis.itemsCount}</Card>
        <Card title="Gross">{fmt.format(kpis.gross)}</Card>
        <Card title="Tax">{fmt.format(kpis.tax)}</Card>
        <Card title="Taxi (Out)">{fmt.format(kpis.taxi)}</Card>
        <Card title="Net (after taxi)">{fmt.format(kpis.net)}</Card>
        <Card title="Discounts">{fmt.format(kpis.discount)}</Card>
        <Card title="Extra">{fmt.format(kpis.extra)}</Card>
        <Card title="Avg Ticket">{fmt.format(kpis.avgTicket)}</Card>
        <Card title="Expenses">{fmt.format(kpis.expensesTotal)}</Card>
        <Card title="Profit">{fmt.format(kpis.profit)}</Card>
      </div>

      {/* Sales by day */}
      <Block
        title="Sales by day"
        onExport={() =>
          exportCSV(
            byDay.map((r) => ({ Date: r.key, Count: r.count, Revenue: r.revenue })),
            ["Date", "Count", "Revenue"],
            "sales-by-day.csv"
          )
        }
      >
        <Table
            head={["Date", "Count", "Revenue"]}
            rows={byDay.map((r) => [r.key, r.count, fmt.format(r.revenue)])}
        />
      </Block>

      {/* Expenses */}
      <Block
        title="Expenses (by day)"
        onExport={() =>
          exportCSV(
            expensesByDay.map((r) => ({ Date: r.key, Amount: r.value })),
            ["Date", "Amount"],
            "expenses-by-day.csv"
          )
        }
      >
        <Table
          head={["Date", "Amount"]}
          rows={expensesByDay.map((r) => [r.key, fmt.format(r.value)])}
        />
      </Block>

      <Block
        title="Expenses (by category)"
        onExport={() =>
          exportCSV(
            expensesByCat.map((r) => ({ Category: r.key, Amount: r.value })),
            ["Category", "Amount"],
            "expenses-by-category.csv"
          )
        }
      >
        <Table
          head={["Category", "Amount"]}
          rows={expensesByCat.map((r) => [r.key, fmt.format(r.value)])}
        />
      </Block>

      {/* Service mix */}
      <Block
        title="Service mix"
        onExport={() =>
          exportCSV(
            serviceMix.map((r) => ({
              Service: r.key,
              Qty: r.qty,
              Revenue: r.revenue,
              Share: (r.share * 100).toFixed(1) + "%",
            })),
            ["Service", "Qty", "Revenue", "Share"],
            "service-mix.csv"
          )
        }
      >
        <Table
          head={["Service", "Qty", "Revenue", "Share"]}
          rows={serviceMix.map((r) => [r.key, r.qty, fmt.format(r.revenue), (r.share * 100).toFixed(1) + "%"])}
        />
      </Block>

      {/* Therapist performance */}
      <Block
        title="Therapist performance"
        onExport={() =>
          exportCSV(
            therapistPerf.map((r) => ({
              Therapist: r.key,
              Revenue: r.revenue,
              Items: r.items,
              "Avg Ticket": r.avgTicket,
              Hours: r.hours,
              "Rev/Hour": r.revPerHour,
            })),
            ["Therapist", "Revenue", "Items", "Avg Ticket", "Hours", "Rev/Hour"],
            "therapists.csv"
          )
        }
      >
        <Table
          head={["Therapist", "Revenue", "Items", "Avg Ticket", "Hours", "Rev/Hour"]}
          rows={therapistPerf.map((r) => [
            r.key,
            fmt.format(r.revenue),
            r.items,
            fmt.format(r.avgTicket),
            r.hours.toFixed(2),
            fmt.format(r.revPerHour),
          ])}
        />
      </Block>

      {/* Customers */}
      <Block
        title="Top customers"
        onExport={() =>
          exportCSV(
            customerValue.map((r) => ({ Customer: r.name, Visits: r.visits, Revenue: r.revenue, "Last visit": r.last })),
            ["Customer", "Visits", "Revenue", "Last visit"],
            "customers.csv"
          )
        }
      >
        <Table
          head={["Customer", "Visits", "Revenue", "Last visit"]}
          rows={customerValue.map((r) => [r.name, r.visits, fmt.format(r.revenue), r.last])}
        />
      </Block>

      {/* In vs Out */}
      <Block
        title="In-Center vs Out-Call"
        onExport={() =>
          exportCSV(
            inOut.map((r) => ({ Type: r.key, Count: r.count, Gross: r.gross, Taxi: r.taxi, Net: r.net })),
            ["Type", "Count", "Gross", "Taxi", "Net"],
            "in-vs-out.csv"
          )
        }
      >
        <Table
          head={["Type", "Count", "Gross", "Taxi", "Net"]}
          rows={inOut.map((r) => [r.key, r.count, fmt.format(r.gross), fmt.format(r.taxi), fmt.format(r.net)])}
        />
      </Block>

      {/* Hour heatmap */}
      <Block title="Hourly heatmap">
        <Table
          head={["Hour", "Count", "Revenue"]}
          rows={hourHeat.map((r) => [`${r.hour}:00`, r.count, fmt.format(r.revenue)])}
        />
      </Block>
    </div>
  );
}

/* Reusable components */
function Card({ title, children }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
      <div style={{ color: "#666", fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{children}</div>
    </div>
  );
}

function Block({ title, onExport, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {onExport ? (
          <button className="no-print" onClick={onExport}>
            Export CSV
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows }) {
  const tbl = { width: "100%", borderCollapse: "collapse" };
  const th = { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", fontWeight: 600 };
  const thRight = { ...th, textAlign: "right" };
  const td = { textAlign: "left", borderBottom: "1px solid #f4f4f4", padding: "8px 6px" };
  const tdRight = { ...td, textAlign: "right" };
  return (
    <table style={tbl}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} style={i === head.length - 1 || /count|amount|revenue|gross|tax|net|hours|qty/i.test(h) ? thRight : th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={j === r.length - 1 || (typeof c === "number" && !Number.isNaN(c)) ? tdRight : td}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={head.length} style={td}>
              No data.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}