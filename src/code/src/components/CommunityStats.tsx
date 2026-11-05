import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { CommunityStats as Stats } from "../../lib/schoolFeatures";
export function CommunityStats() {
  const [stats, setStats] = useState<Stats | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!supabase || busy) return;
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
      setStats(r.data);
    } catch {
      setError(
        "Estadísticas no disponibles. Requieren el backend escolar habilitado.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
      aria-label="Impacto de la comunidad"
    >
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
          <p className="text-xs text-slate-500">
            Datos visibles para tu cuenta según RLS. {stats.mine} publicaciones
            tuyas. Recuperado indica el estado declarado; no certifica una
            devolución bilateral.
          </p>
        </>
      )}
    </section>
  );
}
