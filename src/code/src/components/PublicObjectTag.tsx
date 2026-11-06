import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PublicTag } from "../../lib/schoolFeatures";
import { UUID_PATTERN } from '../../lib/schoolFeatures';
import {isItemCategory,isItemStatus} from '../utils/itemContract';
export function PublicObjectTag({
  token,
  onContinue,
}: {
  token: string;
  onContinue: () => void;
}) {
  const [item, setItem] = useState<PublicTag | null>(null),
    [status, setStatus] = useState("Verificando etiqueta…");
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase?.rpc("resolve_object_tag", { p_token: token }))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {setStatus("No se pudo verificar el código. Revisá la conexión e intentá de nuevo.");return;}
        if (!data) {
          setStatus("Este código ya no está disponible. Puede haber sido reemplazado o revocado.");
          return;
        }
        if(!UUID_PATTERN.test(data.item_id)){setStatus('No se pudo verificar el código. Intentá nuevamente más tarde.');return;}
        setItem({item_id:data.item_id,category:isItemCategory(data.category)?data.category:null,status:isItemStatus(data.status)?data.status:null});
        setStatus("Etiqueta de objeto registrada");
      })
      .catch(() => {
        if (active)
          setStatus("No se pudo consultar la etiqueta. Verificá la conexión.");
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-slate-50">
      <section className="max-w-md w-full bg-white rounded-2xl border p-6 space-y-4">
        <p className="font-bold text-blue-700">BuscAG · Encontrarnos hace la diferencia</p>
        <h1 className="text-2xl font-bold">¿Encontraste este objeto?</h1>
        <p role="status">{status}</p>
        {item && (
          <>
            <p>
              Categoría: {item.category || "Sin categoría"} · Estado:{" "}
              {item.status || "No informado"}
            </p>
            <p className="text-sm text-slate-600">
              No se muestran datos personales. Para contactar al propietario,
              ingresá con una cuenta confirmada y usá el chat de BuscAG. No
              compartas documentos ni entregues objetos sin verificar.
            </p>
            <button
              className="bg-blue-600 text-white rounded-xl px-4 py-3 font-bold"
              onClick={onContinue}
            >
              {item.status==='recuperado'?'Ingresar para ver el estado':'Ingresar para contactar'}
            </button>
          </>
        )}
        <a className="block text-sm underline" href="/">
          Ir a BuscAG
        </a>
      </section>
    </main>
  );
}
