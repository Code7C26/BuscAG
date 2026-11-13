import {t, useLanguage} from "../i18n";
import React from "react";
import type { AdvancedFilters } from "../utils/publicationFilters";
export function AdvancedSearch({
  value,
  onChange,
  onClear,
}: {
  value: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  onClear: () => void;
}) {
  useLanguage();
  const field = (key: keyof AdvancedFilters, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <details className="community-tools my-3">
      <summary>{t("Búsqueda avanzada")}</summary>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <label> {t("Localidad o zona")} <input
            value={value.zone}
            maxLength={200}
            onChange={(e) => field("zone", e.target.value)}
            placeholder={t("Barrio, localidad o lugar")}
          />
        </label>
        <label> {t("Desde la fecha")} <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => field("from", e.target.value)}
          />
        </label>
        <label> {t("Hasta la fecha")} <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => field("to", e.target.value)}
          />
        </label>
        <label> {t("Autoría")} <select
            value={value.ownership}
            onChange={(e) => field("ownership", e.target.value)}
          >
            <option value="all">{t("Todas las personas")}</option>
            <option value="mine">{t("Mis publicaciones")}</option>
            <option value="others">{t("Publicaciones de otras personas")}</option>
          </select>
        </label>
        <label> {t("Ordenar por")} <select
            value={value.sort}
            onChange={(e) => field("sort", e.target.value)}
          >
            <option value="recent">{t("Más recientes primero")}</option>
            <option value="oldest">{t("Más antiguas primero")}</option>
            <option value="distance">{t("Distancia (requiere ubicación)")}</option>
          </select>
        </label>
        <button type="button" onClick={onClear}>{t("Limpiar filtros")}</button>
      </div>
    </details>
  );
}
