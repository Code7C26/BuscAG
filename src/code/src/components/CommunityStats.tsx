import React, { useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { CommunityStats as Stats } from "../../lib/schoolFeatures";
export function CommunityStats() {
  const revision=useRef(0);
  const [stats, setStats] = useState<Stats | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!supabase || busy) return;
    const version=++revision.current;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("community_statistics");
      if (
        r.error ||
        !r.data ||
        r.data.scope !== "visible_by_rls" ||
        !["publications", "lost", "found", "recovered", "mine"].every(
          (key) => Number.isSafeInteger(r.data[key]) && r.data[key] >= 0,
        )
      )
        throw Error();
      if(r.data.lost+r.data.found+r.data.recovered>r.data.publications)throw Error();
      if(version===revision.current)setStats(r.data);
    } catch {
      if(version===revision.current)setError(
        "Estadísticas no disponibles. Revisá la conexión o intentá más tarde.",
      );
    } finally {
      if(version===revision.current)setBusy(false);
    }
  };
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
      aria-label="Impacto de la comunidad"
    >
      <p className="text-xs font-semibold">Estadísticas de la comunidad</p>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Cada encuentro cuenta</h2>
        <button
          className="text-sm font-semibold text-blue-700"
          disabled={busy}
          onClick={load}
        >
          {busy
            ? "Consultando…"
            : stats
              ? "Actualizar estadísticas"
              : "Ver estadísticas reales"}
        </button>
      </div>
      {error && (
        <p role="status" className="text-sm text-slate-600">
          {error}
        </p>
      )}
      {(stats||busy)&&<button className="underline text-sm" onClick={()=>{++revision.current;setStats(null);setBusy(false);setError('');}}>Cerrar estadísticas</button>}
      {stats && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Publicaciones", stats.publications],
              ["Perdidos", stats.lost],
              ["Encontrados", stats.found],
              ["Recuperados", stats.recovered],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-600">{label}</dt>
                <dd className="text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          {stats.publications>stats.lost+stats.found+stats.recovered&&<p className="text-xs">Sin estado informado: {stats.publications-stats.lost-stats.found-stats.recovered}</p>}
          <p className="text-xs text-slate-500">Publicaciones visibles para tu cuenta; {stats.mine} son tuyas. Los recuperados incluyen declaraciones individuales y devoluciones confirmadas entre personas.</p>
        </>
      )}
    </section>
  );
}
