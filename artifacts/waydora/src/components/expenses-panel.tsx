import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Camera, Loader2, Trash2, Sparkles, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// ── Sezione Spese ───────────────────────────────────────────────────────────
// Due livelli:
//  • BUDGET pianificato (spese "in programma") → vive in itinerary.budgetPlan,
//    quindi è condiviso col link e impostabile anche in home prima del salvataggio.
//  • Spese REALI (effettuate) → tabella collaborativa trip_expenses per share_slug
//    (richiede uno slug: solo nel viaggio salvato). Foto scontrino su Storage
//    'receipts'; per i Premium l'AI legge l'importo dallo scontrino.

const API_BASE = import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app";

const CATS = [
  { id: "food",      label: "Cibo",       emoji: "🍽️" },
  { id: "transport", label: "Trasporti",  emoji: "🚗" },
  { id: "stay",      label: "Alloggio",   emoji: "🏨" },
  { id: "activity",  label: "Attività",   emoji: "🎟️" },
  { id: "shopping",  label: "Shopping",   emoji: "🛍️" },
  { id: "other",     label: "Altro",      emoji: "💸" },
] as const;
type CatId = (typeof CATS)[number]["id"];

const catMeta = (id: string) => CATS.find(c => c.id === id) ?? CATS[5];

type BudgetItem = { id: string; category: CatId; label: string; amount: number };
type ExpenseRow = {
  id: string; share_slug: string; author: string | null;
  category: CatId; title: string | null; amount: number; currency: string;
  receipt_url: string | null; spent_at: string | null; created_at: string;
};

function eur(n: number, currency = "EUR"): string {
  try { return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}
function parseAmount(s: string): number {
  const n = parseFloat(String(s).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.max(0, n);
}
function uid(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function chanId(p: string): string { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "13px",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "12px", padding: "12px 14px",
};

function CategorySelect({ value, onChange }: { value: CatId; onChange: (c: CatId) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as CatId)} style={{ ...inp, cursor: "pointer" }}>
      {CATS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
    </select>
  );
}

export function ExpensesPanel({ itinerary, onItineraryUpdate, slug, userTier = "guest", authorName }: {
  itinerary: any;
  onItineraryUpdate: (it: any) => void;
  slug?: string;
  userTier?: "guest" | "free" | "paid";
  authorName?: string;
}) {
  const { toast } = useToast();
  const isPremium = userTier === "free" || userTier === "paid"; // gating scansione AI (loggati)
  const budget: BudgetItem[] = Array.isArray(itinerary?.budgetPlan) ? itinerary.budgetPlan : [];

  // ── Budget pianificato (in itinerary.budgetPlan) ──────────────────────────
  const [bCat, setBCat]     = useState<CatId>("food");
  const [bLabel, setBLabel] = useState("");
  const [bAmt, setBAmt]     = useState("");

  const setBudget = (next: BudgetItem[]) => onItineraryUpdate({ ...itinerary, budgetPlan: next });
  const addBudget = () => {
    const amount = parseAmount(bAmt);
    if (!bLabel.trim() && !amount) return;
    setBudget([...budget, { id: uid(), category: bCat, label: bLabel.trim() || catMeta(bCat).label, amount }]);
    setBLabel(""); setBAmt("");
  };
  const removeBudget = (id: string) => setBudget(budget.filter(b => b.id !== id));

  // ── Spese reali (tabella trip_expenses, solo con slug) ────────────────────
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [eCat, setECat]   = useState<CatId>("food");
  const [eTitle, setETitle] = useState("");
  const [eAmt, setEAmt]   = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingReceiptRef = useRef<File | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase.from("trip_expenses").select("*").eq("share_slug", slug)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setRows(data as ExpenseRow[]); });
    const ch = supabase.channel(chanId("exp"))
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_expenses", filter: `share_slug=eq.${slug}` }, p => {
        if (p.eventType === "INSERT") setRows(prev => prev.find(x => x.id === (p.new as ExpenseRow).id) ? prev : [p.new as ExpenseRow, ...prev]);
        else if (p.eventType === "DELETE") setRows(prev => prev.filter(x => x.id !== (p.old as ExpenseRow).id));
        else if (p.eventType === "UPDATE") setRows(prev => prev.map(x => x.id === (p.new as ExpenseRow).id ? p.new as ExpenseRow : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  const author = (authorName || localStorage.getItem("waydora_guest_name") || "").trim() || "Anonimo";

  const insertExpense = async (e: { category: CatId; title: string; amount: number; currency?: string; receipt_url?: string | null; spent_at?: string | null }) => {
    if (!slug) return;
    if (!e.amount && !e.receipt_url) { toast({ title: "Inserisci un importo", variant: "destructive" }); return; }
    const { error } = await supabase.from("trip_expenses").insert({
      share_slug: slug, author, category: e.category, title: e.title || null,
      amount: e.amount, currency: e.currency || "EUR",
      receipt_url: e.receipt_url ?? null, spent_at: e.spent_at ?? null,
    });
    if (error) { toast({ title: "Errore salvataggio spesa: " + error.message, variant: "destructive" }); }
  };

  const addExpenseManual = async () => {
    const amount = parseAmount(eAmt);
    if (!amount) { toast({ title: "Inserisci un importo", variant: "destructive" }); return; }
    setAdding(true);
    let receiptUrl: string | null = null;
    if (pendingReceiptRef.current) receiptUrl = await uploadReceipt(pendingReceiptRef.current);
    await insertExpense({ category: eCat, title: eTitle.trim(), amount, receipt_url: receiptUrl });
    setETitle(""); setEAmt(""); pendingReceiptRef.current = null; setAdding(false);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!slug) return null;
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${slug}/${uid()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { console.warn("[receipts] upload err", error.message); return null; }
      return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
    } catch { return null; }
  };

  // Scansiona scontrino: AI estrae importo/categoria (Premium) + upload foto, poi inserisce la spesa.
  const onReceiptFile = async (file: File) => {
    if (!slug) { toast({ title: "Salva il viaggio per registrare gli scontrini" }); return; }
    if (file.size > 12 * 1024 * 1024) { toast({ title: "Foto troppo grande (max 12MB)", variant: "destructive" }); return; }
    setScanning(true);
    try {
      // 1) Upload foto su Storage (sempre, anche senza AI).
      const receiptUrl = await uploadReceipt(file);
      // 2) Se Premium: chiedi all'AI di leggere l'importo.
      let parsed: { amount: number; currency: string; category: CatId; title: string; date: string | null } | null = null;
      if (isPremium) {
        const b64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1] || "");
          r.onerror = rej; r.readAsDataURL(file);
        });
        const resp = await fetch(`${API_BASE}/api/receipt`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: b64, mediaType: file.type, userTier }),
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && typeof data.amount !== "undefined") parsed = data;
        else if (data?.error) toast({ title: data.error });
      }
      if (parsed && parsed.amount > 0) {
        await insertExpense({
          category: parsed.category, title: parsed.title || "Scontrino",
          amount: parsed.amount, currency: parsed.currency, receipt_url: receiptUrl, spent_at: parsed.date,
        });
        toast({ title: `Spesa aggiunta: ${eur(parsed.amount, parsed.currency)} ✨` });
      } else {
        // Nessun importo dall'AI → precompila il form con la foto allegata, importo a mano.
        pendingReceiptRef.current = file;
        if (parsed?.category) setECat(parsed.category);
        if (parsed?.title) setETitle(parsed.title);
        toast({ title: receiptUrl ? "Foto allegata — inserisci l'importo" : "Inserisci l'importo a mano" });
      }
    } catch (e: any) {
      toast({ title: e?.message || "Errore lettura scontrino", variant: "destructive" });
    }
    setScanning(false);
  };

  const deleteExpense = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    await supabase.from("trip_expenses").delete().eq("id", id);
  };

  // ── Riepilogo ─────────────────────────────────────────────────────────────
  const plannedTotal = useMemo(() => budget.reduce((s, b) => s + (b.amount || 0), 0), [budget]);
  const actualTotal  = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const byCat = useMemo(() => {
    const m: Record<string, { planned: number; actual: number }> = {};
    for (const c of CATS) m[c.id] = { planned: 0, actual: 0 };
    for (const b of budget) (m[b.category] ??= { planned: 0, actual: 0 }).planned += b.amount || 0;
    for (const r of rows)  (m[r.category] ??= { planned: 0, actual: 0 }).actual += Number(r.amount) || 0;
    return m;
  }, [budget, rows]);
  const remaining = plannedTotal - actualTotal;

  if (!itinerary) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "32px" }}>
        <Wallet style={{ width: "34px", height: "34px", opacity: 0.4 }} />
        <p style={{ fontSize: "14px", fontWeight: 600 }}>Genera un itinerario per pianificare le spese</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "18px" }}>💰</span>
        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>Spese del viaggio</span>
      </div>

      {/* Riepilogo budget vs speso */}
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>Budget</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>{eur(plannedTotal)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>Speso</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>{eur(actualTotal)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>{remaining >= 0 ? "Residuo" : "Sforato"}</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: remaining >= 0 ? "#6ee7b7" : "#f87171" }}>{eur(Math.abs(remaining))}</div>
          </div>
        </div>
        {plannedTotal > 0 && (
          <div style={{ height: "8px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (actualTotal / plannedTotal) * 100)}%`, background: actualTotal > plannedTotal ? "#f87171" : "var(--wd-grad-warm)", transition: "width 0.3s" }} />
          </div>
        )}
      </div>

      {/* ── Budget pianificato ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Wallet style={{ width: "13px", height: "13px" }} />Budget in programma
        </div>
        {budget.map(b => (
          <div key={b.id} style={{ ...card, display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px" }}>
            <span style={{ fontSize: "16px" }}>{catMeta(b.category).emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{catMeta(b.category).label}</div>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{eur(b.amount)}</div>
            <button onClick={() => removeBudget(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}><X style={{ width: "14px", height: "14px" }} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: "120px" }}><CategorySelect value={bCat} onChange={setBCat} /></div>
          <input value={bLabel} onChange={e => setBLabel(e.target.value)} placeholder="Voce (es. Hotel)" style={{ ...inp, flex: 1, minWidth: "100px" }} />
          <input value={bAmt} onChange={e => setBAmt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addBudget(); }} inputMode="decimal" placeholder="€" style={{ ...inp, width: "80px" }} />
          <button onClick={addBudget} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Plus style={{ width: "16px", height: "16px" }} /></button>
        </div>
      </div>

      {/* ── Spese reali ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Receipt style={{ width: "13px", height: "13px" }} />Spese effettuate
        </div>

        {!slug ? (
          <div style={{ ...card, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
            💡 Salva e condividi il viaggio per registrare le spese reali, caricare gli scontrini e dividerle col gruppo.
          </div>
        ) : (
          <>
            {/* Form aggiunta manuale + scansione */}
            <div style={{ ...card, display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ width: "120px" }}><CategorySelect value={eCat} onChange={setECat} /></div>
                <input value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="Descrizione" style={{ ...inp, flex: 1, minWidth: "100px" }} />
                <input value={eAmt} onChange={e => setEAmt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addExpenseManual(); }} inputMode="decimal" placeholder="€" style={{ ...inp, width: "80px" }} />
                <button onClick={addExpenseManual} disabled={adding} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: adding ? "default" : "pointer", flexShrink: 0 }}>
                  {adding ? <Loader2 style={{ width: "15px", height: "15px", animation: "wdspin 0.8s linear infinite" }} /> : <Plus style={{ width: "16px", height: "16px" }} />}
                </button>
              </div>
              {pendingReceiptRef.current && <div style={{ fontSize: "11px", color: "#6ee7b7" }}>📎 Scontrino allegato — inserisci l'importo e premi +</div>}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onReceiptFile(f); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={scanning}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "9px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: 600, cursor: scanning ? "default" : "pointer" }}>
                {scanning ? <><Loader2 style={{ width: "14px", height: "14px", animation: "wdspin 0.8s linear infinite" }} />Lettura scontrino…</>
                  : <><Camera style={{ width: "14px", height: "14px" }} />Scansiona scontrino {isPremium ? <Sparkles style={{ width: "12px", height: "12px", color: "#fbbf24" }} /> : <span style={{ fontSize: "10px", color: "#fbbf24" }}>Premium</span>}</>}
              </button>
            </div>

            {/* Lista spese reali */}
            {rows.length === 0
              ? <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>Nessuna spesa registrata</div>
              : rows.map(r => (
                <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px" }}>
                  {r.receipt_url
                    ? <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}><img src={r.receipt_url} alt="scontrino" style={{ width: "34px", height: "34px", borderRadius: "8px", objectFit: "cover" }} /></a>
                    : <span style={{ fontSize: "16px" }}>{catMeta(r.category).emoji}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || catMeta(r.category).label}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{catMeta(r.category).label}{r.author ? ` · ${r.author}` : ""}{r.spent_at ? ` · ${r.spent_at}` : ""}</div>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{eur(Number(r.amount), r.currency)}</div>
                  <button onClick={() => deleteExpense(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}><Trash2 style={{ width: "14px", height: "14px" }} /></button>
                </div>
              ))
            }
          </>
        )}
      </div>

      {/* Dettaglio per categoria */}
      {(plannedTotal > 0 || actualTotal > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>Per categoria</div>
          {CATS.filter(c => byCat[c.id].planned > 0 || byCat[c.id].actual > 0).map(c => (
            <div key={c.id} style={{ ...card, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                <span style={{ color: "#fff" }}>{c.emoji} {c.label}</span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{eur(byCat[c.id].actual)} / {eur(byCat[c.id].planned)}</span>
              </div>
              <div style={{ height: "5px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${byCat[c.id].planned > 0 ? Math.min(100, (byCat[c.id].actual / byCat[c.id].planned) * 100) : (byCat[c.id].actual > 0 ? 100 : 0)}%`, background: byCat[c.id].planned > 0 && byCat[c.id].actual > byCat[c.id].planned ? "#f87171" : "var(--wd-grad-warm)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes wdspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
