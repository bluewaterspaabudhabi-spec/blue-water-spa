import { useSearchParams } from "react-router-dom";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Rate() {
  const [qp] = useSearchParams();
  const appointmentId = qp.get("appointmentId") || "";
  const customerId    = qp.get("customerId")    || "";
  const therapistId   = qp.get("therapistId")   || "";
  const room          = qp.get("room")          || "";
  const [rating, setRating]   = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [err, setErr] = React.useState("");

  async function submit() {
    setErr(""); setOk("");
    try {
      const r = await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          customerId,
          therapistId,
          rating,
          comment,
          source: "link",
        })
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      setOk("Thanks! Your feedback was submitted.");
    } catch(e) {
      setErr(e.message || "Failed");
    }
  }

  return (
    <div style={{minHeight:"100vh", display:"grid", placeItems:"center", background:"#f5f7fb"}}>
      <div style={{width:360, background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:16}}>
        <h2 style={{marginTop:0}}>Rate your visit</h2>
        <div style={{fontSize:13, color:"#6b7280", marginBottom:8}}>
          Room: {room || "-"}
        </div>
        <label style={{display:"grid", gap:6, marginBottom:10}}>
          <span>Rating (1–5)</span>
          <input type="number" min={1} max={5} value={rating} onChange={e=>setRating(Number(e.target.value)||1)} />
        </label>
        <label style={{display:"grid", gap:6, marginBottom:10}}>
          <span>Comment</span>
          <textarea rows={3} value={comment} onChange={e=>setComment(e.target.value)} />
        </label>
        {err && <div style={{background:"#fee2e2", color:"#991b1b", padding:"6px 8px", borderRadius:6, marginBottom:8}}>{err}</div>}
        {ok  && <div style={{background:"#dcfce7", color:"#166534", padding:"6px 8px", borderRadius:6, marginBottom:8}}>{ok}</div>}
        <button onClick={submit} style={{height:36, border:"none", borderRadius:8, background:"#2563eb", color:"#fff", width:"100%"}}>Submit</button>
      </div>
    </div>
  );
}