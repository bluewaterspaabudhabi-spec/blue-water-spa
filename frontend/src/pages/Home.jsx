import { useEffect, useState } from "react";
import apiFetch from "../utils/apiFetch";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(";

export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, visits: 0, topService: "-" });

  useEffect(() => {
    // احصائيات تجريبية (مكانها لاحقًا من /api/reports)
    setStats({ revenue: 0, visits: 0, topService: "-" });

    // الجلسات الحية
    fetch(`${API}/api/sessions`)
      .then(r => r.ok ? r.json() : [])
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  return (
    <div className="home">
      <h1 style={{margin:"0 0 14px 0"}}>Dashboard</h1>

      {/* KPIs كبيرة */}
      <div className="kpis" style={{marginBottom:18}}>
        <div className="card kpi">
          <div className="label">Revenue (Today)</div>
          <div className="value">${stats.revenue.toFixed(2)}</div>
        </div>
        <div className="card kpi">
          <div className="label">Visits</div>
          <div className="value">{stats.visits}</div>
        </div>
        <div className="card kpi">
          <div className="label">Top Service (This week)</div>
          <div className="value" style={{fontSize:28}}>{stats.topService}</div>
        </div>
      </div>

      {/* جدول الجلسات المباشرة لاستغلال المساحة */}
      <div className="card" style={{marginTop:4}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
          <h2 style={{margin:0, fontSize:20}}>Live Sessions (Now)</h2>
          <span className="btn" onClick={()=>{
            fetch(`${API}/api/sessions`)
              .then(r=>r.ok?r.json():[])
              .then(setSessions)
              .catch(()=>{});
          }}>Refresh</span>
        </div>

        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Room</th>
                <th>Therapist</th>
                <th>Service</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Time Left</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{textAlign:"center", color:"#64748b"}}>
                    No active sessions
                  </td>
                </tr>
              )}
              {sessions.map((s, i) => {
                // تقدير الوقت المتبقي (إن لم توفّريه من الـAPI)
                const durationMin = Number(s.durationMin || 60);
                const start = s.startedAt ? new Date(s.startedAt) : new Date();
                const end = new Date(start.getTime() + durationMin * 60000);
                const leftMs = end.getTime() - Date.now();
                const leftMin = Math.max(0, Math.ceil(leftMs / 60000));

                return (
                  <tr key={s.id || i}>
                    <td>{i + 1}</td>
                    <td>{s.room || "-"}</td>
                    <td>{s.therapist || "-"}</td>
                    <td>{s.service || "-"}</td>
                    <td>{s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : "-"}</td>
                    <td>{durationMin} min</td>
                    <td>{leftMin} min</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
