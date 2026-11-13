import {categoryLabel} from "../i18n";
import {t, useLanguage} from "../i18n";
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
  useLanguage();
  const [item, setItem] = useState<PublicTag | null>(null),
    [status, setStatus] = useState("Verificando etiqueta…");
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase?.rpc("resolve_object_tag", { p_token: token }))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {setStatus(t("No se pudo verificar el código. Revisá la conexión e intentá de nuevo."));return;}
        if (!data) {
          setStatus(t("Este código ya no está disponible. Puede haber sido reemplazado o revocado."));
          return;
        }
        if(!UUID_PATTERN.test(data.item_id)){setStatus(t("No se pudo verificar el código. Intentá nuevamente más tarde."));return;}
        setItem({item_id:data.item_id,category:isItemCategory(data.category)?data.category:null,status:isItemStatus(data.status)?data.status:null});
        setStatus(t("Etiqueta de objeto registrada"));
      })
      .catch(() => {
        if (active)
          setStatus(t("No se pudo consultar la etiqueta. Verificá la conexión."));
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-slate-50">
      <section className="max-w-md w-full bg-white rounded-2xl border p-6 space-y-4">
        <p className="font-bold text-blue-700">{t("BuscAG · Encontrarnos hace la diferencia")}</p>
        <h1 className="text-2xl font-bold">{t("¿Encontraste este objeto?")}</h1>
        <p role="status">{t(status)}</p>
        {item && (
          <>
            <p> {t("Categoría:")} {categoryLabel(item.category || t('Sin categoría'))} {t("· Estado:")}{" "}
              {t(item.status || 'No informado')}
            </p>
            <p className="text-sm text-slate-600">{t("No se muestran datos personales. Para contactar al propietario, ingresá con una cuenta confirmada y usá el chat de BuscAG. No compartas documentos ni entregues objetos sin verificar.")}</p>
            <button
              className="bg-blue-600 text-white rounded-xl px-4 py-3 font-bold"
              onClick={onContinue}
            >
              {item.status==='recuperado'?t("Ingresar para ver el estado"):t("Ingresar para contactar")}
            </button>
          </>
        )}
        <a className="block text-sm underline" href="/">{t("Ir a BuscAG")}</a>
      </section>
    </main>
  );
}
